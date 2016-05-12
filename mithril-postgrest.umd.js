(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('mithril'), require('underscore')) :
    typeof define === 'function' && define.amd ? define(['mithril', 'underscore'], factory) :
    (global.postgrest = factory(global.m,global._));
}(this, function (m,_) { 'use strict';

    m = 'default' in m ? m['default'] : m;
    _ = 'default' in _ ? _['default'] : _;

    var babelHelpers = {};

    babelHelpers.slicedToArray = function () {
      function sliceIterator(arr, i) {
        var _arr = [];
        var _n = true;
        var _d = false;
        var _e = undefined;

        try {
          for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
            _arr.push(_s.value);

            if (i && _arr.length === i) break;
          }
        } catch (err) {
          _d = true;
          _e = err;
        } finally {
          try {
            if (!_n && _i["return"]) _i["return"]();
          } finally {
            if (_d) throw _e;
          }
        }

        return _arr;
      }

      return function (arr, i) {
        if (Array.isArray(arr)) {
          return arr;
        } else if (Symbol.iterator in Object(arr)) {
          return sliceIterator(arr, i);
        } else {
          throw new TypeError("Invalid attempt to destructure non-iterable instance");
        }
      };
    }();

    babelHelpers;

    var filtersVM = function filtersVM(attributes) {
        var newVM = {},
            filter = function filter() {
            var prop = m.prop(''),
                filterProp = function filterProp(value) {
                if (arguments.length > 0) {
                    prop(value);
                    return newVM;
                }
                return prop();
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

    var paginationVM = function paginationVM(model, order) {
        var extraHeaders = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];
        var authenticate = arguments.length <= 3 || arguments[3] === undefined ? true : arguments[3];

        var collection = m.prop([]),
            defaultOrder = order || 'id.desc',
            filters = m.prop({
            order: defaultOrder
        }),
            isLoading = m.prop(false),
            page = m.prop(1),
            resultsCount = m.prop(),
            pageRequest = authenticate ? model.getPageWithToken : model.getPage,
            total = m.prop();

        var fetch = function fetch() {
            var d = m.deferred();
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
                    var _rangeHeader$split = rangeHeader.split('/');

                    var _rangeHeader$split2 = babelHelpers.slicedToArray(_rangeHeader$split, 2);

                    var headerSize = _rangeHeader$split2[0];
                    var headerCount = _rangeHeader$split2[1];

                    var _headerSize$split = headerSize.split('-');

                    var _headerSize$split2 = babelHelpers.slicedToArray(_headerSize$split, 2);

                    var headerFrom = _headerSize$split2[0];
                    var headerTo = _headerSize$split2[1];
                    var to = parseInt(headerTo) + 1 || 0;
                    var from = parseInt(headerFrom) || 0;

                    total(parseInt(headerCount));
                    resultsCount(to - from);
                }
                try {
                    JSON.parse(xhr.responseText);
                    return xhr.responseText;
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
                background: true,
                extract: getTotal
            }, extraHeaders).then(function (data) {
                collection(_.union(collection(), data));
                isLoading(false);
                d.resolve(collection());
                m.redraw();
            }, function (error) {
                isLoading(false);
                total(0);
                d.reject(error);
                m.redraw();
            });
            return d.promise;
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

    var postgrest = {};

    var token = m.prop();
    var mergeConfig = function mergeConfig(config, options) {
        return options && _.isFunction(options.config) ? _.compose(options.config, config) : config;
    };
    var addHeaders = function addHeaders(headers) {
        return function (xhr) {
            _.each(headers, function (value, key) {
                xhr.setRequestHeader(key, value);
            });
            return xhr;
        };
    };
    var addConfigHeaders = function addConfigHeaders(headers, options) {
        return _.extend({}, options, {
            config: mergeConfig(addHeaders(headers), options)
        });
    };
    var createLoader = function createLoader(requestFunction, options) {
        var defaultState = arguments.length <= 2 || arguments[2] === undefined ? false : arguments[2];

        var loader = m.prop(defaultState),
            d = m.deferred();
        loader.load = function () {
            loader(true);
            m.redraw();
            requestFunction(_.extend({}, options, {
                background: true
            })).then(function (data) {
                loader(false);
                d.resolve(data);
                m.redraw();
            }, function (error) {
                loader(false);
                d.reject(error);
                m.redraw();
            });
            return d.promise;
        };
        return loader;
    };
    var representationHeader = {
        'Prefer': 'return=representation'
    };
    postgrest.token = token;

    postgrest.init = function (apiPrefix, authenticationOptions) {
        postgrest.request = function (options) {
            var errorHandler = function errorHandler(xhr) {
                try {
                    JSON.parse(xhr.responseText);
                    return xhr.responseText;
                } catch (ex) {
                    return JSON.stringify({
                        hint: null,
                        details: null,
                        code: 0,
                        message: xhr.responseText
                    });
                }
            };
            return m.request(_.extend({ extract: errorHandler }, options, {
                url: apiPrefix + options.url
            }));
        };

        postgrest.authenticate = function () {
            var deferred = m.deferred();
            if (token()) {
                deferred.resolve({
                    token: token()
                });
            } else {
                m.request(_.extend({}, authenticationOptions)).then(function (data) {
                    token(data.token);
                    deferred.resolve({
                        token: token()
                    });
                }, function (data) {
                    deferred.reject(data);
                });
            }
            return deferred.promise;
        };

        postgrest.requestWithToken = function (options) {
            return postgrest.authenticate().then(function () {
                return postgrest.request(addConfigHeaders({
                    'Authorization': 'Bearer ' + token()
                }, options));
            }, function () {
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
                pageSize = m.prop(10),
                nameOptions = {
                url: '/' + name
            },
                getOptions = function getOptions(data, page, pageSize, options) {
                var headers = arguments.length <= 4 || arguments[4] === undefined ? {} : arguments[4];

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
                var headers = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

                var extraHeaders = _.extend({}, representationHeader, headers);
                return addConfigHeaders(extraHeaders, _.extend({}, options, nameOptions, {
                    method: 'POST',
                    data: attributes
                }));
            },
                deleteOptions = function deleteOptions(filters, options) {
                var headers = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

                var extraHeaders = addHeaders(_.extend({}, headers));
                return querystring(filters, addConfigHeaders(extraHeaders, _.extend({}, options, nameOptions, {
                    method: 'DELETE'
                })));
            },
                patchOptions = function patchOptions(filters, attributes, options) {
                var headers = arguments.length <= 3 || arguments[3] === undefined ? {} : arguments[3];

                var extraHeaders = _.extend({}, representationHeader, headers);
                return querystring(filters, addConfigHeaders(extraHeaders, _.extend({}, options, nameOptions, {
                    method: 'PATCH',
                    data: attributes
                })));
            },
                getPageOptions = function getPageOptions(data, page, options) {
                var headers = arguments.length <= 3 || arguments[3] === undefined ? {} : arguments[3];

                return getOptions(data, page || 1, pageSize(), options, headers);
            },
                getRowOptions = function getRowOptions(data, options) {
                var headers = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

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
    postgrest.paginationVM = paginationVM;

    return postgrest;

}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJzcmMvKiovKi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gKGdsb2JhbCwgZmFjdG9yeSkge1xuICAgIHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyA/IG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeShyZXF1aXJlKCdtaXRocmlsJyksIHJlcXVpcmUoJ3VuZGVyc2NvcmUnKSkgOlxuICAgIHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCA/IGRlZmluZShbJ21pdGhyaWwnLCAndW5kZXJzY29yZSddLCBmYWN0b3J5KSA6XG4gICAgKGdsb2JhbC5wb3N0Z3Jlc3QgPSBmYWN0b3J5KGdsb2JhbC5tLGdsb2JhbC5fKSk7XG59KHRoaXMsIGZ1bmN0aW9uIChtLF8pIHsgJ3VzZSBzdHJpY3QnO1xuXG4gICAgbSA9ICdkZWZhdWx0JyBpbiBtID8gbVsnZGVmYXVsdCddIDogbTtcbiAgICBfID0gJ2RlZmF1bHQnIGluIF8gPyBfWydkZWZhdWx0J10gOiBfO1xuXG4gICAgdmFyIGJhYmVsSGVscGVycyA9IHt9O1xuXG4gICAgYmFiZWxIZWxwZXJzLnNsaWNlZFRvQXJyYXkgPSBmdW5jdGlvbiAoKSB7XG4gICAgICBmdW5jdGlvbiBzbGljZUl0ZXJhdG9yKGFyciwgaSkge1xuICAgICAgICB2YXIgX2FyciA9IFtdO1xuICAgICAgICB2YXIgX24gPSB0cnVlO1xuICAgICAgICB2YXIgX2QgPSBmYWxzZTtcbiAgICAgICAgdmFyIF9lID0gdW5kZWZpbmVkO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgZm9yICh2YXIgX2kgPSBhcnJbU3ltYm9sLml0ZXJhdG9yXSgpLCBfczsgIShfbiA9IChfcyA9IF9pLm5leHQoKSkuZG9uZSk7IF9uID0gdHJ1ZSkge1xuICAgICAgICAgICAgX2Fyci5wdXNoKF9zLnZhbHVlKTtcblxuICAgICAgICAgICAgaWYgKGkgJiYgX2Fyci5sZW5ndGggPT09IGkpIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgX2QgPSB0cnVlO1xuICAgICAgICAgIF9lID0gZXJyO1xuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAoIV9uICYmIF9pW1wicmV0dXJuXCJdKSBfaVtcInJldHVyblwiXSgpO1xuICAgICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICBpZiAoX2QpIHRocm93IF9lO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBfYXJyO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gZnVuY3Rpb24gKGFyciwgaSkge1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShhcnIpKSB7XG4gICAgICAgICAgcmV0dXJuIGFycjtcbiAgICAgICAgfSBlbHNlIGlmIChTeW1ib2wuaXRlcmF0b3IgaW4gT2JqZWN0KGFycikpIHtcbiAgICAgICAgICByZXR1cm4gc2xpY2VJdGVyYXRvcihhcnIsIGkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJJbnZhbGlkIGF0dGVtcHQgdG8gZGVzdHJ1Y3R1cmUgbm9uLWl0ZXJhYmxlIGluc3RhbmNlXCIpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0oKTtcblxuICAgIGJhYmVsSGVscGVycztcblxuICAgIHZhciBmaWx0ZXJzVk0gPSBmdW5jdGlvbiBmaWx0ZXJzVk0oYXR0cmlidXRlcykge1xuICAgICAgICB2YXIgbmV3Vk0gPSB7fSxcbiAgICAgICAgICAgIGZpbHRlciA9IGZ1bmN0aW9uIGZpbHRlcigpIHtcbiAgICAgICAgICAgIHZhciBwcm9wID0gbS5wcm9wKCcnKSxcbiAgICAgICAgICAgICAgICBmaWx0ZXJQcm9wID0gZnVuY3Rpb24gZmlsdGVyUHJvcCh2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBwcm9wKHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ld1ZNO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gcHJvcCgpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIC8vIEp1c3Qgc28gd2UgY2FuIGhhdmUgYSBkZWZhdWx0IHRvX2ZpbHRlciBhbmQgYXZvaWQgaWYgXy5pc0Z1bmN0aW9uIGNhbGxzXG4gICAgICAgICAgICBmaWx0ZXJQcm9wLnRvRmlsdGVyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBfLmlzU3RyaW5nKGZpbHRlclByb3AoKSkgPyBmaWx0ZXJQcm9wKCkudHJpbSgpIDogZmlsdGVyUHJvcCgpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiBmaWx0ZXJQcm9wO1xuICAgICAgICB9LFxuICAgICAgICAgICAgZ2V0dGVycyA9IF8ucmVkdWNlKGF0dHJpYnV0ZXMsIGZ1bmN0aW9uIChtZW1vLCBvcGVyYXRvciwgYXR0cikge1xuICAgICAgICAgICAgLy8gVGhlIG9wZXJhdG9yIGJldHdlZW4gaXMgaW1wbGVtZW50ZWQgd2l0aCB0d28gcHJvcGVydGllcywgb25lIGZvciBncmVhdGVyIHRoYW4gdmFsdWUgYW5kIGFub3RoZXIgZm9yIGxlc3NlciB0aGFuIHZhbHVlLlxuICAgICAgICAgICAgLy8gQm90aCBwcm9wZXJ0aWVzIGFyZSBzZW50IGluIHRoZSBxdWV1cnlzdHJpbmcgd2l0aCB0aGUgc2FtZSBuYW1lLFxuICAgICAgICAgICAgLy8gdGhhdCdzIHdoeSB3ZSBuZWVkIHRoZSBzcGVjaWFsIGNhc2UgaGVyZSwgc28gd2UgY2FuIHVzZSBhIHNpbXBsZSBtYXAgYXMgYXJndW1lbnQgdG8gZmlsdGVyc1ZNLlxuICAgICAgICAgICAgaWYgKG9wZXJhdG9yID09PSAnYmV0d2VlbicpIHtcbiAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0ge1xuICAgICAgICAgICAgICAgICAgICBsdGU6IGZpbHRlcigpLFxuICAgICAgICAgICAgICAgICAgICBndGU6IGZpbHRlcigpXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IGZpbHRlcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgIH0sIHtcbiAgICAgICAgICAgIG9yZGVyOiBmaWx0ZXIoKVxuICAgICAgICB9KSxcbiAgICAgICAgICAgIHBhcmFtZXRlcnNXaXRob3V0T3JkZXIgPSBmdW5jdGlvbiBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyKCkge1xuICAgICAgICAgICAgcmV0dXJuIF8ucmVkdWNlKGdldHRlcnMsIGZ1bmN0aW9uIChtZW1vLCBnZXR0ZXIsIGF0dHIpIHtcbiAgICAgICAgICAgICAgICBpZiAoYXR0ciAhPT0gJ29yZGVyJykge1xuICAgICAgICAgICAgICAgICAgICB2YXIgb3BlcmF0b3IgPSBhdHRyaWJ1dGVzW2F0dHJdO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChfLmlzRnVuY3Rpb24oZ2V0dGVyLnRvRmlsdGVyKSAmJiAoZ2V0dGVyLnRvRmlsdGVyKCkgPT09IHVuZGVmaW5lZCB8fCBnZXR0ZXIudG9GaWx0ZXIoKSA9PT0gJycpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIEJlbGxvdyB3ZSB1c2UgZGlmZmVyZW50IGZvcm1hdHRpbmcgcnVsZXMgZm9yIHRoZSB2YWx1ZSBkZXBlbmRpbmcgb24gdGhlIG9wZXJhdG9yXG4gICAgICAgICAgICAgICAgICAgIC8vIFRoZXNlIHJ1bGVzIGFyZSB1c2VkIHJlZ2FyZGxlc3Mgb2YgdGhlIHRvRmlsdGVyIGZ1bmN0aW9uLFxuICAgICAgICAgICAgICAgICAgICAvLyBzbyB0aGUgdXNlciBjYW4gdXNlIGEgY3VzdG9tIHRvRmlsdGVyIHdpdGhvdXQgaGF2aW5nIHRvIHdvcnJ5IHdpdGggYmFzaWMgZmlsdGVyIHN5bnRheFxuICAgICAgICAgICAgICAgICAgICBpZiAob3BlcmF0b3IgPT09ICdpbGlrZScgfHwgb3BlcmF0b3IgPT09ICdsaWtlJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IG9wZXJhdG9yICsgJy4qJyArIGdldHRlci50b0ZpbHRlcigpICsgJyonO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG9wZXJhdG9yID09PSAnQEAnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gb3BlcmF0b3IgKyAnLicgKyBnZXR0ZXIudG9GaWx0ZXIoKS5yZXBsYWNlKC9cXHMrL2csICcmJyk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAob3BlcmF0b3IgPT09ICdiZXR3ZWVuJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFnZXR0ZXIubHRlLnRvRmlsdGVyKCkgJiYgIWdldHRlci5ndGUudG9GaWx0ZXIoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGdldHRlci5ndGUoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lbW9bYXR0cl0ucHVzaCgnZ3RlLicgKyBnZXR0ZXIuZ3RlLnRvRmlsdGVyKCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGdldHRlci5sdGUoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lbW9bYXR0cl0ucHVzaCgnbHRlLicgKyBnZXR0ZXIubHRlLnRvRmlsdGVyKCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG9wZXJhdG9yID09PSAnaXMubnVsbCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lbW9bYXR0cl0gPSBnZXR0ZXIudG9GaWx0ZXIoKSA9PT0gbnVsbCA/ICdpcy5udWxsJyA6ICdub3QuaXMubnVsbCc7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gb3BlcmF0b3IgKyAnLicgKyBnZXR0ZXIudG9GaWx0ZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgICAgIH0sIHt9KTtcbiAgICAgICAgfSxcbiAgICAgICAgICAgIHBhcmFtZXRlcnMgPSBmdW5jdGlvbiBwYXJhbWV0ZXJzKCkge1xuICAgICAgICAgICAgLy8gVGhlIG9yZGVyIHBhcmFtZXRlcnMgaGF2ZSBhIHNwZWNpYWwgc3ludGF4IChqdXN0IGxpa2UgYW4gb3JkZXIgYnkgU1FMIGNsYXVzZSlcbiAgICAgICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9iZWdyaWZmcy9wb3N0Z3Jlc3Qvd2lraS9Sb3V0aW5nI2ZpbHRlcmluZy1hbmQtb3JkZXJpbmdcbiAgICAgICAgICAgIHZhciBvcmRlciA9IGZ1bmN0aW9uIG9yZGVyKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBnZXR0ZXJzLm9yZGVyKCkgJiYgXy5yZWR1Y2UoZ2V0dGVycy5vcmRlcigpLCBmdW5jdGlvbiAobWVtbywgZGlyZWN0aW9uLCBhdHRyKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lbW8ucHVzaChhdHRyICsgJy4nICsgZGlyZWN0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgICAgICAgICAgfSwgW10pLmpvaW4oJywnKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgb3JkZXJQYXJhbWV0ZXIgPSBvcmRlcigpID8ge1xuICAgICAgICAgICAgICAgIG9yZGVyOiBvcmRlcigpXG4gICAgICAgICAgICB9IDoge307XG5cbiAgICAgICAgICAgIHJldHVybiBfLmV4dGVuZCh7fSwgb3JkZXJQYXJhbWV0ZXIsIHBhcmFtZXRlcnNXaXRob3V0T3JkZXIoKSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIF8uZXh0ZW5kKG5ld1ZNLCBnZXR0ZXJzLCB7XG4gICAgICAgICAgICBwYXJhbWV0ZXJzOiBwYXJhbWV0ZXJzLFxuICAgICAgICAgICAgcGFyYW1ldGVyc1dpdGhvdXRPcmRlcjogcGFyYW1ldGVyc1dpdGhvdXRPcmRlclxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgdmFyIHBhZ2luYXRpb25WTSA9IGZ1bmN0aW9uIHBhZ2luYXRpb25WTShtb2RlbCwgb3JkZXIpIHtcbiAgICAgICAgdmFyIGV4dHJhSGVhZGVycyA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMiB8fCBhcmd1bWVudHNbMl0gPT09IHVuZGVmaW5lZCA/IHt9IDogYXJndW1lbnRzWzJdO1xuICAgICAgICB2YXIgYXV0aGVudGljYXRlID0gYXJndW1lbnRzLmxlbmd0aCA8PSAzIHx8IGFyZ3VtZW50c1szXSA9PT0gdW5kZWZpbmVkID8gdHJ1ZSA6IGFyZ3VtZW50c1szXTtcblxuICAgICAgICB2YXIgY29sbGVjdGlvbiA9IG0ucHJvcChbXSksXG4gICAgICAgICAgICBkZWZhdWx0T3JkZXIgPSBvcmRlciB8fCAnaWQuZGVzYycsXG4gICAgICAgICAgICBmaWx0ZXJzID0gbS5wcm9wKHtcbiAgICAgICAgICAgIG9yZGVyOiBkZWZhdWx0T3JkZXJcbiAgICAgICAgfSksXG4gICAgICAgICAgICBpc0xvYWRpbmcgPSBtLnByb3AoZmFsc2UpLFxuICAgICAgICAgICAgcGFnZSA9IG0ucHJvcCgxKSxcbiAgICAgICAgICAgIHJlc3VsdHNDb3VudCA9IG0ucHJvcCgpLFxuICAgICAgICAgICAgcGFnZVJlcXVlc3QgPSBhdXRoZW50aWNhdGUgPyBtb2RlbC5nZXRQYWdlV2l0aFRva2VuIDogbW9kZWwuZ2V0UGFnZSxcbiAgICAgICAgICAgIHRvdGFsID0gbS5wcm9wKCk7XG5cbiAgICAgICAgdmFyIGZldGNoID0gZnVuY3Rpb24gZmV0Y2goKSB7XG4gICAgICAgICAgICB2YXIgZCA9IG0uZGVmZXJyZWQoKTtcbiAgICAgICAgICAgIHZhciBnZXRUb3RhbCA9IGZ1bmN0aW9uIGdldFRvdGFsKHhocikge1xuICAgICAgICAgICAgICAgIGlmICgheGhyIHx8IHhoci5zdGF0dXMgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGhpbnQ6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXRhaWxzOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdDb25uZWN0aW9uIGVycm9yJ1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdmFyIHJhbmdlSGVhZGVyID0geGhyLmdldFJlc3BvbnNlSGVhZGVyKCdDb250ZW50LVJhbmdlJyk7XG4gICAgICAgICAgICAgICAgaWYgKF8uaXNTdHJpbmcocmFuZ2VIZWFkZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBfcmFuZ2VIZWFkZXIkc3BsaXQgPSByYW5nZUhlYWRlci5zcGxpdCgnLycpO1xuXG4gICAgICAgICAgICAgICAgICAgIHZhciBfcmFuZ2VIZWFkZXIkc3BsaXQyID0gYmFiZWxIZWxwZXJzLnNsaWNlZFRvQXJyYXkoX3JhbmdlSGVhZGVyJHNwbGl0LCAyKTtcblxuICAgICAgICAgICAgICAgICAgICB2YXIgaGVhZGVyU2l6ZSA9IF9yYW5nZUhlYWRlciRzcGxpdDJbMF07XG4gICAgICAgICAgICAgICAgICAgIHZhciBoZWFkZXJDb3VudCA9IF9yYW5nZUhlYWRlciRzcGxpdDJbMV07XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIF9oZWFkZXJTaXplJHNwbGl0ID0gaGVhZGVyU2l6ZS5zcGxpdCgnLScpO1xuXG4gICAgICAgICAgICAgICAgICAgIHZhciBfaGVhZGVyU2l6ZSRzcGxpdDIgPSBiYWJlbEhlbHBlcnMuc2xpY2VkVG9BcnJheShfaGVhZGVyU2l6ZSRzcGxpdCwgMik7XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIGhlYWRlckZyb20gPSBfaGVhZGVyU2l6ZSRzcGxpdDJbMF07XG4gICAgICAgICAgICAgICAgICAgIHZhciBoZWFkZXJUbyA9IF9oZWFkZXJTaXplJHNwbGl0MlsxXTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHRvID0gcGFyc2VJbnQoaGVhZGVyVG8pICsgMSB8fCAwO1xuICAgICAgICAgICAgICAgICAgICB2YXIgZnJvbSA9IHBhcnNlSW50KGhlYWRlckZyb20pIHx8IDA7XG5cbiAgICAgICAgICAgICAgICAgICAgdG90YWwocGFyc2VJbnQoaGVhZGVyQ291bnQpKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0c0NvdW50KHRvIC0gZnJvbSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIEpTT04ucGFyc2UoeGhyLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB4aHIucmVzcG9uc2VUZXh0O1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBoaW50OiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGV0YWlsczogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiB4aHIucmVzcG9uc2VUZXh0XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpc0xvYWRpbmcodHJ1ZSk7XG4gICAgICAgICAgICBwYWdlUmVxdWVzdChmaWx0ZXJzKCksIHBhZ2UoKSwge1xuICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6IHRydWUsXG4gICAgICAgICAgICAgICAgZXh0cmFjdDogZ2V0VG90YWxcbiAgICAgICAgICAgIH0sIGV4dHJhSGVhZGVycykudGhlbihmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICAgICAgICAgIGNvbGxlY3Rpb24oXy51bmlvbihjb2xsZWN0aW9uKCksIGRhdGEpKTtcbiAgICAgICAgICAgICAgICBpc0xvYWRpbmcoZmFsc2UpO1xuICAgICAgICAgICAgICAgIGQucmVzb2x2ZShjb2xsZWN0aW9uKCkpO1xuICAgICAgICAgICAgICAgIG0ucmVkcmF3KCk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBpc0xvYWRpbmcoZmFsc2UpO1xuICAgICAgICAgICAgICAgIHRvdGFsKDApO1xuICAgICAgICAgICAgICAgIGQucmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgICAgICBtLnJlZHJhdygpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gZC5wcm9taXNlO1xuICAgICAgICB9LFxuICAgICAgICAgICAgZmlyc3RQYWdlID0gZnVuY3Rpb24gZmlyc3RQYWdlKHBhcmFtZXRlcnMpIHtcbiAgICAgICAgICAgIGZpbHRlcnMoXy5leHRlbmQoe1xuICAgICAgICAgICAgICAgIG9yZGVyOiBkZWZhdWx0T3JkZXJcbiAgICAgICAgICAgIH0sIHBhcmFtZXRlcnMpKTtcbiAgICAgICAgICAgIGNvbGxlY3Rpb24oW10pO1xuICAgICAgICAgICAgcGFnZSgxKTtcbiAgICAgICAgICAgIHJldHVybiBmZXRjaCgpO1xuICAgICAgICB9LFxuICAgICAgICAgICAgaXNMYXN0UGFnZSA9IGZ1bmN0aW9uIGlzTGFzdFBhZ2UoKSB7XG4gICAgICAgICAgICByZXR1cm4gbW9kZWwucGFnZVNpemUoKSA+IHJlc3VsdHNDb3VudCgpO1xuICAgICAgICB9LFxuICAgICAgICAgICAgbmV4dFBhZ2UgPSBmdW5jdGlvbiBuZXh0UGFnZSgpIHtcbiAgICAgICAgICAgIHBhZ2UocGFnZSgpICsgMSk7XG4gICAgICAgICAgICByZXR1cm4gZmV0Y2goKTtcbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY29sbGVjdGlvbjogY29sbGVjdGlvbixcbiAgICAgICAgICAgIGZpcnN0UGFnZTogZmlyc3RQYWdlLFxuICAgICAgICAgICAgaXNMb2FkaW5nOiBpc0xvYWRpbmcsXG4gICAgICAgICAgICBuZXh0UGFnZTogbmV4dFBhZ2UsXG4gICAgICAgICAgICBpc0xhc3RQYWdlOiBpc0xhc3RQYWdlLFxuICAgICAgICAgICAgdG90YWw6IHRvdGFsLFxuICAgICAgICAgICAgcmVzdWx0c0NvdW50OiByZXN1bHRzQ291bnRcbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgdmFyIHBvc3RncmVzdCA9IHt9O1xuXG4gICAgdmFyIHRva2VuID0gbS5wcm9wKCk7XG4gICAgdmFyIG1lcmdlQ29uZmlnID0gZnVuY3Rpb24gbWVyZ2VDb25maWcoY29uZmlnLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiBvcHRpb25zICYmIF8uaXNGdW5jdGlvbihvcHRpb25zLmNvbmZpZykgPyBfLmNvbXBvc2Uob3B0aW9ucy5jb25maWcsIGNvbmZpZykgOiBjb25maWc7XG4gICAgfTtcbiAgICB2YXIgYWRkSGVhZGVycyA9IGZ1bmN0aW9uIGFkZEhlYWRlcnMoaGVhZGVycykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHhocikge1xuICAgICAgICAgICAgXy5lYWNoKGhlYWRlcnMsIGZ1bmN0aW9uICh2YWx1ZSwga2V5KSB7XG4gICAgICAgICAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoa2V5LCB2YWx1ZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiB4aHI7XG4gICAgICAgIH07XG4gICAgfTtcbiAgICB2YXIgYWRkQ29uZmlnSGVhZGVycyA9IGZ1bmN0aW9uIGFkZENvbmZpZ0hlYWRlcnMoaGVhZGVycywgb3B0aW9ucykge1xuICAgICAgICByZXR1cm4gXy5leHRlbmQoe30sIG9wdGlvbnMsIHtcbiAgICAgICAgICAgIGNvbmZpZzogbWVyZ2VDb25maWcoYWRkSGVhZGVycyhoZWFkZXJzKSwgb3B0aW9ucylcbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICB2YXIgY3JlYXRlTG9hZGVyID0gZnVuY3Rpb24gY3JlYXRlTG9hZGVyKHJlcXVlc3RGdW5jdGlvbiwgb3B0aW9ucykge1xuICAgICAgICB2YXIgZGVmYXVsdFN0YXRlID0gYXJndW1lbnRzLmxlbmd0aCA8PSAyIHx8IGFyZ3VtZW50c1syXSA9PT0gdW5kZWZpbmVkID8gZmFsc2UgOiBhcmd1bWVudHNbMl07XG5cbiAgICAgICAgdmFyIGxvYWRlciA9IG0ucHJvcChkZWZhdWx0U3RhdGUpLFxuICAgICAgICAgICAgZCA9IG0uZGVmZXJyZWQoKTtcbiAgICAgICAgbG9hZGVyLmxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBsb2FkZXIodHJ1ZSk7XG4gICAgICAgICAgICBtLnJlZHJhdygpO1xuICAgICAgICAgICAgcmVxdWVzdEZ1bmN0aW9uKF8uZXh0ZW5kKHt9LCBvcHRpb25zLCB7XG4gICAgICAgICAgICAgICAgYmFja2dyb3VuZDogdHJ1ZVxuICAgICAgICAgICAgfSkpLnRoZW4oZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAgICAgICBsb2FkZXIoZmFsc2UpO1xuICAgICAgICAgICAgICAgIGQucmVzb2x2ZShkYXRhKTtcbiAgICAgICAgICAgICAgICBtLnJlZHJhdygpO1xuICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgbG9hZGVyKGZhbHNlKTtcbiAgICAgICAgICAgICAgICBkLnJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgbS5yZWRyYXcoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIGQucHJvbWlzZTtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIGxvYWRlcjtcbiAgICB9O1xuICAgIHZhciByZXByZXNlbnRhdGlvbkhlYWRlciA9IHtcbiAgICAgICAgJ1ByZWZlcic6ICdyZXR1cm49cmVwcmVzZW50YXRpb24nXG4gICAgfTtcbiAgICBwb3N0Z3Jlc3QudG9rZW4gPSB0b2tlbjtcblxuICAgIHBvc3RncmVzdC5pbml0ID0gZnVuY3Rpb24gKGFwaVByZWZpeCwgYXV0aGVudGljYXRpb25PcHRpb25zKSB7XG4gICAgICAgIHBvc3RncmVzdC5yZXF1ZXN0ID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHZhciBlcnJvckhhbmRsZXIgPSBmdW5jdGlvbiBlcnJvckhhbmRsZXIoeGhyKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgSlNPTi5wYXJzZSh4aHIucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHhoci5yZXNwb25zZVRleHQ7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGhpbnQ6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXRhaWxzOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IHhoci5yZXNwb25zZVRleHRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiBtLnJlcXVlc3QoXy5leHRlbmQoeyBleHRyYWN0OiBlcnJvckhhbmRsZXIgfSwgb3B0aW9ucywge1xuICAgICAgICAgICAgICAgIHVybDogYXBpUHJlZml4ICsgb3B0aW9ucy51cmxcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfTtcblxuICAgICAgICBwb3N0Z3Jlc3QuYXV0aGVudGljYXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGRlZmVycmVkID0gbS5kZWZlcnJlZCgpO1xuICAgICAgICAgICAgaWYgKHRva2VuKCkpIHtcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHtcbiAgICAgICAgICAgICAgICAgICAgdG9rZW46IHRva2VuKClcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbS5yZXF1ZXN0KF8uZXh0ZW5kKHt9LCBhdXRoZW50aWNhdGlvbk9wdGlvbnMpKS50aGVuKGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIHRva2VuKGRhdGEudG9rZW4pO1xuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRva2VuOiB0b2tlbigpXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChkYXRhKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgICAgICB9O1xuXG4gICAgICAgIHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHJldHVybiBwb3N0Z3Jlc3QuYXV0aGVudGljYXRlKCkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBvc3RncmVzdC5yZXF1ZXN0KGFkZENvbmZpZ0hlYWRlcnMoe1xuICAgICAgICAgICAgICAgICAgICAnQXV0aG9yaXphdGlvbic6ICdCZWFyZXIgJyArIHRva2VuKClcbiAgICAgICAgICAgICAgICB9LCBvcHRpb25zKSk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBvc3RncmVzdC5yZXF1ZXN0KG9wdGlvbnMpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgcG9zdGdyZXN0LmxvYWRlciA9IF8ucGFydGlhbChjcmVhdGVMb2FkZXIsIHBvc3RncmVzdC5yZXF1ZXN0KTtcblxuICAgICAgICBwb3N0Z3Jlc3QubG9hZGVyV2l0aFRva2VuID0gXy5wYXJ0aWFsKGNyZWF0ZUxvYWRlciwgcG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4pO1xuXG4gICAgICAgIHBvc3RncmVzdC5tb2RlbCA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgICAgICB2YXIgcGFnaW5hdGlvbkhlYWRlcnMgPSBmdW5jdGlvbiBwYWdpbmF0aW9uSGVhZGVycyhwYWdlLCBwYWdlU2l6ZSkge1xuICAgICAgICAgICAgICAgIGlmICghcGFnZVNpemUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZhciB0b1JhbmdlID0gZnVuY3Rpb24gdG9SYW5nZSgpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZyb20gPSAocGFnZSAtIDEpICogcGFnZVNpemUsXG4gICAgICAgICAgICAgICAgICAgICAgICB0byA9IGZyb20gKyBwYWdlU2l6ZSAtIDE7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmcm9tICsgJy0nICsgdG87XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICdSYW5nZS11bml0JzogJ2l0ZW1zJyxcbiAgICAgICAgICAgICAgICAgICAgJ1JhbmdlJzogdG9SYW5nZSgpXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcGFnZVNpemUgPSBtLnByb3AoMTApLFxuICAgICAgICAgICAgICAgIG5hbWVPcHRpb25zID0ge1xuICAgICAgICAgICAgICAgIHVybDogJy8nICsgbmFtZVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBnZXRPcHRpb25zID0gZnVuY3Rpb24gZ2V0T3B0aW9ucyhkYXRhLCBwYWdlLCBwYWdlU2l6ZSwgb3B0aW9ucykge1xuICAgICAgICAgICAgICAgIHZhciBoZWFkZXJzID0gYXJndW1lbnRzLmxlbmd0aCA8PSA0IHx8IGFyZ3VtZW50c1s0XSA9PT0gdW5kZWZpbmVkID8ge30gOiBhcmd1bWVudHNbNF07XG5cbiAgICAgICAgICAgICAgICB2YXIgZXh0cmFIZWFkZXJzID0gXy5leHRlbmQoe30sIHtcbiAgICAgICAgICAgICAgICAgICAgJ1ByZWZlcic6ICdjb3VudD1ub25lJ1xuICAgICAgICAgICAgICAgIH0sIGhlYWRlcnMsIHBhZ2luYXRpb25IZWFkZXJzKHBhZ2UsIHBhZ2VTaXplKSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGFkZENvbmZpZ0hlYWRlcnMoZXh0cmFIZWFkZXJzLCBfLmV4dGVuZCh7fSwgb3B0aW9ucywgbmFtZU9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogZGF0YVxuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcXVlcnlzdHJpbmcgPSBmdW5jdGlvbiBxdWVyeXN0cmluZyhmaWx0ZXJzLCBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgb3B0aW9ucy51cmwgKz0gJz8nICsgbS5yb3V0ZS5idWlsZFF1ZXJ5U3RyaW5nKGZpbHRlcnMpO1xuICAgICAgICAgICAgICAgIHJldHVybiBvcHRpb25zO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBvcHRpb25zID0gZnVuY3Rpb24gb3B0aW9ucyhfb3B0aW9ucykge1xuICAgICAgICAgICAgICAgIHJldHVybiBwb3N0Z3Jlc3QucmVxdWVzdChfLmV4dGVuZCh7fSwgX29wdGlvbnMsIG5hbWVPcHRpb25zLCB7XG4gICAgICAgICAgICAgICAgICAgIG1ldGhvZDogJ09QVElPTlMnXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBwb3N0T3B0aW9ucyA9IGZ1bmN0aW9uIHBvc3RPcHRpb25zKGF0dHJpYnV0ZXMsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICB2YXIgaGVhZGVycyA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMiB8fCBhcmd1bWVudHNbMl0gPT09IHVuZGVmaW5lZCA/IHt9IDogYXJndW1lbnRzWzJdO1xuXG4gICAgICAgICAgICAgICAgdmFyIGV4dHJhSGVhZGVycyA9IF8uZXh0ZW5kKHt9LCByZXByZXNlbnRhdGlvbkhlYWRlciwgaGVhZGVycyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGFkZENvbmZpZ0hlYWRlcnMoZXh0cmFIZWFkZXJzLCBfLmV4dGVuZCh7fSwgb3B0aW9ucywgbmFtZU9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IGF0dHJpYnV0ZXNcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGRlbGV0ZU9wdGlvbnMgPSBmdW5jdGlvbiBkZWxldGVPcHRpb25zKGZpbHRlcnMsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICB2YXIgaGVhZGVycyA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMiB8fCBhcmd1bWVudHNbMl0gPT09IHVuZGVmaW5lZCA/IHt9IDogYXJndW1lbnRzWzJdO1xuXG4gICAgICAgICAgICAgICAgdmFyIGV4dHJhSGVhZGVycyA9IGFkZEhlYWRlcnMoXy5leHRlbmQoe30sIGhlYWRlcnMpKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcXVlcnlzdHJpbmcoZmlsdGVycywgYWRkQ29uZmlnSGVhZGVycyhleHRyYUhlYWRlcnMsIF8uZXh0ZW5kKHt9LCBvcHRpb25zLCBuYW1lT3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdERUxFVEUnXG4gICAgICAgICAgICAgICAgfSkpKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcGF0Y2hPcHRpb25zID0gZnVuY3Rpb24gcGF0Y2hPcHRpb25zKGZpbHRlcnMsIGF0dHJpYnV0ZXMsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICB2YXIgaGVhZGVycyA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMyB8fCBhcmd1bWVudHNbM10gPT09IHVuZGVmaW5lZCA/IHt9IDogYXJndW1lbnRzWzNdO1xuXG4gICAgICAgICAgICAgICAgdmFyIGV4dHJhSGVhZGVycyA9IF8uZXh0ZW5kKHt9LCByZXByZXNlbnRhdGlvbkhlYWRlciwgaGVhZGVycyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHF1ZXJ5c3RyaW5nKGZpbHRlcnMsIGFkZENvbmZpZ0hlYWRlcnMoZXh0cmFIZWFkZXJzLCBfLmV4dGVuZCh7fSwgb3B0aW9ucywgbmFtZU9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnUEFUQ0gnLFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiBhdHRyaWJ1dGVzXG4gICAgICAgICAgICAgICAgfSkpKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZ2V0UGFnZU9wdGlvbnMgPSBmdW5jdGlvbiBnZXRQYWdlT3B0aW9ucyhkYXRhLCBwYWdlLCBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgdmFyIGhlYWRlcnMgPSBhcmd1bWVudHMubGVuZ3RoIDw9IDMgfHwgYXJndW1lbnRzWzNdID09PSB1bmRlZmluZWQgPyB7fSA6IGFyZ3VtZW50c1szXTtcblxuICAgICAgICAgICAgICAgIHJldHVybiBnZXRPcHRpb25zKGRhdGEsIHBhZ2UgfHwgMSwgcGFnZVNpemUoKSwgb3B0aW9ucywgaGVhZGVycyk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGdldFJvd09wdGlvbnMgPSBmdW5jdGlvbiBnZXRSb3dPcHRpb25zKGRhdGEsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICB2YXIgaGVhZGVycyA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMiB8fCBhcmd1bWVudHNbMl0gPT09IHVuZGVmaW5lZCA/IHt9IDogYXJndW1lbnRzWzJdO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGdldE9wdGlvbnMoZGF0YSwgMSwgMSwgb3B0aW9ucywgaGVhZGVycyk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHBhZ2VTaXplOiBwYWdlU2l6ZSxcbiAgICAgICAgICAgICAgICBnZXRQYWdlT3B0aW9uczogZ2V0UGFnZU9wdGlvbnMsXG4gICAgICAgICAgICAgICAgZ2V0Um93T3B0aW9uczogZ2V0Um93T3B0aW9ucyxcbiAgICAgICAgICAgICAgICBwYXRjaE9wdGlvbnM6IHBhdGNoT3B0aW9ucyxcbiAgICAgICAgICAgICAgICBwb3N0T3B0aW9uczogcG9zdE9wdGlvbnMsXG4gICAgICAgICAgICAgICAgZGVsZXRlT3B0aW9uczogZGVsZXRlT3B0aW9ucyxcbiAgICAgICAgICAgICAgICBnZXRQYWdlOiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIGdldFBhZ2VPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBnZXRSb3c6IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgZ2V0Um93T3B0aW9ucyksXG4gICAgICAgICAgICAgICAgcGF0Y2g6IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgcGF0Y2hPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBwb3N0OiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIHBvc3RPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBkZWxldGVSZXF1ZXN0OiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIGRlbGV0ZU9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIGdldFBhZ2VXaXRoVG9rZW46IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgZ2V0UGFnZU9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIGdldFJvd1dpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBnZXRSb3dPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBwYXRjaFdpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBwYXRjaE9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIHBvc3RXaXRoVG9rZW46IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgcG9zdE9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIGRlbGV0ZVdpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBkZWxldGVPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBvcHRpb25zOiBvcHRpb25zXG4gICAgICAgICAgICB9O1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiBwb3N0Z3Jlc3Q7XG4gICAgfTtcblxuICAgIHBvc3RncmVzdC5maWx0ZXJzVk0gPSBmaWx0ZXJzVk07XG4gICAgcG9zdGdyZXN0LnBhZ2luYXRpb25WTSA9IHBhZ2luYXRpb25WTTtcblxuICAgIHJldHVybiBwb3N0Z3Jlc3Q7XG5cbn0pKTsiXSwiZmlsZSI6InNyYy8qKi8qLmpzIiwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=
