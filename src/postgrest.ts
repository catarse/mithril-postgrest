import prop from 'mithril/stream';
import _ from 'underscore';
import filtersVM, { Filter } from './vms/filtersVM';
import paginationVM from './vms/paginationVM';
import mithril from 'mithril';
import { ExecutionLocker } from './utils/execution-locker';

type InnerPostgrestData = {
    token: prop<string>
    authenticate(): Promise<{ token: string }>
    init(apiPrefix: string, authenticationOptions: AuthenticationOptions, globalHeader: {}, isExpired: (token: string) => Promise<boolean>)
    request(options: { url?: string })
    requestWithToken(options: {})
    loader: (p2: any) => prop<boolean> & { load: () => Promise<unknown>; }
    loaderWithToken: (options: any, defaultState?: boolean) => prop<boolean> & {
        load: () => Promise<unknown>;
    }
    model(name: string): {
        pageSize: prop<number>
        getPageOptions: (data: any, page: any, options: any, headers?: {}) => any
        getRowOptions: (data: any, options: any, headers?: {}) => any
        patchOptions: (filters: any, attributes: any, options: any, headers?: {}) => any
        postOptions: (attributes: any, options: any, headers?: {}) => any
        deleteOptions: (filters: any, options: any, headers?: {}) => any
        getPage: (data: any, page: any, options: any, headers?: {}) => any
        getRow: (data: any, options: any, headers?: {}) => any
        patch: (data: any, options: any, headers?: {}) => any
        post: (attributes: any, options: any, headers?: {}) => any
        deleteRequest: (filters: any, options: any, headers?: {}) => any
        getPageWithToken: (data: any, page: any, options: any, headers?: {}) => any
        getRowWithToken: (data: any, options: any, headers?: {}) => any
        patchWithToken: (data: any, options: any, headers?: {}) => any
        postWithToken: (attributes: any, options: any, headers?: {}) => any
        deleteWithToken: (filters: any, options: any, headers?: {}) => any
        options: (options: any) => any
    }
    filtersVM(attributes: any): Filter & { order: Filter } & {
        parameters: () => {
            order: string;
        } | {
            order?: undefined;
        };
        parametersWithoutOrder: () => {};
    }
    paginationVM: PaginationVMFunction
}

type PaginationVMFunction = (model: any, order: any, extraHeaders?: {}, authenticate?: boolean) => PaginationViewModelReturn

type PaginationViewModelReturn = {
    collection: prop<any[]>
    firstPage: (parameters: any) => Promise<unknown>
    isLoading: prop<boolean>
    nextPage: () => Promise<unknown>
    isLastPage: () => boolean
    total: prop<number>
    resultsCount: prop<number>
}

type AuthenticationOptions = {
    method: 'GET' | 'POST' | 'PUT'
    url: string
}

/**
 * This takes the mithril instance that will handle redraw 
 * on occurence of a dom element event or some m.request
 * call.
 * @param {Mithril} mithrilInstance 
 */
export default function Postgrest(mithrilInstance) {
    const m = mithrilInstance || mithril;
    const locker = new ExecutionLocker()
    const postgrest = {} as InnerPostgrestData

    const defaultIsTokenExpired = async (token: string) => false

    const token = prop<string>()

    const mergeConfig = (config, options) => {
        return options && _.isFunction(options.config) ? _.compose(options.config, config) : config
    }

    const addHeaders = (headers) => {
        return (xhr) => {
            _.each(headers, (value, key) => {
                xhr.setRequestHeader(key, value)
            })
            return xhr
        }
    }

    const addConfigHeaders = (headers, options) => {
        return _.extend({}, options, {
            config: mergeConfig(addHeaders(headers), options)
        })
    }

    const createLoader = (requestFunction, options, defaultState = false) => {
        const loader = prop(defaultState)
        const load = async () => {
            try {
                loader(true)
                const data = await requestFunction(_.extend({}, options, { background: false }))
                return data
            } catch(error) {                
                throw error
            } finally {
                loader(false)
            }
        }
        return Object.assign(loader, { load })
    }

    const representationHeader = {
        'Prefer': 'return=representation'
    }

    postgrest.token = token
    postgrest.init = (apiPrefix, authenticationOptions, globalHeader = {}, isExpired = defaultIsTokenExpired) => {
        postgrest.request = (options) => {
            const errorHandler = (xhr) => {
                try {
                    return JSON.parse(xhr.responseText)
                } catch (ex) {
                    return JSON.stringify({
                        hint: null,
                        details: null,
                        code: 0,
                        message: xhr.responseText
                    })
                }
            }
            const configHeadersToAdd = addConfigHeaders(globalHeader,
                _.extend({ extract: errorHandler }, options, { url: apiPrefix + options.url })
            )
            return m.request(configHeadersToAdd)
        }

        postgrest.authenticate = async () : Promise<{ token: string }> => {
            try {
                const notIsTokenExpired = !(await isExpired(token()))
                if (token() && notIsTokenExpired) {
                    return { token: token() }
                } else {
                    const data = await locker.lock<{ token: string }>('token', () => m.request({ ...authenticationOptions }))
                    token(data.token)
                    return { ...data }
                }
            } catch (error) {
                throw error
            }
        }

        postgrest.requestWithToken = async (options) => {
            try {
                const data = await postgrest.authenticate()
                const authorizationHeader = {
                    'Authorization': 'Bearer ' + data.token
                }
                const authenticatedOptions = addConfigHeaders(authorizationHeader, options)
                return postgrest.request(authenticatedOptions)
            } catch (error) {
                return postgrest.request(options)
            }
        }

        postgrest.loader = (options: { url?: string }, defaultState? : boolean) => {
            return createLoader(postgrest.request, options, defaultState)
        }

        postgrest.loaderWithToken = _.partial(createLoader, postgrest.requestWithToken)

        postgrest.model = (name) => {
            const paginationHeaders = (page, pageSize) => {
                if (!pageSize) {
                    return
                }

                const toRange = () => {
                    const from = (page - 1) * pageSize
                    const to = from + pageSize - 1
                    return from + '-' + to
                }

                return {
                    'Range-unit': 'items',
                    'Range': toRange()
                }
            }

            const pageSize = prop(10)

            const nameOptions = { url: '/' + name }

            const getOptions = (data, page, pageSize, options, headers = {}) => {
                const extraHeaders = _.extend({}, {
                    'Prefer': 'count=none'
                }, headers, paginationHeaders(page, pageSize));
                return addConfigHeaders(extraHeaders, _.extend({}, options, nameOptions, {
                    method: 'GET',
                    data: data
                }))
            }

            const querystring = (filters, options) => {
                options.url += '?' + m.buildQueryString(filters)
                return options
            }

            const options = (options) => {
                return postgrest.request(_.extend({}, options, nameOptions, { method: 'OPTIONS' }))
            }

            const postOptions = (attributes, options, headers = {}) => {
                const extraHeaders = _.extend({}, representationHeader, headers)
                return addConfigHeaders(
                    extraHeaders,
                    _.extend({},
                        options,
                        nameOptions, {
                            method: 'POST',
                            data: attributes
                        }
                    )
                )
            }

            const deleteOptions = (filters, options, headers = {}) => {
                const extraHeaders = _.extend({}, representationHeader, headers)
                return querystring(filters, addConfigHeaders(extraHeaders, _.extend({}, options, nameOptions, {
                    method: 'DELETE'
                })))
            }

            const patchOptions = (filters, attributes, options, headers = {}) => {
                const extraHeaders = _.extend({}, representationHeader, headers)
                return querystring(
                    filters,
                    addConfigHeaders(
                        extraHeaders,
                        _.extend({},
                            options,
                            nameOptions, {
                                method: 'PATCH',
                                data: attributes
                            }
                        )
                    )
                )
            }

            const getPageOptions = (data, page, options, headers = {}) => {
                return getOptions(data, (page || 1), pageSize(), options, headers)
            }

            const getRowOptions = (data, options, headers = {}) => {
                return getOptions(data, 1, 1, options, headers)
            }

            return {
                pageSize,
                getPageOptions,
                getRowOptions,
                patchOptions,
                postOptions,
                deleteOptions,
                getPage(data: any, page: any, options: any, headers?: {}) {
                    return postgrest.request(getPageOptions(data, page, options, headers))
                },
                getRow(data: any, options: any, headers?: {}) {
                    return postgrest.request(getRowOptions(data, options, headers))
                },
                patch(filters: any, attributes: any, options: any, headers?: {}) {
                    return postgrest.request(patchOptions(filters, attributes, options, headers))
                },
                post(attributes: any, options: any, headers?: {}) {
                    return postgrest.request(postOptions(attributes, options, headers))
                },
                deleteRequest(filters: any, options: any, headers?: {}) {
                    return postgrest.request(deleteOptions(filters, options, headers))
                },
                getPageWithToken(data: any, page: any, options: any, headers?: {}) {
                    return postgrest.requestWithToken(getPageOptions(data, page, options, headers))
                },
                getRowWithToken(data: any, options: any, headers?: {}) {
                    return postgrest.requestWithToken(getRowOptions(data, options, headers))
                },
                patchWithToken(filters: any, attributes: any, options: any, headers?: {}) {
                    return postgrest.requestWithToken(patchOptions(filters, attributes, options, headers))
                },
                postWithToken(attributes: any, options: any, headers?: {}) {
                    return postgrest.requestWithToken(postOptions(attributes, options, headers))
                },
                deleteWithToken(filters: any, options: any, headers?: {}) {
                    return postgrest.requestWithToken(deleteOptions(filters, options, headers))
                },
                options,
            };
        };

        return postgrest;
    };

    postgrest.filtersVM = filtersVM;
    postgrest.paginationVM = paginationVM(mithrilInstance) as PaginationVMFunction;

    return postgrest;
}