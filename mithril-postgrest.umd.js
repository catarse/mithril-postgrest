(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('mithril/stream'), require('underscore')) :
	typeof define === 'function' && define.amd ? define(['mithril/stream', 'underscore'], factory) :
	(global.Postgrest = factory(global.prop,global._));
}(this, (function (prop,_) { 'use strict';

prop = prop && prop.hasOwnProperty('default') ? prop['default'] : prop;
_ = _ && _.hasOwnProperty('default') ? _['default'] : _;

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

function Postgrest(mithrilInstance) {
    var m = mithrilInstance;
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
                options.url += '?' + m.route.buildQueryString(filters);
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJzcmMvKiovKi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gKGdsb2JhbCwgZmFjdG9yeSkge1xuXHR0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgPyBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkocmVxdWlyZSgnbWl0aHJpbC9zdHJlYW0nKSwgcmVxdWlyZSgndW5kZXJzY29yZScpKSA6XG5cdHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCA/IGRlZmluZShbJ21pdGhyaWwvc3RyZWFtJywgJ3VuZGVyc2NvcmUnXSwgZmFjdG9yeSkgOlxuXHQoZ2xvYmFsLlBvc3RncmVzdCA9IGZhY3RvcnkoZ2xvYmFsLnByb3AsZ2xvYmFsLl8pKTtcbn0odGhpcywgKGZ1bmN0aW9uIChwcm9wLF8pIHsgJ3VzZSBzdHJpY3QnO1xuXG5wcm9wID0gcHJvcCAmJiBwcm9wLmhhc093blByb3BlcnR5KCdkZWZhdWx0JykgPyBwcm9wWydkZWZhdWx0J10gOiBwcm9wO1xuXyA9IF8gJiYgXy5oYXNPd25Qcm9wZXJ0eSgnZGVmYXVsdCcpID8gX1snZGVmYXVsdCddIDogXztcblxudmFyIGZpbHRlcnNWTSA9IGZ1bmN0aW9uIGZpbHRlcnNWTShhdHRyaWJ1dGVzKSB7XG4gICAgdmFyIG5ld1ZNID0ge30sXG4gICAgICAgIGZpbHRlciA9IGZ1bmN0aW9uIGZpbHRlcigpIHtcbiAgICAgICAgdmFyIGlubmVyUHJvcCA9IHByb3AoJycpLFxuICAgICAgICAgICAgZmlsdGVyUHJvcCA9IGZ1bmN0aW9uIGZpbHRlclByb3AodmFsdWUpIHtcbiAgICAgICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGlubmVyUHJvcCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ld1ZNO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGlubmVyUHJvcCgpO1xuICAgICAgICB9O1xuICAgICAgICAvLyBKdXN0IHNvIHdlIGNhbiBoYXZlIGEgZGVmYXVsdCB0b19maWx0ZXIgYW5kIGF2b2lkIGlmIF8uaXNGdW5jdGlvbiBjYWxsc1xuICAgICAgICBmaWx0ZXJQcm9wLnRvRmlsdGVyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIF8uaXNTdHJpbmcoZmlsdGVyUHJvcCgpKSA/IGZpbHRlclByb3AoKS50cmltKCkgOiBmaWx0ZXJQcm9wKCk7XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBmaWx0ZXJQcm9wO1xuICAgIH0sXG4gICAgICAgIGdldHRlcnMgPSBfLnJlZHVjZShhdHRyaWJ1dGVzLCBmdW5jdGlvbiAobWVtbywgb3BlcmF0b3IsIGF0dHIpIHtcbiAgICAgICAgLy8gVGhlIG9wZXJhdG9yIGJldHdlZW4gaXMgaW1wbGVtZW50ZWQgd2l0aCB0d28gcHJvcGVydGllcywgb25lIGZvciBncmVhdGVyIHRoYW4gdmFsdWUgYW5kIGFub3RoZXIgZm9yIGxlc3NlciB0aGFuIHZhbHVlLlxuICAgICAgICAvLyBCb3RoIHByb3BlcnRpZXMgYXJlIHNlbnQgaW4gdGhlIHF1ZXVyeXN0cmluZyB3aXRoIHRoZSBzYW1lIG5hbWUsXG4gICAgICAgIC8vIHRoYXQncyB3aHkgd2UgbmVlZCB0aGUgc3BlY2lhbCBjYXNlIGhlcmUsIHNvIHdlIGNhbiB1c2UgYSBzaW1wbGUgbWFwIGFzIGFyZ3VtZW50IHRvIGZpbHRlcnNWTS5cbiAgICAgICAgaWYgKG9wZXJhdG9yID09PSAnYmV0d2VlbicpIHtcbiAgICAgICAgICAgIG1lbW9bYXR0cl0gPSB7XG4gICAgICAgICAgICAgICAgbHRlOiBmaWx0ZXIoKSxcbiAgICAgICAgICAgICAgICBndGU6IGZpbHRlcigpXG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWVtb1thdHRyXSA9IGZpbHRlcigpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtZW1vO1xuICAgIH0sIHtcbiAgICAgICAgb3JkZXI6IGZpbHRlcigpXG4gICAgfSksXG4gICAgICAgIHBhcmFtZXRlcnNXaXRob3V0T3JkZXIgPSBmdW5jdGlvbiBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyKCkge1xuICAgICAgICByZXR1cm4gXy5yZWR1Y2UoZ2V0dGVycywgZnVuY3Rpb24gKG1lbW8sIGdldHRlciwgYXR0cikge1xuICAgICAgICAgICAgaWYgKGF0dHIgIT09ICdvcmRlcicpIHtcbiAgICAgICAgICAgICAgICB2YXIgb3BlcmF0b3IgPSBhdHRyaWJ1dGVzW2F0dHJdO1xuXG4gICAgICAgICAgICAgICAgaWYgKF8uaXNGdW5jdGlvbihnZXR0ZXIudG9GaWx0ZXIpICYmIChnZXR0ZXIudG9GaWx0ZXIoKSA9PT0gdW5kZWZpbmVkIHx8IGdldHRlci50b0ZpbHRlcigpID09PSAnJykpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gQmVsbG93IHdlIHVzZSBkaWZmZXJlbnQgZm9ybWF0dGluZyBydWxlcyBmb3IgdGhlIHZhbHVlIGRlcGVuZGluZyBvbiB0aGUgb3BlcmF0b3JcbiAgICAgICAgICAgICAgICAvLyBUaGVzZSBydWxlcyBhcmUgdXNlZCByZWdhcmRsZXNzIG9mIHRoZSB0b0ZpbHRlciBmdW5jdGlvbixcbiAgICAgICAgICAgICAgICAvLyBzbyB0aGUgdXNlciBjYW4gdXNlIGEgY3VzdG9tIHRvRmlsdGVyIHdpdGhvdXQgaGF2aW5nIHRvIHdvcnJ5IHdpdGggYmFzaWMgZmlsdGVyIHN5bnRheFxuICAgICAgICAgICAgICAgIGlmIChvcGVyYXRvciA9PT0gJ2lsaWtlJyB8fCBvcGVyYXRvciA9PT0gJ2xpa2UnKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lbW9bYXR0cl0gPSBvcGVyYXRvciArICcuKicgKyBnZXR0ZXIudG9GaWx0ZXIoKSArICcqJztcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG9wZXJhdG9yID09PSAnQEAnKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lbW9bYXR0cl0gPSBvcGVyYXRvciArICcuJyArIGdldHRlci50b0ZpbHRlcigpLnJlcGxhY2UoL1xccysvZywgJyYnKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG9wZXJhdG9yID09PSAnYmV0d2VlbicpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFnZXR0ZXIubHRlLnRvRmlsdGVyKCkgJiYgIWdldHRlci5ndGUudG9GaWx0ZXIoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZ2V0dGVyLmd0ZSgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdLnB1c2goJ2d0ZS4nICsgZ2V0dGVyLmd0ZS50b0ZpbHRlcigpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoZ2V0dGVyLmx0ZSgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdLnB1c2goJ2x0ZS4nICsgZ2V0dGVyLmx0ZS50b0ZpbHRlcigpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAob3BlcmF0b3IgPT09ICdpcy5udWxsJykge1xuICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gZ2V0dGVyLnRvRmlsdGVyKCkgPT09IG51bGwgPyAnaXMubnVsbCcgOiAnbm90LmlzLm51bGwnO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG1lbW9bYXR0cl0gPSBvcGVyYXRvciArICcuJyArIGdldHRlci50b0ZpbHRlcigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICB9LCB7fSk7XG4gICAgfSxcbiAgICAgICAgcGFyYW1ldGVycyA9IGZ1bmN0aW9uIHBhcmFtZXRlcnMoKSB7XG4gICAgICAgIC8vIFRoZSBvcmRlciBwYXJhbWV0ZXJzIGhhdmUgYSBzcGVjaWFsIHN5bnRheCAoanVzdCBsaWtlIGFuIG9yZGVyIGJ5IFNRTCBjbGF1c2UpXG4gICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9iZWdyaWZmcy9wb3N0Z3Jlc3Qvd2lraS9Sb3V0aW5nI2ZpbHRlcmluZy1hbmQtb3JkZXJpbmdcbiAgICAgICAgdmFyIG9yZGVyID0gZnVuY3Rpb24gb3JkZXIoKSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0dGVycy5vcmRlcigpICYmIF8ucmVkdWNlKGdldHRlcnMub3JkZXIoKSwgZnVuY3Rpb24gKG1lbW8sIGRpcmVjdGlvbiwgYXR0cikge1xuICAgICAgICAgICAgICAgIG1lbW8ucHVzaChhdHRyICsgJy4nICsgZGlyZWN0aW9uKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgICAgIH0sIFtdKS5qb2luKCcsJyk7XG4gICAgICAgIH0sXG4gICAgICAgICAgICBvcmRlclBhcmFtZXRlciA9IG9yZGVyKCkgPyB7XG4gICAgICAgICAgICBvcmRlcjogb3JkZXIoKVxuICAgICAgICB9IDoge307XG5cbiAgICAgICAgcmV0dXJuIF8uZXh0ZW5kKHt9LCBvcmRlclBhcmFtZXRlciwgcGFyYW1ldGVyc1dpdGhvdXRPcmRlcigpKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIF8uZXh0ZW5kKG5ld1ZNLCBnZXR0ZXJzLCB7XG4gICAgICAgIHBhcmFtZXRlcnM6IHBhcmFtZXRlcnMsXG4gICAgICAgIHBhcmFtZXRlcnNXaXRob3V0T3JkZXI6IHBhcmFtZXRlcnNXaXRob3V0T3JkZXJcbiAgICB9KTtcbn07XG5cbnZhciBfc2xpY2VkVG9BcnJheSA9IGZ1bmN0aW9uICgpIHsgZnVuY3Rpb24gc2xpY2VJdGVyYXRvcihhcnIsIGkpIHsgdmFyIF9hcnIgPSBbXTsgdmFyIF9uID0gdHJ1ZTsgdmFyIF9kID0gZmFsc2U7IHZhciBfZSA9IHVuZGVmaW5lZDsgdHJ5IHsgZm9yICh2YXIgX2kgPSBhcnJbU3ltYm9sLml0ZXJhdG9yXSgpLCBfczsgIShfbiA9IChfcyA9IF9pLm5leHQoKSkuZG9uZSk7IF9uID0gdHJ1ZSkgeyBfYXJyLnB1c2goX3MudmFsdWUpOyBpZiAoaSAmJiBfYXJyLmxlbmd0aCA9PT0gaSkgYnJlYWs7IH0gfSBjYXRjaCAoZXJyKSB7IF9kID0gdHJ1ZTsgX2UgPSBlcnI7IH0gZmluYWxseSB7IHRyeSB7IGlmICghX24gJiYgX2lbXCJyZXR1cm5cIl0pIF9pW1wicmV0dXJuXCJdKCk7IH0gZmluYWxseSB7IGlmIChfZCkgdGhyb3cgX2U7IH0gfSByZXR1cm4gX2FycjsgfSByZXR1cm4gZnVuY3Rpb24gKGFyciwgaSkgeyBpZiAoQXJyYXkuaXNBcnJheShhcnIpKSB7IHJldHVybiBhcnI7IH0gZWxzZSBpZiAoU3ltYm9sLml0ZXJhdG9yIGluIE9iamVjdChhcnIpKSB7IHJldHVybiBzbGljZUl0ZXJhdG9yKGFyciwgaSk7IH0gZWxzZSB7IHRocm93IG5ldyBUeXBlRXJyb3IoXCJJbnZhbGlkIGF0dGVtcHQgdG8gZGVzdHJ1Y3R1cmUgbm9uLWl0ZXJhYmxlIGluc3RhbmNlXCIpOyB9IH07IH0oKTtcblxudmFyIHBhZ2luYXRpb25WTSA9IGZ1bmN0aW9uIHBhZ2luYXRpb25WTShtaXRoaWxJbnN0YW5jZSkge1xuICAgIHJldHVybiBmdW5jdGlvbiAobW9kZWwsIG9yZGVyKSB7XG4gICAgICAgIHZhciBleHRyYUhlYWRlcnMgPSBhcmd1bWVudHMubGVuZ3RoID4gMiAmJiBhcmd1bWVudHNbMl0gIT09IHVuZGVmaW5lZCA/IGFyZ3VtZW50c1syXSA6IHt9O1xuICAgICAgICB2YXIgYXV0aGVudGljYXRlID0gYXJndW1lbnRzLmxlbmd0aCA+IDMgJiYgYXJndW1lbnRzWzNdICE9PSB1bmRlZmluZWQgPyBhcmd1bWVudHNbM10gOiB0cnVlO1xuXG4gICAgICAgIHZhciBjb2xsZWN0aW9uID0gcHJvcChbXSksXG4gICAgICAgICAgICBkZWZhdWx0T3JkZXIgPSBvcmRlciB8fCAnaWQuZGVzYycsXG4gICAgICAgICAgICBmaWx0ZXJzID0gcHJvcCh7XG4gICAgICAgICAgICBvcmRlcjogZGVmYXVsdE9yZGVyXG4gICAgICAgIH0pLFxuICAgICAgICAgICAgaXNMb2FkaW5nID0gcHJvcChmYWxzZSksXG4gICAgICAgICAgICBwYWdlID0gcHJvcCgxKSxcbiAgICAgICAgICAgIHJlc3VsdHNDb3VudCA9IHByb3AoKSxcbiAgICAgICAgICAgIHBhZ2VSZXF1ZXN0ID0gYXV0aGVudGljYXRlID8gbW9kZWwuZ2V0UGFnZVdpdGhUb2tlbiA6IG1vZGVsLmdldFBhZ2UsXG4gICAgICAgICAgICB0b3RhbCA9IHByb3AoKTtcblxuICAgICAgICB2YXIgZmV0Y2ggPSBmdW5jdGlvbiBmZXRjaCgpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG5cbiAgICAgICAgICAgICAgICB2YXIgZ2V0VG90YWwgPSBmdW5jdGlvbiBnZXRUb3RhbCh4aHIpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF4aHIgfHwgeGhyLnN0YXR1cyA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoaW50OiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldGFpbHM6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnQ29ubmVjdGlvbiBlcnJvcidcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHZhciByYW5nZUhlYWRlciA9IHhoci5nZXRSZXNwb25zZUhlYWRlcignQ29udGVudC1SYW5nZScpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoXy5pc1N0cmluZyhyYW5nZUhlYWRlcikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBfcmFuZ2VIZWFkZXIkc3BsaXQgPSByYW5nZUhlYWRlci5zcGxpdCgnLycpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF9yYW5nZUhlYWRlciRzcGxpdDIgPSBfc2xpY2VkVG9BcnJheShfcmFuZ2VIZWFkZXIkc3BsaXQsIDIpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlYWRlclNpemUgPSBfcmFuZ2VIZWFkZXIkc3BsaXQyWzBdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlYWRlckNvdW50ID0gX3JhbmdlSGVhZGVyJHNwbGl0MlsxXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfaGVhZGVyU2l6ZSRzcGxpdCA9IGhlYWRlclNpemUuc3BsaXQoJy0nKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfaGVhZGVyU2l6ZSRzcGxpdDIgPSBfc2xpY2VkVG9BcnJheShfaGVhZGVyU2l6ZSRzcGxpdCwgMiksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVhZGVyRnJvbSA9IF9oZWFkZXJTaXplJHNwbGl0MlswXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoZWFkZXJUbyA9IF9oZWFkZXJTaXplJHNwbGl0MlsxXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0byA9IHBhcnNlSW50KGhlYWRlclRvKSArIDEgfHwgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcm9tID0gcGFyc2VJbnQoaGVhZGVyRnJvbSkgfHwgMDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdG90YWwocGFyc2VJbnQoaGVhZGVyQ291bnQpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdHNDb3VudCh0byAtIGZyb20pO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBKU09OLnBhcnNlKHhoci5yZXNwb25zZVRleHQpO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoaW50OiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldGFpbHM6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiB4aHIucmVzcG9uc2VUZXh0XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgaXNMb2FkaW5nKHRydWUpO1xuICAgICAgICAgICAgICAgIHBhZ2VSZXF1ZXN0KGZpbHRlcnMoKSwgcGFnZSgpLCB7XG4gICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBleHRyYWN0OiBnZXRUb3RhbFxuICAgICAgICAgICAgICAgIH0sIGV4dHJhSGVhZGVycykudGhlbihmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICAgICAgICAgICAgICBjb2xsZWN0aW9uKF8udW5pb24oY29sbGVjdGlvbigpLCBkYXRhKSk7XG4gICAgICAgICAgICAgICAgICAgIGlzTG9hZGluZyhmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoY29sbGVjdGlvbigpKTtcbiAgICAgICAgICAgICAgICB9KS5jYXRjaChmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgaXNMb2FkaW5nKGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgdG90YWwoMCk7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgICAgIGZpcnN0UGFnZSA9IGZ1bmN0aW9uIGZpcnN0UGFnZShwYXJhbWV0ZXJzKSB7XG4gICAgICAgICAgICBmaWx0ZXJzKF8uZXh0ZW5kKHtcbiAgICAgICAgICAgICAgICBvcmRlcjogZGVmYXVsdE9yZGVyXG4gICAgICAgICAgICB9LCBwYXJhbWV0ZXJzKSk7XG4gICAgICAgICAgICBjb2xsZWN0aW9uKFtdKTtcbiAgICAgICAgICAgIHBhZ2UoMSk7XG4gICAgICAgICAgICByZXR1cm4gZmV0Y2goKTtcbiAgICAgICAgfSxcbiAgICAgICAgICAgIGlzTGFzdFBhZ2UgPSBmdW5jdGlvbiBpc0xhc3RQYWdlKCkge1xuICAgICAgICAgICAgcmV0dXJuIG1vZGVsLnBhZ2VTaXplKCkgPiByZXN1bHRzQ291bnQoKTtcbiAgICAgICAgfSxcbiAgICAgICAgICAgIG5leHRQYWdlID0gZnVuY3Rpb24gbmV4dFBhZ2UoKSB7XG4gICAgICAgICAgICBwYWdlKHBhZ2UoKSArIDEpO1xuICAgICAgICAgICAgcmV0dXJuIGZldGNoKCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGNvbGxlY3Rpb246IGNvbGxlY3Rpb24sXG4gICAgICAgICAgICBmaXJzdFBhZ2U6IGZpcnN0UGFnZSxcbiAgICAgICAgICAgIGlzTG9hZGluZzogaXNMb2FkaW5nLFxuICAgICAgICAgICAgbmV4dFBhZ2U6IG5leHRQYWdlLFxuICAgICAgICAgICAgaXNMYXN0UGFnZTogaXNMYXN0UGFnZSxcbiAgICAgICAgICAgIHRvdGFsOiB0b3RhbCxcbiAgICAgICAgICAgIHJlc3VsdHNDb3VudDogcmVzdWx0c0NvdW50XG4gICAgICAgIH07XG4gICAgfTtcbn07XG5cbmZ1bmN0aW9uIFBvc3RncmVzdChtaXRocmlsSW5zdGFuY2UpIHtcbiAgICB2YXIgbSA9IG1pdGhyaWxJbnN0YW5jZTtcbiAgICB2YXIgcG9zdGdyZXN0ID0ge307XG4gICAgdmFyIHRva2VuID0gcHJvcCgpLFxuICAgICAgICBtZXJnZUNvbmZpZyA9IGZ1bmN0aW9uIG1lcmdlQ29uZmlnKGNvbmZpZywgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gb3B0aW9ucyAmJiBfLmlzRnVuY3Rpb24ob3B0aW9ucy5jb25maWcpID8gXy5jb21wb3NlKG9wdGlvbnMuY29uZmlnLCBjb25maWcpIDogY29uZmlnO1xuICAgIH0sXG4gICAgICAgIGFkZEhlYWRlcnMgPSBmdW5jdGlvbiBhZGRIZWFkZXJzKGhlYWRlcnMpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICh4aHIpIHtcbiAgICAgICAgICAgIF8uZWFjaChoZWFkZXJzLCBmdW5jdGlvbiAodmFsdWUsIGtleSkge1xuICAgICAgICAgICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKGtleSwgdmFsdWUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4geGhyO1xuICAgICAgICB9O1xuICAgIH0sXG4gICAgICAgIGFkZENvbmZpZ0hlYWRlcnMgPSBmdW5jdGlvbiBhZGRDb25maWdIZWFkZXJzKGhlYWRlcnMsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIF8uZXh0ZW5kKHt9LCBvcHRpb25zLCB7XG4gICAgICAgICAgICBjb25maWc6IG1lcmdlQ29uZmlnKGFkZEhlYWRlcnMoaGVhZGVycyksIG9wdGlvbnMpXG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgICAgIGNyZWF0ZUxvYWRlciA9IGZ1bmN0aW9uIGNyZWF0ZUxvYWRlcihyZXF1ZXN0RnVuY3Rpb24sIG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIGRlZmF1bHRTdGF0ZSA9IGFyZ3VtZW50cy5sZW5ndGggPiAyICYmIGFyZ3VtZW50c1syXSAhPT0gdW5kZWZpbmVkID8gYXJndW1lbnRzWzJdIDogZmFsc2U7XG5cbiAgICAgICAgdmFyIGxvYWRlciA9IHByb3AoZGVmYXVsdFN0YXRlKTtcbiAgICAgICAgbG9hZGVyLmxvYWQgPSBmdW5jdGlvbiAoKSB7XG5cbiAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICAgICAgbG9hZGVyKHRydWUpO1xuICAgICAgICAgICAgICAgIHJlcXVlc3RGdW5jdGlvbihfLmV4dGVuZCh7fSwgb3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kOiBmYWxzZVxuICAgICAgICAgICAgICAgIH0pKS50aGVuKGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvYWRlcihmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoZGF0YSk7XG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvYWRlcihmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIGxvYWRlcjtcbiAgICB9LFxuICAgICAgICByZXByZXNlbnRhdGlvbkhlYWRlciA9IHtcbiAgICAgICAgJ1ByZWZlcic6ICdyZXR1cm49cmVwcmVzZW50YXRpb24nXG4gICAgfTtcblxuICAgIHBvc3RncmVzdC50b2tlbiA9IHRva2VuO1xuXG4gICAgcG9zdGdyZXN0LmluaXQgPSBmdW5jdGlvbiAoYXBpUHJlZml4LCBhdXRoZW50aWNhdGlvbk9wdGlvbnMpIHtcbiAgICAgICAgdmFyIGdsb2JhbEhlYWRlciA9IGFyZ3VtZW50cy5sZW5ndGggPiAyICYmIGFyZ3VtZW50c1syXSAhPT0gdW5kZWZpbmVkID8gYXJndW1lbnRzWzJdIDoge307XG5cbiAgICAgICAgcG9zdGdyZXN0LnJlcXVlc3QgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAgICAgdmFyIGVycm9ySGFuZGxlciA9IGZ1bmN0aW9uIGVycm9ySGFuZGxlcih4aHIpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5wYXJzZSh4aHIucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgaGludDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldGFpbHM6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogeGhyLnJlc3BvbnNlVGV4dFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdmFyIGNvbmZpZ0hlYWRlcnNUb0FkZCA9IGFkZENvbmZpZ0hlYWRlcnMoZ2xvYmFsSGVhZGVyLCBfLmV4dGVuZCh7IGV4dHJhY3Q6IGVycm9ySGFuZGxlciB9LCBvcHRpb25zLCB7XG4gICAgICAgICAgICAgICAgdXJsOiBhcGlQcmVmaXggKyBvcHRpb25zLnVybFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgcmV0dXJuIG0ucmVxdWVzdChjb25maWdIZWFkZXJzVG9BZGQpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHZhciBhdXRoZW50aWNhdGlvblJlcXVlc3RlZCA9IHByb3AoZmFsc2UpO1xuICAgICAgICBwb3N0Z3Jlc3QuYXV0aGVudGljYXRlID0gZnVuY3Rpb24gKGRlbGVnYXRlZERlZmVycmVkKSB7XG4gICAgICAgICAgICB2YXIgZGVmZXJyZWQgPSBkZWxlZ2F0ZWREZWZlcnJlZCB8fCBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgICAgICAgdmFyIHdvcmtpbmdDYWxsID0gZnVuY3Rpb24gd29ya2luZ0NhbGwoKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0b2tlbigpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHsgdG9rZW46IHRva2VuKCkgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIWF1dGhlbnRpY2F0aW9uUmVxdWVzdGVkKCkpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgYXV0aGVudGljYXRpb25SZXF1ZXN0ZWQodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBtLnJlcXVlc3QoXy5leHRlbmQoe30sIGF1dGhlbnRpY2F0aW9uT3B0aW9ucykpLnRoZW4oZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhdXRoZW50aWNhdGlvblJlcXVlc3RlZChmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdG9rZW4oZGF0YS50b2tlbik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh7IHRva2VuOiB0b2tlbigpIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhdXRoZW50aWNhdGlvblJlcXVlc3RlZChmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGRhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KHdvcmtpbmdDYWxsLCAyNTApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB3b3JraW5nQ2FsbCgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gZGVmZXJyZWQ7XG4gICAgICAgIH07XG5cbiAgICAgICAgcG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4gPSBmdW5jdGlvbiAob3B0aW9ucykge1xuXG4gICAgICAgICAgICByZXR1cm4gcG9zdGdyZXN0LmF1dGhlbnRpY2F0ZSgpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBwb3N0Z3Jlc3QucmVxdWVzdChhZGRDb25maWdIZWFkZXJzKHtcbiAgICAgICAgICAgICAgICAgICAgJ0F1dGhvcml6YXRpb24nOiAnQmVhcmVyICcgKyB0b2tlbigpXG4gICAgICAgICAgICAgICAgfSwgb3B0aW9ucykpO1xuICAgICAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBwb3N0Z3Jlc3QucmVxdWVzdChvcHRpb25zKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIHBvc3RncmVzdC5sb2FkZXIgPSBfLnBhcnRpYWwoY3JlYXRlTG9hZGVyLCBwb3N0Z3Jlc3QucmVxdWVzdCk7XG5cbiAgICAgICAgcG9zdGdyZXN0LmxvYWRlcldpdGhUb2tlbiA9IF8ucGFydGlhbChjcmVhdGVMb2FkZXIsIHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuKTtcblxuICAgICAgICBwb3N0Z3Jlc3QubW9kZWwgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICAgICAgdmFyIHBhZ2luYXRpb25IZWFkZXJzID0gZnVuY3Rpb24gcGFnaW5hdGlvbkhlYWRlcnMocGFnZSwgcGFnZVNpemUpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXBhZ2VTaXplKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2YXIgdG9SYW5nZSA9IGZ1bmN0aW9uIHRvUmFuZ2UoKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBmcm9tID0gKHBhZ2UgLSAxKSAqIHBhZ2VTaXplLFxuICAgICAgICAgICAgICAgICAgICAgICAgdG8gPSBmcm9tICsgcGFnZVNpemUgLSAxO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZnJvbSArICctJyArIHRvO1xuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAnUmFuZ2UtdW5pdCc6ICdpdGVtcycsXG4gICAgICAgICAgICAgICAgICAgICdSYW5nZSc6IHRvUmFuZ2UoKVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHBhZ2VTaXplID0gcHJvcCgxMCksXG4gICAgICAgICAgICAgICAgbmFtZU9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgdXJsOiAnLycgKyBuYW1lXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGdldE9wdGlvbnMgPSBmdW5jdGlvbiBnZXRPcHRpb25zKGRhdGEsIHBhZ2UsIHBhZ2VTaXplLCBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgdmFyIGhlYWRlcnMgPSBhcmd1bWVudHMubGVuZ3RoID4gNCAmJiBhcmd1bWVudHNbNF0gIT09IHVuZGVmaW5lZCA/IGFyZ3VtZW50c1s0XSA6IHt9O1xuXG4gICAgICAgICAgICAgICAgdmFyIGV4dHJhSGVhZGVycyA9IF8uZXh0ZW5kKHt9LCB7XG4gICAgICAgICAgICAgICAgICAgICdQcmVmZXInOiAnY291bnQ9bm9uZSdcbiAgICAgICAgICAgICAgICB9LCBoZWFkZXJzLCBwYWdpbmF0aW9uSGVhZGVycyhwYWdlLCBwYWdlU2l6ZSkpO1xuICAgICAgICAgICAgICAgIHJldHVybiBhZGRDb25maWdIZWFkZXJzKGV4dHJhSGVhZGVycywgXy5leHRlbmQoe30sIG9wdGlvbnMsIG5hbWVPcHRpb25zLCB7XG4gICAgICAgICAgICAgICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IGRhdGFcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHF1ZXJ5c3RyaW5nID0gZnVuY3Rpb24gcXVlcnlzdHJpbmcoZmlsdGVycywgb3B0aW9ucykge1xuICAgICAgICAgICAgICAgIG9wdGlvbnMudXJsICs9ICc/JyArIG0ucm91dGUuYnVpbGRRdWVyeVN0cmluZyhmaWx0ZXJzKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gb3B0aW9ucztcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgb3B0aW9ucyA9IGZ1bmN0aW9uIG9wdGlvbnMoX29wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcG9zdGdyZXN0LnJlcXVlc3QoXy5leHRlbmQoe30sIF9vcHRpb25zLCBuYW1lT3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdPUFRJT05TJ1xuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcG9zdE9wdGlvbnMgPSBmdW5jdGlvbiBwb3N0T3B0aW9ucyhhdHRyaWJ1dGVzLCBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgdmFyIGhlYWRlcnMgPSBhcmd1bWVudHMubGVuZ3RoID4gMiAmJiBhcmd1bWVudHNbMl0gIT09IHVuZGVmaW5lZCA/IGFyZ3VtZW50c1syXSA6IHt9O1xuXG4gICAgICAgICAgICAgICAgdmFyIGV4dHJhSGVhZGVycyA9IF8uZXh0ZW5kKHt9LCByZXByZXNlbnRhdGlvbkhlYWRlciwgaGVhZGVycyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGFkZENvbmZpZ0hlYWRlcnMoZXh0cmFIZWFkZXJzLCBfLmV4dGVuZCh7fSwgb3B0aW9ucywgbmFtZU9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IGF0dHJpYnV0ZXNcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGRlbGV0ZU9wdGlvbnMgPSBmdW5jdGlvbiBkZWxldGVPcHRpb25zKGZpbHRlcnMsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICB2YXIgaGVhZGVycyA9IGFyZ3VtZW50cy5sZW5ndGggPiAyICYmIGFyZ3VtZW50c1syXSAhPT0gdW5kZWZpbmVkID8gYXJndW1lbnRzWzJdIDoge307XG5cbiAgICAgICAgICAgICAgICB2YXIgZXh0cmFIZWFkZXJzID0gXy5leHRlbmQoe30sIHJlcHJlc2VudGF0aW9uSGVhZGVyLCBoZWFkZXJzKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcXVlcnlzdHJpbmcoZmlsdGVycywgYWRkQ29uZmlnSGVhZGVycyhleHRyYUhlYWRlcnMsIF8uZXh0ZW5kKHt9LCBvcHRpb25zLCBuYW1lT3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdERUxFVEUnXG4gICAgICAgICAgICAgICAgfSkpKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcGF0Y2hPcHRpb25zID0gZnVuY3Rpb24gcGF0Y2hPcHRpb25zKGZpbHRlcnMsIGF0dHJpYnV0ZXMsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICB2YXIgaGVhZGVycyA9IGFyZ3VtZW50cy5sZW5ndGggPiAzICYmIGFyZ3VtZW50c1szXSAhPT0gdW5kZWZpbmVkID8gYXJndW1lbnRzWzNdIDoge307XG5cbiAgICAgICAgICAgICAgICB2YXIgZXh0cmFIZWFkZXJzID0gXy5leHRlbmQoe30sIHJlcHJlc2VudGF0aW9uSGVhZGVyLCBoZWFkZXJzKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcXVlcnlzdHJpbmcoZmlsdGVycywgYWRkQ29uZmlnSGVhZGVycyhleHRyYUhlYWRlcnMsIF8uZXh0ZW5kKHt9LCBvcHRpb25zLCBuYW1lT3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdQQVRDSCcsXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IGF0dHJpYnV0ZXNcbiAgICAgICAgICAgICAgICB9KSkpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBnZXRQYWdlT3B0aW9ucyA9IGZ1bmN0aW9uIGdldFBhZ2VPcHRpb25zKGRhdGEsIHBhZ2UsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICB2YXIgaGVhZGVycyA9IGFyZ3VtZW50cy5sZW5ndGggPiAzICYmIGFyZ3VtZW50c1szXSAhPT0gdW5kZWZpbmVkID8gYXJndW1lbnRzWzNdIDoge307XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gZ2V0T3B0aW9ucyhkYXRhLCBwYWdlIHx8IDEsIHBhZ2VTaXplKCksIG9wdGlvbnMsIGhlYWRlcnMpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBnZXRSb3dPcHRpb25zID0gZnVuY3Rpb24gZ2V0Um93T3B0aW9ucyhkYXRhLCBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgdmFyIGhlYWRlcnMgPSBhcmd1bWVudHMubGVuZ3RoID4gMiAmJiBhcmd1bWVudHNbMl0gIT09IHVuZGVmaW5lZCA/IGFyZ3VtZW50c1syXSA6IHt9O1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGdldE9wdGlvbnMoZGF0YSwgMSwgMSwgb3B0aW9ucywgaGVhZGVycyk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHBhZ2VTaXplOiBwYWdlU2l6ZSxcbiAgICAgICAgICAgICAgICBnZXRQYWdlT3B0aW9uczogZ2V0UGFnZU9wdGlvbnMsXG4gICAgICAgICAgICAgICAgZ2V0Um93T3B0aW9uczogZ2V0Um93T3B0aW9ucyxcbiAgICAgICAgICAgICAgICBwYXRjaE9wdGlvbnM6IHBhdGNoT3B0aW9ucyxcbiAgICAgICAgICAgICAgICBwb3N0T3B0aW9uczogcG9zdE9wdGlvbnMsXG4gICAgICAgICAgICAgICAgZGVsZXRlT3B0aW9uczogZGVsZXRlT3B0aW9ucyxcbiAgICAgICAgICAgICAgICBnZXRQYWdlOiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIGdldFBhZ2VPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBnZXRSb3c6IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgZ2V0Um93T3B0aW9ucyksXG4gICAgICAgICAgICAgICAgcGF0Y2g6IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgcGF0Y2hPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBwb3N0OiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIHBvc3RPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBkZWxldGVSZXF1ZXN0OiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIGRlbGV0ZU9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIGdldFBhZ2VXaXRoVG9rZW46IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgZ2V0UGFnZU9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIGdldFJvd1dpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBnZXRSb3dPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBwYXRjaFdpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBwYXRjaE9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIHBvc3RXaXRoVG9rZW46IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgcG9zdE9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIGRlbGV0ZVdpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBkZWxldGVPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBvcHRpb25zOiBvcHRpb25zXG4gICAgICAgICAgICB9O1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiBwb3N0Z3Jlc3Q7XG4gICAgfTtcblxuICAgIHBvc3RncmVzdC5maWx0ZXJzVk0gPSBmaWx0ZXJzVk07XG4gICAgcG9zdGdyZXN0LnBhZ2luYXRpb25WTSA9IHBhZ2luYXRpb25WTShtaXRocmlsSW5zdGFuY2UpO1xuXG4gICAgcmV0dXJuIHBvc3RncmVzdDtcbn1cblxucmV0dXJuIFBvc3RncmVzdDtcblxufSkpKTtcbiJdLCJmaWxlIjoic3JjLyoqLyouanMifQ==
