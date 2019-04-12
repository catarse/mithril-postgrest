(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('mithril/stream'), require('underscore'), require('mithril')) :
	typeof define === 'function' && define.amd ? define(['mithril/stream', 'underscore', 'mithril'], factory) :
	(global.Postgrest = factory(global.prop,global._,global.m));
}(this, (function (prop,_,mithril) { 'use strict';

prop = prop && prop.hasOwnProperty('default') ? prop['default'] : prop;
_ = _ && _.hasOwnProperty('default') ? _['default'] : _;
mithril = mithril && mithril.hasOwnProperty('default') ? mithril['default'] : mithril;

var filtersVM = function filtersVM(attributes) {
    var newVM = {},
        filter = function filter() {
        var innerProp = prop(''),
            filterProp = function filterProp(value) {
            if (arguments.length > 0) {
                innerProp(value);
                return newVM;
            }
            return innerProp();
        };
        // Just so we can have a default to_filter and avoid if _.isFunction calls
        filterProp.toFilter = function () {
            return _.isString(filterProp()) ? filterProp().trim() : filterProp();
        };
        return filterProp;
    },
        getters = _.reduce(attributes, function (memo, operator, attr) {
        // The operator between is implemented with two properties, one for greater than value and another for lesser than value.
        // Both properties are sent in the queurystring with the same name,
        // that's why we need the special case here, so we can use a simple map as argument to filtersVM.
        if (operator === 'between') {
            memo[attr] = {
                lte: filter(),
                gte: filter()
            };
        } else {
            memo[attr] = filter();
        }
        return memo;
    }, {
        order: filter()
    }),
        parametersWithoutOrder = function parametersWithoutOrder() {
        return _.reduce(getters, function (memo, getter, attr) {
            if (attr !== 'order') {
                var operator = attributes[attr];

                if (_.isFunction(getter.toFilter) && (getter.toFilter() === undefined || getter.toFilter() === '')) {
                    return memo;
                }

                // Bellow we use different formatting rules for the value depending on the operator
                // These rules are used regardless of the toFilter function,
                // so the user can use a custom toFilter without having to worry with basic filter syntax
                if (operator === 'ilike' || operator === 'like') {
                    memo[attr] = operator + '.*' + getter.toFilter() + '*';
                } else if (operator === '@@') {
                    memo[attr] = operator + '.' + getter.toFilter().replace(/\s+/g, '&');
                } else if (operator === 'between') {
                    if (!getter.lte.toFilter() && !getter.gte.toFilter()) {
                        return memo;
                    }
                    memo[attr] = [];
                    if (getter.gte()) {
                        memo[attr].push('gte.' + getter.gte.toFilter());
                    }
                    if (getter.lte()) {
                        memo[attr].push('lte.' + getter.lte.toFilter());
                    }
                } else if (operator === 'is.null') {
                    memo[attr] = getter.toFilter() === null ? 'is.null' : 'not.is.null';
                } else {
                    memo[attr] = operator + '.' + getter.toFilter();
                }
            }
            return memo;
        }, {});
    },
        parameters = function parameters() {
        // The order parameters have a special syntax (just like an order by SQL clause)
        // https://github.com/begriffs/postgrest/wiki/Routing#filtering-and-ordering
        var order = function order() {
            return getters.order() && _.reduce(getters.order(), function (memo, direction, attr) {
                memo.push(attr + '.' + direction);
                return memo;
            }, []).join(',');
        },
            orderParameter = order() ? {
            order: order()
        } : {};

        return _.extend({}, orderParameter, parametersWithoutOrder());
    };

    return _.extend(newVM, getters, {
        parameters: parameters,
        parametersWithoutOrder: parametersWithoutOrder
    });
};

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var paginationVM = function paginationVM(mithilInstance) {
    return function (model, order) {
        var extraHeaders = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
        var authenticate = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;

        var collection = prop([]),
            defaultOrder = order || 'id.desc',
            filters = prop({
            order: defaultOrder
        }),
            isLoading = prop(false),
            page = prop(1),
            resultsCount = prop(),
            pageRequest = authenticate ? model.getPageWithToken : model.getPage,
            total = prop();

        var fetch = function fetch() {
            return new Promise(function (resolve, reject) {

                var getTotal = function getTotal(xhr) {
                    if (!xhr || xhr.status === 0) {
                        return JSON.stringify({
                            hint: null,
                            details: null,
                            code: 0,
                            message: 'Connection error'
                        });
                    }
                    var rangeHeader = xhr.getResponseHeader('Content-Range');
                    if (_.isString(rangeHeader)) {
                        var _rangeHeader$split = rangeHeader.split('/'),
                            _rangeHeader$split2 = _slicedToArray(_rangeHeader$split, 2),
                            headerSize = _rangeHeader$split2[0],
                            headerCount = _rangeHeader$split2[1],
                            _headerSize$split = headerSize.split('-'),
                            _headerSize$split2 = _slicedToArray(_headerSize$split, 2),
                            headerFrom = _headerSize$split2[0],
                            headerTo = _headerSize$split2[1],
                            to = parseInt(headerTo) + 1 || 0,
                            from = parseInt(headerFrom) || 0;

                        total(parseInt(headerCount));
                        resultsCount(to - from);
                    }

                    try {
                        return JSON.parse(xhr.responseText);
                    } catch (ex) {
                        return JSON.stringify({
                            hint: null,
                            details: null,
                            code: 0,
                            message: xhr.responseText
                        });
                    }
                };
                isLoading(true);
                pageRequest(filters(), page(), {
                    background: false,
                    extract: getTotal
                }, extraHeaders).then(function (data) {
                    collection(_.union(collection(), data));
                    isLoading(false);
                    resolve(collection());
                }).catch(function (error) {
                    isLoading(false);
                    total(0);
                    reject(error);
                });
            });
        },
            firstPage = function firstPage(parameters) {
            filters(_.extend({
                order: defaultOrder
            }, parameters));
            collection([]);
            page(1);
            return fetch();
        },
            isLastPage = function isLastPage() {
            return model.pageSize() > resultsCount();
        },
            nextPage = function nextPage() {
            page(page() + 1);
            return fetch();
        };

        return {
            collection: collection,
            firstPage: firstPage,
            isLoading: isLoading,
            nextPage: nextPage,
            isLastPage: isLastPage,
            total: total,
            resultsCount: resultsCount
        };
    };
};

/**
 * This takes the mithril instance that will handle redraw 
 * on occurence of a dom element event or some m.request
 * call.
 * @param {Mithril} mithrilInstance 
 */
function Postgrest(mithrilInstance) {
    var m = mithrilInstance || mithril;
    var postgrest = {};
    var token = prop(),
        mergeConfig = function mergeConfig(config, options) {
        return options && _.isFunction(options.config) ? _.compose(options.config, config) : config;
    },
        addHeaders = function addHeaders(headers) {
        return function (xhr) {
            _.each(headers, function (value, key) {
                xhr.setRequestHeader(key, value);
            });
            return xhr;
        };
    },
        addConfigHeaders = function addConfigHeaders(headers, options) {
        return _.extend({}, options, {
            config: mergeConfig(addHeaders(headers), options)
        });
    },
        createLoader = function createLoader(requestFunction, options) {
        var defaultState = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

        var loader = prop(defaultState);
        loader.load = function () {

            return new Promise(function (resolve, reject) {
                loader(true);
                requestFunction(_.extend({}, options, {
                    background: false
                })).then(function (data) {
                    loader(false);
                    resolve(data);
                }).catch(function (error) {
                    loader(false);
                    reject(error);
                });
            });
        };
        return loader;
    },
        representationHeader = {
        'Prefer': 'return=representation'
    };

    postgrest.token = token;

    postgrest.init = function (apiPrefix, authenticationOptions) {
        var globalHeader = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

        postgrest.request = function (options) {
            var errorHandler = function errorHandler(xhr) {
                try {
                    return JSON.parse(xhr.responseText);
                } catch (ex) {
                    return JSON.stringify({
                        hint: null,
                        details: null,
                        code: 0,
                        message: xhr.responseText
                    });
                }
            };
            var configHeadersToAdd = addConfigHeaders(globalHeader, _.extend({ extract: errorHandler }, options, {
                url: apiPrefix + options.url
            }));
            return m.request(configHeadersToAdd);
        };

        var authenticationRequested = prop(false);
        postgrest.authenticate = function (delegatedDeferred) {
            var deferred = delegatedDeferred || new Promise(function (resolve, reject) {
                var workingCall = function workingCall() {
                    if (token()) {
                        resolve({ token: token() });
                    } else if (!authenticationRequested()) {

                        authenticationRequested(true);
                        m.request(_.extend({}, authenticationOptions)).then(function (data) {
                            authenticationRequested(false);
                            token(data.token);
                            resolve({ token: token() });
                        }).catch(function (data) {
                            authenticationRequested(false);
                            reject(data);
                        });
                    } else {
                        setTimeout(workingCall, 250);
                    }
                };
                workingCall();
            });
            return deferred;
        };

        postgrest.requestWithToken = function (options) {

            return postgrest.authenticate().then(function () {
                return postgrest.request(addConfigHeaders({
                    'Authorization': 'Bearer ' + token()
                }, options));
            }).catch(function () {
                return postgrest.request(options);
            });
        };

        postgrest.loader = _.partial(createLoader, postgrest.request);

        postgrest.loaderWithToken = _.partial(createLoader, postgrest.requestWithToken);

        postgrest.model = function (name) {
            var paginationHeaders = function paginationHeaders(page, pageSize) {
                if (!pageSize) {
                    return;
                }

                var toRange = function toRange() {
                    var from = (page - 1) * pageSize,
                        to = from + pageSize - 1;
                    return from + '-' + to;
                };

                return {
                    'Range-unit': 'items',
                    'Range': toRange()
                };
            },
                pageSize = prop(10),
                nameOptions = {
                url: '/' + name
            },
                getOptions = function getOptions(data, page, pageSize, options) {
                var headers = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};

                var extraHeaders = _.extend({}, {
                    'Prefer': 'count=none'
                }, headers, paginationHeaders(page, pageSize));
                return addConfigHeaders(extraHeaders, _.extend({}, options, nameOptions, {
                    method: 'GET',
                    data: data
                }));
            },
                querystring = function querystring(filters, options) {
                options.url += '?' + m.buildQueryString(filters);
                return options;
            },
                options = function options(_options) {
                return postgrest.request(_.extend({}, _options, nameOptions, {
                    method: 'OPTIONS'
                }));
            },
                postOptions = function postOptions(attributes, options) {
                var headers = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

                var extraHeaders = _.extend({}, representationHeader, headers);
                return addConfigHeaders(extraHeaders, _.extend({}, options, nameOptions, {
                    method: 'POST',
                    data: attributes
                }));
            },
                deleteOptions = function deleteOptions(filters, options) {
                var headers = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

                var extraHeaders = _.extend({}, representationHeader, headers);
                return querystring(filters, addConfigHeaders(extraHeaders, _.extend({}, options, nameOptions, {
                    method: 'DELETE'
                })));
            },
                patchOptions = function patchOptions(filters, attributes, options) {
                var headers = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

                var extraHeaders = _.extend({}, representationHeader, headers);
                return querystring(filters, addConfigHeaders(extraHeaders, _.extend({}, options, nameOptions, {
                    method: 'PATCH',
                    data: attributes
                })));
            },
                getPageOptions = function getPageOptions(data, page, options) {
                var headers = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

                return getOptions(data, page || 1, pageSize(), options, headers);
            },
                getRowOptions = function getRowOptions(data, options) {
                var headers = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

                return getOptions(data, 1, 1, options, headers);
            };

            return {
                pageSize: pageSize,
                getPageOptions: getPageOptions,
                getRowOptions: getRowOptions,
                patchOptions: patchOptions,
                postOptions: postOptions,
                deleteOptions: deleteOptions,
                getPage: _.compose(postgrest.request, getPageOptions),
                getRow: _.compose(postgrest.request, getRowOptions),
                patch: _.compose(postgrest.request, patchOptions),
                post: _.compose(postgrest.request, postOptions),
                deleteRequest: _.compose(postgrest.request, deleteOptions),
                getPageWithToken: _.compose(postgrest.requestWithToken, getPageOptions),
                getRowWithToken: _.compose(postgrest.requestWithToken, getRowOptions),
                patchWithToken: _.compose(postgrest.requestWithToken, patchOptions),
                postWithToken: _.compose(postgrest.requestWithToken, postOptions),
                deleteWithToken: _.compose(postgrest.requestWithToken, deleteOptions),
                options: options
            };
        };

        return postgrest;
    };

    postgrest.filtersVM = filtersVM;
    postgrest.paginationVM = paginationVM(mithrilInstance);

    return postgrest;
}

return Postgrest;

})));

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJzcmMvKiovKi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gKGdsb2JhbCwgZmFjdG9yeSkge1xuXHR0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgPyBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkocmVxdWlyZSgnbWl0aHJpbC9zdHJlYW0nKSwgcmVxdWlyZSgndW5kZXJzY29yZScpLCByZXF1aXJlKCdtaXRocmlsJykpIDpcblx0dHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kID8gZGVmaW5lKFsnbWl0aHJpbC9zdHJlYW0nLCAndW5kZXJzY29yZScsICdtaXRocmlsJ10sIGZhY3RvcnkpIDpcblx0KGdsb2JhbC5Qb3N0Z3Jlc3QgPSBmYWN0b3J5KGdsb2JhbC5wcm9wLGdsb2JhbC5fLGdsb2JhbC5tKSk7XG59KHRoaXMsIChmdW5jdGlvbiAocHJvcCxfLG1pdGhyaWwpIHsgJ3VzZSBzdHJpY3QnO1xuXG5wcm9wID0gcHJvcCAmJiBwcm9wLmhhc093blByb3BlcnR5KCdkZWZhdWx0JykgPyBwcm9wWydkZWZhdWx0J10gOiBwcm9wO1xuXyA9IF8gJiYgXy5oYXNPd25Qcm9wZXJ0eSgnZGVmYXVsdCcpID8gX1snZGVmYXVsdCddIDogXztcbm1pdGhyaWwgPSBtaXRocmlsICYmIG1pdGhyaWwuaGFzT3duUHJvcGVydHkoJ2RlZmF1bHQnKSA/IG1pdGhyaWxbJ2RlZmF1bHQnXSA6IG1pdGhyaWw7XG5cbnZhciBmaWx0ZXJzVk0gPSBmdW5jdGlvbiBmaWx0ZXJzVk0oYXR0cmlidXRlcykge1xuICAgIHZhciBuZXdWTSA9IHt9LFxuICAgICAgICBmaWx0ZXIgPSBmdW5jdGlvbiBmaWx0ZXIoKSB7XG4gICAgICAgIHZhciBpbm5lclByb3AgPSBwcm9wKCcnKSxcbiAgICAgICAgICAgIGZpbHRlclByb3AgPSBmdW5jdGlvbiBmaWx0ZXJQcm9wKHZhbHVlKSB7XG4gICAgICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBpbm5lclByb3AodmFsdWUpO1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXdWTTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBpbm5lclByb3AoKTtcbiAgICAgICAgfTtcbiAgICAgICAgLy8gSnVzdCBzbyB3ZSBjYW4gaGF2ZSBhIGRlZmF1bHQgdG9fZmlsdGVyIGFuZCBhdm9pZCBpZiBfLmlzRnVuY3Rpb24gY2FsbHNcbiAgICAgICAgZmlsdGVyUHJvcC50b0ZpbHRlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBfLmlzU3RyaW5nKGZpbHRlclByb3AoKSkgPyBmaWx0ZXJQcm9wKCkudHJpbSgpIDogZmlsdGVyUHJvcCgpO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gZmlsdGVyUHJvcDtcbiAgICB9LFxuICAgICAgICBnZXR0ZXJzID0gXy5yZWR1Y2UoYXR0cmlidXRlcywgZnVuY3Rpb24gKG1lbW8sIG9wZXJhdG9yLCBhdHRyKSB7XG4gICAgICAgIC8vIFRoZSBvcGVyYXRvciBiZXR3ZWVuIGlzIGltcGxlbWVudGVkIHdpdGggdHdvIHByb3BlcnRpZXMsIG9uZSBmb3IgZ3JlYXRlciB0aGFuIHZhbHVlIGFuZCBhbm90aGVyIGZvciBsZXNzZXIgdGhhbiB2YWx1ZS5cbiAgICAgICAgLy8gQm90aCBwcm9wZXJ0aWVzIGFyZSBzZW50IGluIHRoZSBxdWV1cnlzdHJpbmcgd2l0aCB0aGUgc2FtZSBuYW1lLFxuICAgICAgICAvLyB0aGF0J3Mgd2h5IHdlIG5lZWQgdGhlIHNwZWNpYWwgY2FzZSBoZXJlLCBzbyB3ZSBjYW4gdXNlIGEgc2ltcGxlIG1hcCBhcyBhcmd1bWVudCB0byBmaWx0ZXJzVk0uXG4gICAgICAgIGlmIChvcGVyYXRvciA9PT0gJ2JldHdlZW4nKSB7XG4gICAgICAgICAgICBtZW1vW2F0dHJdID0ge1xuICAgICAgICAgICAgICAgIGx0ZTogZmlsdGVyKCksXG4gICAgICAgICAgICAgICAgZ3RlOiBmaWx0ZXIoKVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1lbW9bYXR0cl0gPSBmaWx0ZXIoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWVtbztcbiAgICB9LCB7XG4gICAgICAgIG9yZGVyOiBmaWx0ZXIoKVxuICAgIH0pLFxuICAgICAgICBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyID0gZnVuY3Rpb24gcGFyYW1ldGVyc1dpdGhvdXRPcmRlcigpIHtcbiAgICAgICAgcmV0dXJuIF8ucmVkdWNlKGdldHRlcnMsIGZ1bmN0aW9uIChtZW1vLCBnZXR0ZXIsIGF0dHIpIHtcbiAgICAgICAgICAgIGlmIChhdHRyICE9PSAnb3JkZXInKSB7XG4gICAgICAgICAgICAgICAgdmFyIG9wZXJhdG9yID0gYXR0cmlidXRlc1thdHRyXTtcblxuICAgICAgICAgICAgICAgIGlmIChfLmlzRnVuY3Rpb24oZ2V0dGVyLnRvRmlsdGVyKSAmJiAoZ2V0dGVyLnRvRmlsdGVyKCkgPT09IHVuZGVmaW5lZCB8fCBnZXR0ZXIudG9GaWx0ZXIoKSA9PT0gJycpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIEJlbGxvdyB3ZSB1c2UgZGlmZmVyZW50IGZvcm1hdHRpbmcgcnVsZXMgZm9yIHRoZSB2YWx1ZSBkZXBlbmRpbmcgb24gdGhlIG9wZXJhdG9yXG4gICAgICAgICAgICAgICAgLy8gVGhlc2UgcnVsZXMgYXJlIHVzZWQgcmVnYXJkbGVzcyBvZiB0aGUgdG9GaWx0ZXIgZnVuY3Rpb24sXG4gICAgICAgICAgICAgICAgLy8gc28gdGhlIHVzZXIgY2FuIHVzZSBhIGN1c3RvbSB0b0ZpbHRlciB3aXRob3V0IGhhdmluZyB0byB3b3JyeSB3aXRoIGJhc2ljIGZpbHRlciBzeW50YXhcbiAgICAgICAgICAgICAgICBpZiAob3BlcmF0b3IgPT09ICdpbGlrZScgfHwgb3BlcmF0b3IgPT09ICdsaWtlJykge1xuICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gb3BlcmF0b3IgKyAnLionICsgZ2V0dGVyLnRvRmlsdGVyKCkgKyAnKic7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChvcGVyYXRvciA9PT0gJ0BAJykge1xuICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gb3BlcmF0b3IgKyAnLicgKyBnZXR0ZXIudG9GaWx0ZXIoKS5yZXBsYWNlKC9cXHMrL2csICcmJyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChvcGVyYXRvciA9PT0gJ2JldHdlZW4nKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZ2V0dGVyLmx0ZS50b0ZpbHRlcigpICYmICFnZXR0ZXIuZ3RlLnRvRmlsdGVyKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIG1lbW9bYXR0cl0gPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGdldHRlci5ndGUoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXS5wdXNoKCdndGUuJyArIGdldHRlci5ndGUudG9GaWx0ZXIoKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKGdldHRlci5sdGUoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXS5wdXNoKCdsdGUuJyArIGdldHRlci5sdGUudG9GaWx0ZXIoKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG9wZXJhdG9yID09PSAnaXMubnVsbCcpIHtcbiAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IGdldHRlci50b0ZpbHRlcigpID09PSBudWxsID8gJ2lzLm51bGwnIDogJ25vdC5pcy5udWxsJztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gb3BlcmF0b3IgKyAnLicgKyBnZXR0ZXIudG9GaWx0ZXIoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgfSwge30pO1xuICAgIH0sXG4gICAgICAgIHBhcmFtZXRlcnMgPSBmdW5jdGlvbiBwYXJhbWV0ZXJzKCkge1xuICAgICAgICAvLyBUaGUgb3JkZXIgcGFyYW1ldGVycyBoYXZlIGEgc3BlY2lhbCBzeW50YXggKGp1c3QgbGlrZSBhbiBvcmRlciBieSBTUUwgY2xhdXNlKVxuICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vYmVncmlmZnMvcG9zdGdyZXN0L3dpa2kvUm91dGluZyNmaWx0ZXJpbmctYW5kLW9yZGVyaW5nXG4gICAgICAgIHZhciBvcmRlciA9IGZ1bmN0aW9uIG9yZGVyKCkge1xuICAgICAgICAgICAgcmV0dXJuIGdldHRlcnMub3JkZXIoKSAmJiBfLnJlZHVjZShnZXR0ZXJzLm9yZGVyKCksIGZ1bmN0aW9uIChtZW1vLCBkaXJlY3Rpb24sIGF0dHIpIHtcbiAgICAgICAgICAgICAgICBtZW1vLnB1c2goYXR0ciArICcuJyArIGRpcmVjdGlvbik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgICAgICB9LCBbXSkuam9pbignLCcpO1xuICAgICAgICB9LFxuICAgICAgICAgICAgb3JkZXJQYXJhbWV0ZXIgPSBvcmRlcigpID8ge1xuICAgICAgICAgICAgb3JkZXI6IG9yZGVyKClcbiAgICAgICAgfSA6IHt9O1xuXG4gICAgICAgIHJldHVybiBfLmV4dGVuZCh7fSwgb3JkZXJQYXJhbWV0ZXIsIHBhcmFtZXRlcnNXaXRob3V0T3JkZXIoKSk7XG4gICAgfTtcblxuICAgIHJldHVybiBfLmV4dGVuZChuZXdWTSwgZ2V0dGVycywge1xuICAgICAgICBwYXJhbWV0ZXJzOiBwYXJhbWV0ZXJzLFxuICAgICAgICBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyOiBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyXG4gICAgfSk7XG59O1xuXG52YXIgX3NsaWNlZFRvQXJyYXkgPSBmdW5jdGlvbiAoKSB7IGZ1bmN0aW9uIHNsaWNlSXRlcmF0b3IoYXJyLCBpKSB7IHZhciBfYXJyID0gW107IHZhciBfbiA9IHRydWU7IHZhciBfZCA9IGZhbHNlOyB2YXIgX2UgPSB1bmRlZmluZWQ7IHRyeSB7IGZvciAodmFyIF9pID0gYXJyW1N5bWJvbC5pdGVyYXRvcl0oKSwgX3M7ICEoX24gPSAoX3MgPSBfaS5uZXh0KCkpLmRvbmUpOyBfbiA9IHRydWUpIHsgX2Fyci5wdXNoKF9zLnZhbHVlKTsgaWYgKGkgJiYgX2Fyci5sZW5ndGggPT09IGkpIGJyZWFrOyB9IH0gY2F0Y2ggKGVycikgeyBfZCA9IHRydWU7IF9lID0gZXJyOyB9IGZpbmFsbHkgeyB0cnkgeyBpZiAoIV9uICYmIF9pW1wicmV0dXJuXCJdKSBfaVtcInJldHVyblwiXSgpOyB9IGZpbmFsbHkgeyBpZiAoX2QpIHRocm93IF9lOyB9IH0gcmV0dXJuIF9hcnI7IH0gcmV0dXJuIGZ1bmN0aW9uIChhcnIsIGkpIHsgaWYgKEFycmF5LmlzQXJyYXkoYXJyKSkgeyByZXR1cm4gYXJyOyB9IGVsc2UgaWYgKFN5bWJvbC5pdGVyYXRvciBpbiBPYmplY3QoYXJyKSkgeyByZXR1cm4gc2xpY2VJdGVyYXRvcihhcnIsIGkpOyB9IGVsc2UgeyB0aHJvdyBuZXcgVHlwZUVycm9yKFwiSW52YWxpZCBhdHRlbXB0IHRvIGRlc3RydWN0dXJlIG5vbi1pdGVyYWJsZSBpbnN0YW5jZVwiKTsgfSB9OyB9KCk7XG5cbnZhciBwYWdpbmF0aW9uVk0gPSBmdW5jdGlvbiBwYWdpbmF0aW9uVk0obWl0aGlsSW5zdGFuY2UpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKG1vZGVsLCBvcmRlcikge1xuICAgICAgICB2YXIgZXh0cmFIZWFkZXJzID0gYXJndW1lbnRzLmxlbmd0aCA+IDIgJiYgYXJndW1lbnRzWzJdICE9PSB1bmRlZmluZWQgPyBhcmd1bWVudHNbMl0gOiB7fTtcbiAgICAgICAgdmFyIGF1dGhlbnRpY2F0ZSA9IGFyZ3VtZW50cy5sZW5ndGggPiAzICYmIGFyZ3VtZW50c1szXSAhPT0gdW5kZWZpbmVkID8gYXJndW1lbnRzWzNdIDogdHJ1ZTtcblxuICAgICAgICB2YXIgY29sbGVjdGlvbiA9IHByb3AoW10pLFxuICAgICAgICAgICAgZGVmYXVsdE9yZGVyID0gb3JkZXIgfHwgJ2lkLmRlc2MnLFxuICAgICAgICAgICAgZmlsdGVycyA9IHByb3Aoe1xuICAgICAgICAgICAgb3JkZXI6IGRlZmF1bHRPcmRlclxuICAgICAgICB9KSxcbiAgICAgICAgICAgIGlzTG9hZGluZyA9IHByb3AoZmFsc2UpLFxuICAgICAgICAgICAgcGFnZSA9IHByb3AoMSksXG4gICAgICAgICAgICByZXN1bHRzQ291bnQgPSBwcm9wKCksXG4gICAgICAgICAgICBwYWdlUmVxdWVzdCA9IGF1dGhlbnRpY2F0ZSA/IG1vZGVsLmdldFBhZ2VXaXRoVG9rZW4gOiBtb2RlbC5nZXRQYWdlLFxuICAgICAgICAgICAgdG90YWwgPSBwcm9wKCk7XG5cbiAgICAgICAgdmFyIGZldGNoID0gZnVuY3Rpb24gZmV0Y2goKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuXG4gICAgICAgICAgICAgICAgdmFyIGdldFRvdGFsID0gZnVuY3Rpb24gZ2V0VG90YWwoeGhyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICgheGhyIHx8IHhoci5zdGF0dXMgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGludDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXRhaWxzOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJ0Nvbm5lY3Rpb24gZXJyb3InXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB2YXIgcmFuZ2VIZWFkZXIgPSB4aHIuZ2V0UmVzcG9uc2VIZWFkZXIoJ0NvbnRlbnQtUmFuZ2UnKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKF8uaXNTdHJpbmcocmFuZ2VIZWFkZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgX3JhbmdlSGVhZGVyJHNwbGl0ID0gcmFuZ2VIZWFkZXIuc3BsaXQoJy8nKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfcmFuZ2VIZWFkZXIkc3BsaXQyID0gX3NsaWNlZFRvQXJyYXkoX3JhbmdlSGVhZGVyJHNwbGl0LCAyKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoZWFkZXJTaXplID0gX3JhbmdlSGVhZGVyJHNwbGl0MlswXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoZWFkZXJDb3VudCA9IF9yYW5nZUhlYWRlciRzcGxpdDJbMV0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX2hlYWRlclNpemUkc3BsaXQgPSBoZWFkZXJTaXplLnNwbGl0KCctJyksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX2hlYWRlclNpemUkc3BsaXQyID0gX3NsaWNlZFRvQXJyYXkoX2hlYWRlclNpemUkc3BsaXQsIDIpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlYWRlckZyb20gPSBfaGVhZGVyU2l6ZSRzcGxpdDJbMF0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVhZGVyVG8gPSBfaGVhZGVyU2l6ZSRzcGxpdDJbMV0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdG8gPSBwYXJzZUludChoZWFkZXJUbykgKyAxIHx8IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJvbSA9IHBhcnNlSW50KGhlYWRlckZyb20pIHx8IDA7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRvdGFsKHBhcnNlSW50KGhlYWRlckNvdW50KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHRzQ291bnQodG8gLSBmcm9tKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5wYXJzZSh4aHIucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGludDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXRhaWxzOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogeGhyLnJlc3BvbnNlVGV4dFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGlzTG9hZGluZyh0cnVlKTtcbiAgICAgICAgICAgICAgICBwYWdlUmVxdWVzdChmaWx0ZXJzKCksIHBhZ2UoKSwge1xuICAgICAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZXh0cmFjdDogZ2V0VG90YWxcbiAgICAgICAgICAgICAgICB9LCBleHRyYUhlYWRlcnMpLnRoZW4oZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbihfLnVuaW9uKGNvbGxlY3Rpb24oKSwgZGF0YSkpO1xuICAgICAgICAgICAgICAgICAgICBpc0xvYWRpbmcoZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGNvbGxlY3Rpb24oKSk7XG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGlzTG9hZGluZyhmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgIHRvdGFsKDApO1xuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgICAgICBmaXJzdFBhZ2UgPSBmdW5jdGlvbiBmaXJzdFBhZ2UocGFyYW1ldGVycykge1xuICAgICAgICAgICAgZmlsdGVycyhfLmV4dGVuZCh7XG4gICAgICAgICAgICAgICAgb3JkZXI6IGRlZmF1bHRPcmRlclxuICAgICAgICAgICAgfSwgcGFyYW1ldGVycykpO1xuICAgICAgICAgICAgY29sbGVjdGlvbihbXSk7XG4gICAgICAgICAgICBwYWdlKDEpO1xuICAgICAgICAgICAgcmV0dXJuIGZldGNoKCk7XG4gICAgICAgIH0sXG4gICAgICAgICAgICBpc0xhc3RQYWdlID0gZnVuY3Rpb24gaXNMYXN0UGFnZSgpIHtcbiAgICAgICAgICAgIHJldHVybiBtb2RlbC5wYWdlU2l6ZSgpID4gcmVzdWx0c0NvdW50KCk7XG4gICAgICAgIH0sXG4gICAgICAgICAgICBuZXh0UGFnZSA9IGZ1bmN0aW9uIG5leHRQYWdlKCkge1xuICAgICAgICAgICAgcGFnZShwYWdlKCkgKyAxKTtcbiAgICAgICAgICAgIHJldHVybiBmZXRjaCgpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uLFxuICAgICAgICAgICAgZmlyc3RQYWdlOiBmaXJzdFBhZ2UsXG4gICAgICAgICAgICBpc0xvYWRpbmc6IGlzTG9hZGluZyxcbiAgICAgICAgICAgIG5leHRQYWdlOiBuZXh0UGFnZSxcbiAgICAgICAgICAgIGlzTGFzdFBhZ2U6IGlzTGFzdFBhZ2UsXG4gICAgICAgICAgICB0b3RhbDogdG90YWwsXG4gICAgICAgICAgICByZXN1bHRzQ291bnQ6IHJlc3VsdHNDb3VudFxuICAgICAgICB9O1xuICAgIH07XG59O1xuXG4vKipcbiAqIFRoaXMgdGFrZXMgdGhlIG1pdGhyaWwgaW5zdGFuY2UgdGhhdCB3aWxsIGhhbmRsZSByZWRyYXcgXG4gKiBvbiBvY2N1cmVuY2Ugb2YgYSBkb20gZWxlbWVudCBldmVudCBvciBzb21lIG0ucmVxdWVzdFxuICogY2FsbC5cbiAqIEBwYXJhbSB7TWl0aHJpbH0gbWl0aHJpbEluc3RhbmNlIFxuICovXG5mdW5jdGlvbiBQb3N0Z3Jlc3QobWl0aHJpbEluc3RhbmNlKSB7XG4gICAgdmFyIG0gPSBtaXRocmlsSW5zdGFuY2UgfHwgbWl0aHJpbDtcbiAgICB2YXIgcG9zdGdyZXN0ID0ge307XG4gICAgdmFyIHRva2VuID0gcHJvcCgpLFxuICAgICAgICBtZXJnZUNvbmZpZyA9IGZ1bmN0aW9uIG1lcmdlQ29uZmlnKGNvbmZpZywgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gb3B0aW9ucyAmJiBfLmlzRnVuY3Rpb24ob3B0aW9ucy5jb25maWcpID8gXy5jb21wb3NlKG9wdGlvbnMuY29uZmlnLCBjb25maWcpIDogY29uZmlnO1xuICAgIH0sXG4gICAgICAgIGFkZEhlYWRlcnMgPSBmdW5jdGlvbiBhZGRIZWFkZXJzKGhlYWRlcnMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICh4aHIpIHtcbiAgICAgICAgICAgIF8uZWFjaChoZWFkZXJzLCBmdW5jdGlvbiAodmFsdWUsIGtleSkge1xuICAgICAgICAgICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKGtleSwgdmFsdWUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4geGhyO1xuICAgICAgICB9O1xuICAgIH0sXG4gICAgICAgIGFkZENvbmZpZ0hlYWRlcnMgPSBmdW5jdGlvbiBhZGRDb25maWdIZWFkZXJzKGhlYWRlcnMsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIF8uZXh0ZW5kKHt9LCBvcHRpb25zLCB7XG4gICAgICAgICAgICBjb25maWc6IG1lcmdlQ29uZmlnKGFkZEhlYWRlcnMoaGVhZGVycyksIG9wdGlvbnMpXG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgICAgIGNyZWF0ZUxvYWRlciA9IGZ1bmN0aW9uIGNyZWF0ZUxvYWRlcihyZXF1ZXN0RnVuY3Rpb24sIG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIGRlZmF1bHRTdGF0ZSA9IGFyZ3VtZW50cy5sZW5ndGggPiAyICYmIGFyZ3VtZW50c1syXSAhPT0gdW5kZWZpbmVkID8gYXJndW1lbnRzWzJdIDogZmFsc2U7XG5cbiAgICAgICAgdmFyIGxvYWRlciA9IHByb3AoZGVmYXVsdFN0YXRlKTtcbiAgICAgICAgbG9hZGVyLmxvYWQgPSBmdW5jdGlvbiAoKSB7XG5cbiAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICAgICAgbG9hZGVyKHRydWUpO1xuICAgICAgICAgICAgICAgIHJlcXVlc3RGdW5jdGlvbihfLmV4dGVuZCh7fSwgb3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kOiBmYWxzZVxuICAgICAgICAgICAgICAgIH0pKS50aGVuKGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvYWRlcihmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoZGF0YSk7XG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvYWRlcihmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIGxvYWRlcjtcbiAgICB9LFxuICAgICAgICByZXByZXNlbnRhdGlvbkhlYWRlciA9IHtcbiAgICAgICAgJ1ByZWZlcic6ICdyZXR1cm49cmVwcmVzZW50YXRpb24nXG4gICAgfTtcblxuICAgIHBvc3RncmVzdC50b2tlbiA9IHRva2VuO1xuXG4gICAgcG9zdGdyZXN0LmluaXQgPSBmdW5jdGlvbiAoYXBpUHJlZml4LCBhdXRoZW50aWNhdGlvbk9wdGlvbnMpIHtcbiAgICAgICAgdmFyIGdsb2JhbEhlYWRlciA9IGFyZ3VtZW50cy5sZW5ndGggPiAyICYmIGFyZ3VtZW50c1syXSAhPT0gdW5kZWZpbmVkID8gYXJndW1lbnRzWzJdIDoge307XG5cbiAgICAgICAgcG9zdGdyZXN0LnJlcXVlc3QgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAgICAgdmFyIGVycm9ySGFuZGxlciA9IGZ1bmN0aW9uIGVycm9ySGFuZGxlcih4aHIpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5wYXJzZSh4aHIucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgaGludDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldGFpbHM6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogeGhyLnJlc3BvbnNlVGV4dFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdmFyIGNvbmZpZ0hlYWRlcnNUb0FkZCA9IGFkZENvbmZpZ0hlYWRlcnMoZ2xvYmFsSGVhZGVyLCBfLmV4dGVuZCh7IGV4dHJhY3Q6IGVycm9ySGFuZGxlciB9LCBvcHRpb25zLCB7XG4gICAgICAgICAgICAgICAgdXJsOiBhcGlQcmVmaXggKyBvcHRpb25zLnVybFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgcmV0dXJuIG0ucmVxdWVzdChjb25maWdIZWFkZXJzVG9BZGQpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHZhciBhdXRoZW50aWNhdGlvblJlcXVlc3RlZCA9IHByb3AoZmFsc2UpO1xuICAgICAgICBwb3N0Z3Jlc3QuYXV0aGVudGljYXRlID0gZnVuY3Rpb24gKGRlbGVnYXRlZERlZmVycmVkKSB7XG4gICAgICAgICAgICB2YXIgZGVmZXJyZWQgPSBkZWxlZ2F0ZWREZWZlcnJlZCB8fCBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICAgICAgdmFyIHdvcmtpbmdDYWxsID0gZnVuY3Rpb24gd29ya2luZ0NhbGwoKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0b2tlbigpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHsgdG9rZW46IHRva2VuKCkgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIWF1dGhlbnRpY2F0aW9uUmVxdWVzdGVkKCkpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgYXV0aGVudGljYXRpb25SZXF1ZXN0ZWQodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBtLnJlcXVlc3QoXy5leHRlbmQoe30sIGF1dGhlbnRpY2F0aW9uT3B0aW9ucykpLnRoZW4oZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhdXRoZW50aWNhdGlvblJlcXVlc3RlZChmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdG9rZW4oZGF0YS50b2tlbik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh7IHRva2VuOiB0b2tlbigpIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhdXRoZW50aWNhdGlvblJlcXVlc3RlZChmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KHdvcmtpbmdDYWxsLCAyNTApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB3b3JraW5nQ2FsbCgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gZGVmZXJyZWQ7XG4gICAgICAgIH07XG5cbiAgICAgICAgcG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4gPSBmdW5jdGlvbiAob3B0aW9ucykge1xuXG4gICAgICAgICAgICByZXR1cm4gcG9zdGdyZXN0LmF1dGhlbnRpY2F0ZSgpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBwb3N0Z3Jlc3QucmVxdWVzdChhZGRDb25maWdIZWFkZXJzKHtcbiAgICAgICAgICAgICAgICAgICAgJ0F1dGhvcml6YXRpb24nOiAnQmVhcmVyICcgKyB0b2tlbigpXG4gICAgICAgICAgICAgICAgfSwgb3B0aW9ucykpO1xuICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBwb3N0Z3Jlc3QucmVxdWVzdChvcHRpb25zKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIHBvc3RncmVzdC5sb2FkZXIgPSBfLnBhcnRpYWwoY3JlYXRlTG9hZGVyLCBwb3N0Z3Jlc3QucmVxdWVzdCk7XG5cbiAgICAgICAgcG9zdGdyZXN0LmxvYWRlcldpdGhUb2tlbiA9IF8ucGFydGlhbChjcmVhdGVMb2FkZXIsIHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuKTtcblxuICAgICAgICBwb3N0Z3Jlc3QubW9kZWwgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICAgICAgdmFyIHBhZ2luYXRpb25IZWFkZXJzID0gZnVuY3Rpb24gcGFnaW5hdGlvbkhlYWRlcnMocGFnZSwgcGFnZVNpemUpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXBhZ2VTaXplKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2YXIgdG9SYW5nZSA9IGZ1bmN0aW9uIHRvUmFuZ2UoKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBmcm9tID0gKHBhZ2UgLSAxKSAqIHBhZ2VTaXplLFxuICAgICAgICAgICAgICAgICAgICAgICAgdG8gPSBmcm9tICsgcGFnZVNpemUgLSAxO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZnJvbSArICctJyArIHRvO1xuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAnUmFuZ2UtdW5pdCc6ICdpdGVtcycsXG4gICAgICAgICAgICAgICAgICAgICdSYW5nZSc6IHRvUmFuZ2UoKVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHBhZ2VTaXplID0gcHJvcCgxMCksXG4gICAgICAgICAgICAgICAgbmFtZU9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgdXJsOiAnLycgKyBuYW1lXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGdldE9wdGlvbnMgPSBmdW5jdGlvbiBnZXRPcHRpb25zKGRhdGEsIHBhZ2UsIHBhZ2VTaXplLCBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgdmFyIGhlYWRlcnMgPSBhcmd1bWVudHMubGVuZ3RoID4gNCAmJiBhcmd1bWVudHNbNF0gIT09IHVuZGVmaW5lZCA/IGFyZ3VtZW50c1s0XSA6IHt9O1xuXG4gICAgICAgICAgICAgICAgdmFyIGV4dHJhSGVhZGVycyA9IF8uZXh0ZW5kKHt9LCB7XG4gICAgICAgICAgICAgICAgICAgICdQcmVmZXInOiAnY291bnQ9bm9uZSdcbiAgICAgICAgICAgICAgICB9LCBoZWFkZXJzLCBwYWdpbmF0aW9uSGVhZGVycyhwYWdlLCBwYWdlU2l6ZSkpO1xuICAgICAgICAgICAgICAgIHJldHVybiBhZGRDb25maWdIZWFkZXJzKGV4dHJhSGVhZGVycywgXy5leHRlbmQoe30sIG9wdGlvbnMsIG5hbWVPcHRpb25zLCB7XG4gICAgICAgICAgICAgICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IGRhdGFcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHF1ZXJ5c3RyaW5nID0gZnVuY3Rpb24gcXVlcnlzdHJpbmcoZmlsdGVycywgb3B0aW9ucykge1xuICAgICAgICAgICAgICAgIG9wdGlvbnMudXJsICs9ICc/JyArIG0uYnVpbGRRdWVyeVN0cmluZyhmaWx0ZXJzKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gb3B0aW9ucztcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgb3B0aW9ucyA9IGZ1bmN0aW9uIG9wdGlvbnMoX29wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcG9zdGdyZXN0LnJlcXVlc3QoXy5leHRlbmQoe30sIF9vcHRpb25zLCBuYW1lT3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdPUFRJT05TJ1xuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcG9zdE9wdGlvbnMgPSBmdW5jdGlvbiBwb3N0T3B0aW9ucyhhdHRyaWJ1dGVzLCBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgdmFyIGhlYWRlcnMgPSBhcmd1bWVudHMubGVuZ3RoID4gMiAmJiBhcmd1bWVudHNbMl0gIT09IHVuZGVmaW5lZCA/IGFyZ3VtZW50c1syXSA6IHt9O1xuXG4gICAgICAgICAgICAgICAgdmFyIGV4dHJhSGVhZGVycyA9IF8uZXh0ZW5kKHt9LCByZXByZXNlbnRhdGlvbkhlYWRlciwgaGVhZGVycyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGFkZENvbmZpZ0hlYWRlcnMoZXh0cmFIZWFkZXJzLCBfLmV4dGVuZCh7fSwgb3B0aW9ucywgbmFtZU9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IGF0dHJpYnV0ZXNcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGRlbGV0ZU9wdGlvbnMgPSBmdW5jdGlvbiBkZWxldGVPcHRpb25zKGZpbHRlcnMsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICB2YXIgaGVhZGVycyA9IGFyZ3VtZW50cy5sZW5ndGggPiAyICYmIGFyZ3VtZW50c1syXSAhPT0gdW5kZWZpbmVkID8gYXJndW1lbnRzWzJdIDoge307XG5cbiAgICAgICAgICAgICAgICB2YXIgZXh0cmFIZWFkZXJzID0gXy5leHRlbmQoe30sIHJlcHJlc2VudGF0aW9uSGVhZGVyLCBoZWFkZXJzKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcXVlcnlzdHJpbmcoZmlsdGVycywgYWRkQ29uZmlnSGVhZGVycyhleHRyYUhlYWRlcnMsIF8uZXh0ZW5kKHt9LCBvcHRpb25zLCBuYW1lT3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdERUxFVEUnXG4gICAgICAgICAgICAgICAgfSkpKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcGF0Y2hPcHRpb25zID0gZnVuY3Rpb24gcGF0Y2hPcHRpb25zKGZpbHRlcnMsIGF0dHJpYnV0ZXMsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICB2YXIgaGVhZGVycyA9IGFyZ3VtZW50cy5sZW5ndGggPiAzICYmIGFyZ3VtZW50c1szXSAhPT0gdW5kZWZpbmVkID8gYXJndW1lbnRzWzNdIDoge307XG5cbiAgICAgICAgICAgICAgICB2YXIgZXh0cmFIZWFkZXJzID0gXy5leHRlbmQoe30sIHJlcHJlc2VudGF0aW9uSGVhZGVyLCBoZWFkZXJzKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcXVlcnlzdHJpbmcoZmlsdGVycywgYWRkQ29uZmlnSGVhZGVycyhleHRyYUhlYWRlcnMsIF8uZXh0ZW5kKHt9LCBvcHRpb25zLCBuYW1lT3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdQQVRDSCcsXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IGF0dHJpYnV0ZXNcbiAgICAgICAgICAgICAgICB9KSkpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBnZXRQYWdlT3B0aW9ucyA9IGZ1bmN0aW9uIGdldFBhZ2VPcHRpb25zKGRhdGEsIHBhZ2UsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICB2YXIgaGVhZGVycyA9IGFyZ3VtZW50cy5sZW5ndGggPiAzICYmIGFyZ3VtZW50c1szXSAhPT0gdW5kZWZpbmVkID8gYXJndW1lbnRzWzNdIDoge307XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gZ2V0T3B0aW9ucyhkYXRhLCBwYWdlIHx8IDEsIHBhZ2VTaXplKCksIG9wdGlvbnMsIGhlYWRlcnMpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBnZXRSb3dPcHRpb25zID0gZnVuY3Rpb24gZ2V0Um93T3B0aW9ucyhkYXRhLCBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgdmFyIGhlYWRlcnMgPSBhcmd1bWVudHMubGVuZ3RoID4gMiAmJiBhcmd1bWVudHNbMl0gIT09IHVuZGVmaW5lZCA/IGFyZ3VtZW50c1syXSA6IHt9O1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGdldE9wdGlvbnMoZGF0YSwgMSwgMSwgb3B0aW9ucywgaGVhZGVycyk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHBhZ2VTaXplOiBwYWdlU2l6ZSxcbiAgICAgICAgICAgICAgICBnZXRQYWdlT3B0aW9uczogZ2V0UGFnZU9wdGlvbnMsXG4gICAgICAgICAgICAgICAgZ2V0Um93T3B0aW9uczogZ2V0Um93T3B0aW9ucyxcbiAgICAgICAgICAgICAgICBwYXRjaE9wdGlvbnM6IHBhdGNoT3B0aW9ucyxcbiAgICAgICAgICAgICAgICBwb3N0T3B0aW9uczogcG9zdE9wdGlvbnMsXG4gICAgICAgICAgICAgICAgZGVsZXRlT3B0aW9uczogZGVsZXRlT3B0aW9ucyxcbiAgICAgICAgICAgICAgICBnZXRQYWdlOiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIGdldFBhZ2VPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBnZXRSb3c6IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgZ2V0Um93T3B0aW9ucyksXG4gICAgICAgICAgICAgICAgcGF0Y2g6IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgcGF0Y2hPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBwb3N0OiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIHBvc3RPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBkZWxldGVSZXF1ZXN0OiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIGRlbGV0ZU9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIGdldFBhZ2VXaXRoVG9rZW46IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgZ2V0UGFnZU9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIGdldFJvd1dpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBnZXRSb3dPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBwYXRjaFdpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBwYXRjaE9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIHBvc3RXaXRoVG9rZW46IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgcG9zdE9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIGRlbGV0ZVdpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBkZWxldGVPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBvcHRpb25zOiBvcHRpb25zXG4gICAgICAgICAgICB9O1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiBwb3N0Z3Jlc3Q7XG4gICAgfTtcblxuICAgIHBvc3RncmVzdC5maWx0ZXJzVk0gPSBmaWx0ZXJzVk07XG4gICAgcG9zdGdyZXN0LnBhZ2luYXRpb25WTSA9IHBhZ2luYXRpb25WTShtaXRocmlsSW5zdGFuY2UpO1xuXG4gICAgcmV0dXJuIHBvc3RncmVzdDtcbn1cblxucmV0dXJuIFBvc3RncmVzdDtcblxufSkpKTtcbiJdLCJmaWxlIjoic3JjLyoqLyouanMifQ==
