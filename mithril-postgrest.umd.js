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

        function objectToLogicOperation(obj) {
            return '(' + Object.keys(obj).map(function (key) {
                if (key === 'or' || key === 'and') {
                    return '' + key + objectToLogicOperation(obj[key]);
                } else {
                    return '' + Object.keys(obj[key]).map(function (innerKey) {
                        if (innerKey === 'or' || innerKey === 'and') {
                            return '' + innerKey + objectToLogicOperation(obj[key][innerKey]);
                        } else {
                            return key + '.' + innerKey + '.' + obj[key][innerKey];
                        }
                    }).join(',');
                }
            }).join(',') + ')';
        }

        filterProp.logicOperators = function () {
            return objectToLogicOperation(filterProp.toFilter());
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
                } else if (operator === 'or' || operator === 'and') {
                    memo[operator] = getter.logicOperators();
                } else if (operator === 'select') {
                    memo[operator] = getter.toFilter();
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJzcmMvKiovKi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gKGdsb2JhbCwgZmFjdG9yeSkge1xuXHR0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgPyBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkocmVxdWlyZSgnbWl0aHJpbC9zdHJlYW0nKSwgcmVxdWlyZSgndW5kZXJzY29yZScpLCByZXF1aXJlKCdtaXRocmlsJykpIDpcblx0dHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kID8gZGVmaW5lKFsnbWl0aHJpbC9zdHJlYW0nLCAndW5kZXJzY29yZScsICdtaXRocmlsJ10sIGZhY3RvcnkpIDpcblx0KGdsb2JhbC5Qb3N0Z3Jlc3QgPSBmYWN0b3J5KGdsb2JhbC5wcm9wLGdsb2JhbC5fLGdsb2JhbC5tKSk7XG59KHRoaXMsIChmdW5jdGlvbiAocHJvcCxfLG1pdGhyaWwpIHsgJ3VzZSBzdHJpY3QnO1xuXG5wcm9wID0gcHJvcCAmJiBwcm9wLmhhc093blByb3BlcnR5KCdkZWZhdWx0JykgPyBwcm9wWydkZWZhdWx0J10gOiBwcm9wO1xuXyA9IF8gJiYgXy5oYXNPd25Qcm9wZXJ0eSgnZGVmYXVsdCcpID8gX1snZGVmYXVsdCddIDogXztcbm1pdGhyaWwgPSBtaXRocmlsICYmIG1pdGhyaWwuaGFzT3duUHJvcGVydHkoJ2RlZmF1bHQnKSA/IG1pdGhyaWxbJ2RlZmF1bHQnXSA6IG1pdGhyaWw7XG5cbnZhciBmaWx0ZXJzVk0gPSBmdW5jdGlvbiBmaWx0ZXJzVk0oYXR0cmlidXRlcykge1xuICAgIHZhciBuZXdWTSA9IHt9LFxuICAgICAgICBmaWx0ZXIgPSBmdW5jdGlvbiBmaWx0ZXIoKSB7XG4gICAgICAgIHZhciBpbm5lclByb3AgPSBwcm9wKCcnKSxcbiAgICAgICAgICAgIGZpbHRlclByb3AgPSBmdW5jdGlvbiBmaWx0ZXJQcm9wKHZhbHVlKSB7XG4gICAgICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBpbm5lclByb3AodmFsdWUpO1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXdWTTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBpbm5lclByb3AoKTtcbiAgICAgICAgfTtcbiAgICAgICAgLy8gSnVzdCBzbyB3ZSBjYW4gaGF2ZSBhIGRlZmF1bHQgdG9fZmlsdGVyIGFuZCBhdm9pZCBpZiBfLmlzRnVuY3Rpb24gY2FsbHNcbiAgICAgICAgZmlsdGVyUHJvcC50b0ZpbHRlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBfLmlzU3RyaW5nKGZpbHRlclByb3AoKSkgPyBmaWx0ZXJQcm9wKCkudHJpbSgpIDogZmlsdGVyUHJvcCgpO1xuICAgICAgICB9O1xuXG4gICAgICAgIGZ1bmN0aW9uIG9iamVjdFRvTG9naWNPcGVyYXRpb24ob2JqKSB7XG4gICAgICAgICAgICByZXR1cm4gJygnICsgT2JqZWN0LmtleXMob2JqKS5tYXAoZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgICAgICAgIGlmIChrZXkgPT09ICdvcicgfHwga2V5ID09PSAnYW5kJykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJycgKyBrZXkgKyBvYmplY3RUb0xvZ2ljT3BlcmF0aW9uKG9ialtrZXldKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJycgKyBPYmplY3Qua2V5cyhvYmpba2V5XSkubWFwKGZ1bmN0aW9uIChpbm5lcktleSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlubmVyS2V5ID09PSAnb3InIHx8IGlubmVyS2V5ID09PSAnYW5kJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAnJyArIGlubmVyS2V5ICsgb2JqZWN0VG9Mb2dpY09wZXJhdGlvbihvYmpba2V5XVtpbm5lcktleV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4ga2V5ICsgJy4nICsgaW5uZXJLZXkgKyAnLicgKyBvYmpba2V5XVtpbm5lcktleV07XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pLmpvaW4oJywnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KS5qb2luKCcsJykgKyAnKSc7XG4gICAgICAgIH1cblxuICAgICAgICBmaWx0ZXJQcm9wLmxvZ2ljT3BlcmF0b3JzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIG9iamVjdFRvTG9naWNPcGVyYXRpb24oZmlsdGVyUHJvcC50b0ZpbHRlcigpKTtcbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gZmlsdGVyUHJvcDtcbiAgICB9LFxuICAgICAgICBnZXR0ZXJzID0gXy5yZWR1Y2UoYXR0cmlidXRlcywgZnVuY3Rpb24gKG1lbW8sIG9wZXJhdG9yLCBhdHRyKSB7XG4gICAgICAgIC8vIFRoZSBvcGVyYXRvciBiZXR3ZWVuIGlzIGltcGxlbWVudGVkIHdpdGggdHdvIHByb3BlcnRpZXMsIG9uZSBmb3IgZ3JlYXRlciB0aGFuIHZhbHVlIGFuZCBhbm90aGVyIGZvciBsZXNzZXIgdGhhbiB2YWx1ZS5cbiAgICAgICAgLy8gQm90aCBwcm9wZXJ0aWVzIGFyZSBzZW50IGluIHRoZSBxdWV1cnlzdHJpbmcgd2l0aCB0aGUgc2FtZSBuYW1lLFxuICAgICAgICAvLyB0aGF0J3Mgd2h5IHdlIG5lZWQgdGhlIHNwZWNpYWwgY2FzZSBoZXJlLCBzbyB3ZSBjYW4gdXNlIGEgc2ltcGxlIG1hcCBhcyBhcmd1bWVudCB0byBmaWx0ZXJzVk0uXG4gICAgICAgIGlmIChvcGVyYXRvciA9PT0gJ2JldHdlZW4nKSB7XG4gICAgICAgICAgICBtZW1vW2F0dHJdID0ge1xuICAgICAgICAgICAgICAgIGx0ZTogZmlsdGVyKCksXG4gICAgICAgICAgICAgICAgZ3RlOiBmaWx0ZXIoKVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1lbW9bYXR0cl0gPSBmaWx0ZXIoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWVtbztcbiAgICB9LCB7XG4gICAgICAgIG9yZGVyOiBmaWx0ZXIoKVxuICAgIH0pLFxuICAgICAgICBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyID0gZnVuY3Rpb24gcGFyYW1ldGVyc1dpdGhvdXRPcmRlcigpIHtcbiAgICAgICAgcmV0dXJuIF8ucmVkdWNlKGdldHRlcnMsIGZ1bmN0aW9uIChtZW1vLCBnZXR0ZXIsIGF0dHIpIHtcbiAgICAgICAgICAgIGlmIChhdHRyICE9PSAnb3JkZXInKSB7XG4gICAgICAgICAgICAgICAgdmFyIG9wZXJhdG9yID0gYXR0cmlidXRlc1thdHRyXTtcblxuICAgICAgICAgICAgICAgIGlmIChfLmlzRnVuY3Rpb24oZ2V0dGVyLnRvRmlsdGVyKSAmJiAoZ2V0dGVyLnRvRmlsdGVyKCkgPT09IHVuZGVmaW5lZCB8fCBnZXR0ZXIudG9GaWx0ZXIoKSA9PT0gJycpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIEJlbGxvdyB3ZSB1c2UgZGlmZmVyZW50IGZvcm1hdHRpbmcgcnVsZXMgZm9yIHRoZSB2YWx1ZSBkZXBlbmRpbmcgb24gdGhlIG9wZXJhdG9yXG4gICAgICAgICAgICAgICAgLy8gVGhlc2UgcnVsZXMgYXJlIHVzZWQgcmVnYXJkbGVzcyBvZiB0aGUgdG9GaWx0ZXIgZnVuY3Rpb24sXG4gICAgICAgICAgICAgICAgLy8gc28gdGhlIHVzZXIgY2FuIHVzZSBhIGN1c3RvbSB0b0ZpbHRlciB3aXRob3V0IGhhdmluZyB0byB3b3JyeSB3aXRoIGJhc2ljIGZpbHRlciBzeW50YXhcbiAgICAgICAgICAgICAgICBpZiAob3BlcmF0b3IgPT09ICdpbGlrZScgfHwgb3BlcmF0b3IgPT09ICdsaWtlJykge1xuICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gb3BlcmF0b3IgKyAnLionICsgZ2V0dGVyLnRvRmlsdGVyKCkgKyAnKic7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChvcGVyYXRvciA9PT0gJ0BAJykge1xuICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gb3BlcmF0b3IgKyAnLicgKyBnZXR0ZXIudG9GaWx0ZXIoKS5yZXBsYWNlKC9cXHMrL2csICcmJyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChvcGVyYXRvciA9PT0gJ2JldHdlZW4nKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZ2V0dGVyLmx0ZS50b0ZpbHRlcigpICYmICFnZXR0ZXIuZ3RlLnRvRmlsdGVyKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIG1lbW9bYXR0cl0gPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGdldHRlci5ndGUoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXS5wdXNoKCdndGUuJyArIGdldHRlci5ndGUudG9GaWx0ZXIoKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKGdldHRlci5sdGUoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXS5wdXNoKCdsdGUuJyArIGdldHRlci5sdGUudG9GaWx0ZXIoKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG9wZXJhdG9yID09PSAnaXMubnVsbCcpIHtcbiAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IGdldHRlci50b0ZpbHRlcigpID09PSBudWxsID8gJ2lzLm51bGwnIDogJ25vdC5pcy5udWxsJztcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG9wZXJhdG9yID09PSAnb3InIHx8IG9wZXJhdG9yID09PSAnYW5kJykge1xuICAgICAgICAgICAgICAgICAgICBtZW1vW29wZXJhdG9yXSA9IGdldHRlci5sb2dpY09wZXJhdG9ycygpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAob3BlcmF0b3IgPT09ICdzZWxlY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lbW9bb3BlcmF0b3JdID0gZ2V0dGVyLnRvRmlsdGVyKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IG9wZXJhdG9yICsgJy4nICsgZ2V0dGVyLnRvRmlsdGVyKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgIH0sIHt9KTtcbiAgICB9LFxuICAgICAgICBwYXJhbWV0ZXJzID0gZnVuY3Rpb24gcGFyYW1ldGVycygpIHtcbiAgICAgICAgLy8gVGhlIG9yZGVyIHBhcmFtZXRlcnMgaGF2ZSBhIHNwZWNpYWwgc3ludGF4IChqdXN0IGxpa2UgYW4gb3JkZXIgYnkgU1FMIGNsYXVzZSlcbiAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2JlZ3JpZmZzL3Bvc3RncmVzdC93aWtpL1JvdXRpbmcjZmlsdGVyaW5nLWFuZC1vcmRlcmluZ1xuICAgICAgICB2YXIgb3JkZXIgPSBmdW5jdGlvbiBvcmRlcigpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXR0ZXJzLm9yZGVyKCkgJiYgXy5yZWR1Y2UoZ2V0dGVycy5vcmRlcigpLCBmdW5jdGlvbiAobWVtbywgZGlyZWN0aW9uLCBhdHRyKSB7XG4gICAgICAgICAgICAgICAgbWVtby5wdXNoKGF0dHIgKyAnLicgKyBkaXJlY3Rpb24pO1xuICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgfSwgW10pLmpvaW4oJywnKTtcbiAgICAgICAgfSxcbiAgICAgICAgICAgIG9yZGVyUGFyYW1ldGVyID0gb3JkZXIoKSA/IHtcbiAgICAgICAgICAgIG9yZGVyOiBvcmRlcigpXG4gICAgICAgIH0gOiB7fTtcblxuICAgICAgICByZXR1cm4gXy5leHRlbmQoe30sIG9yZGVyUGFyYW1ldGVyLCBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyKCkpO1xuICAgIH07XG5cbiAgICByZXR1cm4gXy5leHRlbmQobmV3Vk0sIGdldHRlcnMsIHtcbiAgICAgICAgcGFyYW1ldGVyczogcGFyYW1ldGVycyxcbiAgICAgICAgcGFyYW1ldGVyc1dpdGhvdXRPcmRlcjogcGFyYW1ldGVyc1dpdGhvdXRPcmRlclxuICAgIH0pO1xufTtcblxudmFyIF9zbGljZWRUb0FycmF5ID0gZnVuY3Rpb24gKCkgeyBmdW5jdGlvbiBzbGljZUl0ZXJhdG9yKGFyciwgaSkgeyB2YXIgX2FyciA9IFtdOyB2YXIgX24gPSB0cnVlOyB2YXIgX2QgPSBmYWxzZTsgdmFyIF9lID0gdW5kZWZpbmVkOyB0cnkgeyBmb3IgKHZhciBfaSA9IGFycltTeW1ib2wuaXRlcmF0b3JdKCksIF9zOyAhKF9uID0gKF9zID0gX2kubmV4dCgpKS5kb25lKTsgX24gPSB0cnVlKSB7IF9hcnIucHVzaChfcy52YWx1ZSk7IGlmIChpICYmIF9hcnIubGVuZ3RoID09PSBpKSBicmVhazsgfSB9IGNhdGNoIChlcnIpIHsgX2QgPSB0cnVlOyBfZSA9IGVycjsgfSBmaW5hbGx5IHsgdHJ5IHsgaWYgKCFfbiAmJiBfaVtcInJldHVyblwiXSkgX2lbXCJyZXR1cm5cIl0oKTsgfSBmaW5hbGx5IHsgaWYgKF9kKSB0aHJvdyBfZTsgfSB9IHJldHVybiBfYXJyOyB9IHJldHVybiBmdW5jdGlvbiAoYXJyLCBpKSB7IGlmIChBcnJheS5pc0FycmF5KGFycikpIHsgcmV0dXJuIGFycjsgfSBlbHNlIGlmIChTeW1ib2wuaXRlcmF0b3IgaW4gT2JqZWN0KGFycikpIHsgcmV0dXJuIHNsaWNlSXRlcmF0b3IoYXJyLCBpKTsgfSBlbHNlIHsgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkludmFsaWQgYXR0ZW1wdCB0byBkZXN0cnVjdHVyZSBub24taXRlcmFibGUgaW5zdGFuY2VcIik7IH0gfTsgfSgpO1xuXG52YXIgcGFnaW5hdGlvblZNID0gZnVuY3Rpb24gcGFnaW5hdGlvblZNKG1pdGhpbEluc3RhbmNlKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIChtb2RlbCwgb3JkZXIpIHtcbiAgICAgICAgdmFyIGV4dHJhSGVhZGVycyA9IGFyZ3VtZW50cy5sZW5ndGggPiAyICYmIGFyZ3VtZW50c1syXSAhPT0gdW5kZWZpbmVkID8gYXJndW1lbnRzWzJdIDoge307XG4gICAgICAgIHZhciBhdXRoZW50aWNhdGUgPSBhcmd1bWVudHMubGVuZ3RoID4gMyAmJiBhcmd1bWVudHNbM10gIT09IHVuZGVmaW5lZCA/IGFyZ3VtZW50c1szXSA6IHRydWU7XG5cbiAgICAgICAgdmFyIGNvbGxlY3Rpb24gPSBwcm9wKFtdKSxcbiAgICAgICAgICAgIGRlZmF1bHRPcmRlciA9IG9yZGVyIHx8ICdpZC5kZXNjJyxcbiAgICAgICAgICAgIGZpbHRlcnMgPSBwcm9wKHtcbiAgICAgICAgICAgIG9yZGVyOiBkZWZhdWx0T3JkZXJcbiAgICAgICAgfSksXG4gICAgICAgICAgICBpc0xvYWRpbmcgPSBwcm9wKGZhbHNlKSxcbiAgICAgICAgICAgIHBhZ2UgPSBwcm9wKDEpLFxuICAgICAgICAgICAgcmVzdWx0c0NvdW50ID0gcHJvcCgpLFxuICAgICAgICAgICAgcGFnZVJlcXVlc3QgPSBhdXRoZW50aWNhdGUgPyBtb2RlbC5nZXRQYWdlV2l0aFRva2VuIDogbW9kZWwuZ2V0UGFnZSxcbiAgICAgICAgICAgIHRvdGFsID0gcHJvcCgpO1xuXG4gICAgICAgIHZhciBmZXRjaCA9IGZ1bmN0aW9uIGZldGNoKCkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcblxuICAgICAgICAgICAgICAgIHZhciBnZXRUb3RhbCA9IGZ1bmN0aW9uIGdldFRvdGFsKHhocikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXhociB8fCB4aHIuc3RhdHVzID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhpbnQ6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV0YWlsczogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdDb25uZWN0aW9uIGVycm9yJ1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdmFyIHJhbmdlSGVhZGVyID0geGhyLmdldFJlc3BvbnNlSGVhZGVyKCdDb250ZW50LVJhbmdlJyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChfLmlzU3RyaW5nKHJhbmdlSGVhZGVyKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIF9yYW5nZUhlYWRlciRzcGxpdCA9IHJhbmdlSGVhZGVyLnNwbGl0KCcvJyksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX3JhbmdlSGVhZGVyJHNwbGl0MiA9IF9zbGljZWRUb0FycmF5KF9yYW5nZUhlYWRlciRzcGxpdCwgMiksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVhZGVyU2l6ZSA9IF9yYW5nZUhlYWRlciRzcGxpdDJbMF0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVhZGVyQ291bnQgPSBfcmFuZ2VIZWFkZXIkc3BsaXQyWzFdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF9oZWFkZXJTaXplJHNwbGl0ID0gaGVhZGVyU2l6ZS5zcGxpdCgnLScpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF9oZWFkZXJTaXplJHNwbGl0MiA9IF9zbGljZWRUb0FycmF5KF9oZWFkZXJTaXplJHNwbGl0LCAyKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoZWFkZXJGcm9tID0gX2hlYWRlclNpemUkc3BsaXQyWzBdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlYWRlclRvID0gX2hlYWRlclNpemUkc3BsaXQyWzFdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvID0gcGFyc2VJbnQoaGVhZGVyVG8pICsgMSB8fCAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyb20gPSBwYXJzZUludChoZWFkZXJGcm9tKSB8fCAwO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0b3RhbChwYXJzZUludChoZWFkZXJDb3VudCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0c0NvdW50KHRvIC0gZnJvbSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UoeGhyLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhpbnQ6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV0YWlsczogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IHhoci5yZXNwb25zZVRleHRcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBpc0xvYWRpbmcodHJ1ZSk7XG4gICAgICAgICAgICAgICAgcGFnZVJlcXVlc3QoZmlsdGVycygpLCBwYWdlKCksIHtcbiAgICAgICAgICAgICAgICAgICAgYmFja2dyb3VuZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGV4dHJhY3Q6IGdldFRvdGFsXG4gICAgICAgICAgICAgICAgfSwgZXh0cmFIZWFkZXJzKS50aGVuKGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbGxlY3Rpb24oXy51bmlvbihjb2xsZWN0aW9uKCksIGRhdGEpKTtcbiAgICAgICAgICAgICAgICAgICAgaXNMb2FkaW5nKGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShjb2xsZWN0aW9uKCkpO1xuICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBpc0xvYWRpbmcoZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICB0b3RhbCgwKTtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICAgICAgZmlyc3RQYWdlID0gZnVuY3Rpb24gZmlyc3RQYWdlKHBhcmFtZXRlcnMpIHtcbiAgICAgICAgICAgIGZpbHRlcnMoXy5leHRlbmQoe1xuICAgICAgICAgICAgICAgIG9yZGVyOiBkZWZhdWx0T3JkZXJcbiAgICAgICAgICAgIH0sIHBhcmFtZXRlcnMpKTtcbiAgICAgICAgICAgIGNvbGxlY3Rpb24oW10pO1xuICAgICAgICAgICAgcGFnZSgxKTtcbiAgICAgICAgICAgIHJldHVybiBmZXRjaCgpO1xuICAgICAgICB9LFxuICAgICAgICAgICAgaXNMYXN0UGFnZSA9IGZ1bmN0aW9uIGlzTGFzdFBhZ2UoKSB7XG4gICAgICAgICAgICByZXR1cm4gbW9kZWwucGFnZVNpemUoKSA+IHJlc3VsdHNDb3VudCgpO1xuICAgICAgICB9LFxuICAgICAgICAgICAgbmV4dFBhZ2UgPSBmdW5jdGlvbiBuZXh0UGFnZSgpIHtcbiAgICAgICAgICAgIHBhZ2UocGFnZSgpICsgMSk7XG4gICAgICAgICAgICByZXR1cm4gZmV0Y2goKTtcbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY29sbGVjdGlvbjogY29sbGVjdGlvbixcbiAgICAgICAgICAgIGZpcnN0UGFnZTogZmlyc3RQYWdlLFxuICAgICAgICAgICAgaXNMb2FkaW5nOiBpc0xvYWRpbmcsXG4gICAgICAgICAgICBuZXh0UGFnZTogbmV4dFBhZ2UsXG4gICAgICAgICAgICBpc0xhc3RQYWdlOiBpc0xhc3RQYWdlLFxuICAgICAgICAgICAgdG90YWw6IHRvdGFsLFxuICAgICAgICAgICAgcmVzdWx0c0NvdW50OiByZXN1bHRzQ291bnRcbiAgICAgICAgfTtcbiAgICB9O1xufTtcblxuLyoqXG4gKiBUaGlzIHRha2VzIHRoZSBtaXRocmlsIGluc3RhbmNlIHRoYXQgd2lsbCBoYW5kbGUgcmVkcmF3IFxuICogb24gb2NjdXJlbmNlIG9mIGEgZG9tIGVsZW1lbnQgZXZlbnQgb3Igc29tZSBtLnJlcXVlc3RcbiAqIGNhbGwuXG4gKiBAcGFyYW0ge01pdGhyaWx9IG1pdGhyaWxJbnN0YW5jZSBcbiAqL1xuZnVuY3Rpb24gUG9zdGdyZXN0KG1pdGhyaWxJbnN0YW5jZSkge1xuICAgIHZhciBtID0gbWl0aHJpbEluc3RhbmNlIHx8IG1pdGhyaWw7XG4gICAgdmFyIHBvc3RncmVzdCA9IHt9O1xuICAgIHZhciB0b2tlbiA9IHByb3AoKSxcbiAgICAgICAgbWVyZ2VDb25maWcgPSBmdW5jdGlvbiBtZXJnZUNvbmZpZyhjb25maWcsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIG9wdGlvbnMgJiYgXy5pc0Z1bmN0aW9uKG9wdGlvbnMuY29uZmlnKSA/IF8uY29tcG9zZShvcHRpb25zLmNvbmZpZywgY29uZmlnKSA6IGNvbmZpZztcbiAgICB9LFxuICAgICAgICBhZGRIZWFkZXJzID0gZnVuY3Rpb24gYWRkSGVhZGVycyhoZWFkZXJzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoeGhyKSB7XG4gICAgICAgICAgICBfLmVhY2goaGVhZGVycywgZnVuY3Rpb24gKHZhbHVlLCBrZXkpIHtcbiAgICAgICAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihrZXksIHZhbHVlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHhocjtcbiAgICAgICAgfTtcbiAgICB9LFxuICAgICAgICBhZGRDb25maWdIZWFkZXJzID0gZnVuY3Rpb24gYWRkQ29uZmlnSGVhZGVycyhoZWFkZXJzLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiBfLmV4dGVuZCh7fSwgb3B0aW9ucywge1xuICAgICAgICAgICAgY29uZmlnOiBtZXJnZUNvbmZpZyhhZGRIZWFkZXJzKGhlYWRlcnMpLCBvcHRpb25zKVxuICAgICAgICB9KTtcbiAgICB9LFxuICAgICAgICBjcmVhdGVMb2FkZXIgPSBmdW5jdGlvbiBjcmVhdGVMb2FkZXIocmVxdWVzdEZ1bmN0aW9uLCBvcHRpb25zKSB7XG4gICAgICAgIHZhciBkZWZhdWx0U3RhdGUgPSBhcmd1bWVudHMubGVuZ3RoID4gMiAmJiBhcmd1bWVudHNbMl0gIT09IHVuZGVmaW5lZCA/IGFyZ3VtZW50c1syXSA6IGZhbHNlO1xuXG4gICAgICAgIHZhciBsb2FkZXIgPSBwcm9wKGRlZmF1bHRTdGF0ZSk7XG4gICAgICAgIGxvYWRlci5sb2FkID0gZnVuY3Rpb24gKCkge1xuXG4gICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgICAgIGxvYWRlcih0cnVlKTtcbiAgICAgICAgICAgICAgICByZXF1ZXN0RnVuY3Rpb24oXy5leHRlbmQoe30sIG9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICAgICAgYmFja2dyb3VuZDogZmFsc2VcbiAgICAgICAgICAgICAgICB9KSkudGhlbihmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICAgICAgICAgICAgICBsb2FkZXIoZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGRhdGEpO1xuICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBsb2FkZXIoZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBsb2FkZXI7XG4gICAgfSxcbiAgICAgICAgcmVwcmVzZW50YXRpb25IZWFkZXIgPSB7XG4gICAgICAgICdQcmVmZXInOiAncmV0dXJuPXJlcHJlc2VudGF0aW9uJ1xuICAgIH07XG5cbiAgICBwb3N0Z3Jlc3QudG9rZW4gPSB0b2tlbjtcblxuICAgIHBvc3RncmVzdC5pbml0ID0gZnVuY3Rpb24gKGFwaVByZWZpeCwgYXV0aGVudGljYXRpb25PcHRpb25zKSB7XG4gICAgICAgIHZhciBnbG9iYWxIZWFkZXIgPSBhcmd1bWVudHMubGVuZ3RoID4gMiAmJiBhcmd1bWVudHNbMl0gIT09IHVuZGVmaW5lZCA/IGFyZ3VtZW50c1syXSA6IHt9O1xuXG4gICAgICAgIHBvc3RncmVzdC5yZXF1ZXN0ID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHZhciBlcnJvckhhbmRsZXIgPSBmdW5jdGlvbiBlcnJvckhhbmRsZXIoeGhyKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UoeGhyLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGhpbnQ6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXRhaWxzOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IHhoci5yZXNwb25zZVRleHRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHZhciBjb25maWdIZWFkZXJzVG9BZGQgPSBhZGRDb25maWdIZWFkZXJzKGdsb2JhbEhlYWRlciwgXy5leHRlbmQoeyBleHRyYWN0OiBlcnJvckhhbmRsZXIgfSwgb3B0aW9ucywge1xuICAgICAgICAgICAgICAgIHVybDogYXBpUHJlZml4ICsgb3B0aW9ucy51cmxcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIHJldHVybiBtLnJlcXVlc3QoY29uZmlnSGVhZGVyc1RvQWRkKTtcbiAgICAgICAgfTtcblxuICAgICAgICB2YXIgYXV0aGVudGljYXRpb25SZXF1ZXN0ZWQgPSBwcm9wKGZhbHNlKTtcbiAgICAgICAgcG9zdGdyZXN0LmF1dGhlbnRpY2F0ZSA9IGZ1bmN0aW9uIChkZWxlZ2F0ZWREZWZlcnJlZCkge1xuICAgICAgICAgICAgdmFyIGRlZmVycmVkID0gZGVsZWdhdGVkRGVmZXJyZWQgfHwgbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAgICAgICAgIHZhciB3b3JraW5nQ2FsbCA9IGZ1bmN0aW9uIHdvcmtpbmdDYWxsKCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodG9rZW4oKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh7IHRva2VuOiB0b2tlbigpIH0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKCFhdXRoZW50aWNhdGlvblJlcXVlc3RlZCgpKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGF1dGhlbnRpY2F0aW9uUmVxdWVzdGVkKHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbS5yZXF1ZXN0KF8uZXh0ZW5kKHt9LCBhdXRoZW50aWNhdGlvbk9wdGlvbnMpKS50aGVuKGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXV0aGVudGljYXRpb25SZXF1ZXN0ZWQoZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRva2VuKGRhdGEudG9rZW4pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoeyB0b2tlbjogdG9rZW4oKSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXV0aGVudGljYXRpb25SZXF1ZXN0ZWQoZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChkYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCh3b3JraW5nQ2FsbCwgMjUwKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgd29ya2luZ0NhbGwoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIGRlZmVycmVkO1xuICAgICAgICB9O1xuXG4gICAgICAgIHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcblxuICAgICAgICAgICAgcmV0dXJuIHBvc3RncmVzdC5hdXRoZW50aWNhdGUoKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcG9zdGdyZXN0LnJlcXVlc3QoYWRkQ29uZmlnSGVhZGVycyh7XG4gICAgICAgICAgICAgICAgICAgICdBdXRob3JpemF0aW9uJzogJ0JlYXJlciAnICsgdG9rZW4oKVxuICAgICAgICAgICAgICAgIH0sIG9wdGlvbnMpKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcG9zdGdyZXN0LnJlcXVlc3Qob3B0aW9ucyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICBwb3N0Z3Jlc3QubG9hZGVyID0gXy5wYXJ0aWFsKGNyZWF0ZUxvYWRlciwgcG9zdGdyZXN0LnJlcXVlc3QpO1xuXG4gICAgICAgIHBvc3RncmVzdC5sb2FkZXJXaXRoVG9rZW4gPSBfLnBhcnRpYWwoY3JlYXRlTG9hZGVyLCBwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbik7XG5cbiAgICAgICAgcG9zdGdyZXN0Lm1vZGVsID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgICAgICAgIHZhciBwYWdpbmF0aW9uSGVhZGVycyA9IGZ1bmN0aW9uIHBhZ2luYXRpb25IZWFkZXJzKHBhZ2UsIHBhZ2VTaXplKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFwYWdlU2l6ZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdmFyIHRvUmFuZ2UgPSBmdW5jdGlvbiB0b1JhbmdlKCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZnJvbSA9IChwYWdlIC0gMSkgKiBwYWdlU2l6ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRvID0gZnJvbSArIHBhZ2VTaXplIC0gMTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZyb20gKyAnLScgKyB0bztcbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgJ1JhbmdlLXVuaXQnOiAnaXRlbXMnLFxuICAgICAgICAgICAgICAgICAgICAnUmFuZ2UnOiB0b1JhbmdlKClcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBwYWdlU2l6ZSA9IHByb3AoMTApLFxuICAgICAgICAgICAgICAgIG5hbWVPcHRpb25zID0ge1xuICAgICAgICAgICAgICAgIHVybDogJy8nICsgbmFtZVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBnZXRPcHRpb25zID0gZnVuY3Rpb24gZ2V0T3B0aW9ucyhkYXRhLCBwYWdlLCBwYWdlU2l6ZSwgb3B0aW9ucykge1xuICAgICAgICAgICAgICAgIHZhciBoZWFkZXJzID0gYXJndW1lbnRzLmxlbmd0aCA+IDQgJiYgYXJndW1lbnRzWzRdICE9PSB1bmRlZmluZWQgPyBhcmd1bWVudHNbNF0gOiB7fTtcblxuICAgICAgICAgICAgICAgIHZhciBleHRyYUhlYWRlcnMgPSBfLmV4dGVuZCh7fSwge1xuICAgICAgICAgICAgICAgICAgICAnUHJlZmVyJzogJ2NvdW50PW5vbmUnXG4gICAgICAgICAgICAgICAgfSwgaGVhZGVycywgcGFnaW5hdGlvbkhlYWRlcnMocGFnZSwgcGFnZVNpemUpKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gYWRkQ29uZmlnSGVhZGVycyhleHRyYUhlYWRlcnMsIF8uZXh0ZW5kKHt9LCBvcHRpb25zLCBuYW1lT3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiBkYXRhXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBxdWVyeXN0cmluZyA9IGZ1bmN0aW9uIHF1ZXJ5c3RyaW5nKGZpbHRlcnMsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICBvcHRpb25zLnVybCArPSAnPycgKyBtLmJ1aWxkUXVlcnlTdHJpbmcoZmlsdGVycyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9wdGlvbnM7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIG9wdGlvbnMgPSBmdW5jdGlvbiBvcHRpb25zKF9vcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBvc3RncmVzdC5yZXF1ZXN0KF8uZXh0ZW5kKHt9LCBfb3B0aW9ucywgbmFtZU9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnT1BUSU9OUydcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHBvc3RPcHRpb25zID0gZnVuY3Rpb24gcG9zdE9wdGlvbnMoYXR0cmlidXRlcywgb3B0aW9ucykge1xuICAgICAgICAgICAgICAgIHZhciBoZWFkZXJzID0gYXJndW1lbnRzLmxlbmd0aCA+IDIgJiYgYXJndW1lbnRzWzJdICE9PSB1bmRlZmluZWQgPyBhcmd1bWVudHNbMl0gOiB7fTtcblxuICAgICAgICAgICAgICAgIHZhciBleHRyYUhlYWRlcnMgPSBfLmV4dGVuZCh7fSwgcmVwcmVzZW50YXRpb25IZWFkZXIsIGhlYWRlcnMpO1xuICAgICAgICAgICAgICAgIHJldHVybiBhZGRDb25maWdIZWFkZXJzKGV4dHJhSGVhZGVycywgXy5leHRlbmQoe30sIG9wdGlvbnMsIG5hbWVPcHRpb25zLCB7XG4gICAgICAgICAgICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiBhdHRyaWJ1dGVzXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBkZWxldGVPcHRpb25zID0gZnVuY3Rpb24gZGVsZXRlT3B0aW9ucyhmaWx0ZXJzLCBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgdmFyIGhlYWRlcnMgPSBhcmd1bWVudHMubGVuZ3RoID4gMiAmJiBhcmd1bWVudHNbMl0gIT09IHVuZGVmaW5lZCA/IGFyZ3VtZW50c1syXSA6IHt9O1xuXG4gICAgICAgICAgICAgICAgdmFyIGV4dHJhSGVhZGVycyA9IF8uZXh0ZW5kKHt9LCByZXByZXNlbnRhdGlvbkhlYWRlciwgaGVhZGVycyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHF1ZXJ5c3RyaW5nKGZpbHRlcnMsIGFkZENvbmZpZ0hlYWRlcnMoZXh0cmFIZWFkZXJzLCBfLmV4dGVuZCh7fSwgb3B0aW9ucywgbmFtZU9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnREVMRVRFJ1xuICAgICAgICAgICAgICAgIH0pKSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHBhdGNoT3B0aW9ucyA9IGZ1bmN0aW9uIHBhdGNoT3B0aW9ucyhmaWx0ZXJzLCBhdHRyaWJ1dGVzLCBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgdmFyIGhlYWRlcnMgPSBhcmd1bWVudHMubGVuZ3RoID4gMyAmJiBhcmd1bWVudHNbM10gIT09IHVuZGVmaW5lZCA/IGFyZ3VtZW50c1szXSA6IHt9O1xuXG4gICAgICAgICAgICAgICAgdmFyIGV4dHJhSGVhZGVycyA9IF8uZXh0ZW5kKHt9LCByZXByZXNlbnRhdGlvbkhlYWRlciwgaGVhZGVycyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHF1ZXJ5c3RyaW5nKGZpbHRlcnMsIGFkZENvbmZpZ0hlYWRlcnMoZXh0cmFIZWFkZXJzLCBfLmV4dGVuZCh7fSwgb3B0aW9ucywgbmFtZU9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnUEFUQ0gnLFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiBhdHRyaWJ1dGVzXG4gICAgICAgICAgICAgICAgfSkpKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZ2V0UGFnZU9wdGlvbnMgPSBmdW5jdGlvbiBnZXRQYWdlT3B0aW9ucyhkYXRhLCBwYWdlLCBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgdmFyIGhlYWRlcnMgPSBhcmd1bWVudHMubGVuZ3RoID4gMyAmJiBhcmd1bWVudHNbM10gIT09IHVuZGVmaW5lZCA/IGFyZ3VtZW50c1szXSA6IHt9O1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGdldE9wdGlvbnMoZGF0YSwgcGFnZSB8fCAxLCBwYWdlU2l6ZSgpLCBvcHRpb25zLCBoZWFkZXJzKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZ2V0Um93T3B0aW9ucyA9IGZ1bmN0aW9uIGdldFJvd09wdGlvbnMoZGF0YSwgb3B0aW9ucykge1xuICAgICAgICAgICAgICAgIHZhciBoZWFkZXJzID0gYXJndW1lbnRzLmxlbmd0aCA+IDIgJiYgYXJndW1lbnRzWzJdICE9PSB1bmRlZmluZWQgPyBhcmd1bWVudHNbMl0gOiB7fTtcblxuICAgICAgICAgICAgICAgIHJldHVybiBnZXRPcHRpb25zKGRhdGEsIDEsIDEsIG9wdGlvbnMsIGhlYWRlcnMpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBwYWdlU2l6ZTogcGFnZVNpemUsXG4gICAgICAgICAgICAgICAgZ2V0UGFnZU9wdGlvbnM6IGdldFBhZ2VPcHRpb25zLFxuICAgICAgICAgICAgICAgIGdldFJvd09wdGlvbnM6IGdldFJvd09wdGlvbnMsXG4gICAgICAgICAgICAgICAgcGF0Y2hPcHRpb25zOiBwYXRjaE9wdGlvbnMsXG4gICAgICAgICAgICAgICAgcG9zdE9wdGlvbnM6IHBvc3RPcHRpb25zLFxuICAgICAgICAgICAgICAgIGRlbGV0ZU9wdGlvbnM6IGRlbGV0ZU9wdGlvbnMsXG4gICAgICAgICAgICAgICAgZ2V0UGFnZTogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0LCBnZXRQYWdlT3B0aW9ucyksXG4gICAgICAgICAgICAgICAgZ2V0Um93OiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIGdldFJvd09wdGlvbnMpLFxuICAgICAgICAgICAgICAgIHBhdGNoOiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIHBhdGNoT3B0aW9ucyksXG4gICAgICAgICAgICAgICAgcG9zdDogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0LCBwb3N0T3B0aW9ucyksXG4gICAgICAgICAgICAgICAgZGVsZXRlUmVxdWVzdDogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0LCBkZWxldGVPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBnZXRQYWdlV2l0aFRva2VuOiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIGdldFBhZ2VPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBnZXRSb3dXaXRoVG9rZW46IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgZ2V0Um93T3B0aW9ucyksXG4gICAgICAgICAgICAgICAgcGF0Y2hXaXRoVG9rZW46IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgcGF0Y2hPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBwb3N0V2l0aFRva2VuOiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIHBvc3RPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBkZWxldGVXaXRoVG9rZW46IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgZGVsZXRlT3B0aW9ucyksXG4gICAgICAgICAgICAgICAgb3B0aW9uczogb3B0aW9uc1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gcG9zdGdyZXN0O1xuICAgIH07XG5cbiAgICBwb3N0Z3Jlc3QuZmlsdGVyc1ZNID0gZmlsdGVyc1ZNO1xuICAgIHBvc3RncmVzdC5wYWdpbmF0aW9uVk0gPSBwYWdpbmF0aW9uVk0obWl0aHJpbEluc3RhbmNlKTtcblxuICAgIHJldHVybiBwb3N0Z3Jlc3Q7XG59XG5cbnJldHVybiBQb3N0Z3Jlc3Q7XG5cbn0pKSk7XG4iXSwiZmlsZSI6InNyYy8qKi8qLmpzIn0=
