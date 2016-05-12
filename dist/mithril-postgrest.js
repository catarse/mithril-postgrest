var postgrest = (function (m,_) {
    'use strict';

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

}(m,_));

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjLyoqLyouanMiLCJzb3VyY2VzIjpbInNyYy92bXMvZmlsdGVyc1ZNLmpzIiwic3JjL3Ztcy9wYWdpbmF0aW9uVk0uanMiLCJzcmMvcG9zdGdyZXN0LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBtIGZyb20gJ21pdGhyaWwnO1xuaW1wb3J0IF8gZnJvbSAndW5kZXJzY29yZSc7XG5cbmNvbnN0IGZpbHRlcnNWTSA9IChhdHRyaWJ1dGVzKSA9PiB7XG4gICAgbGV0IG5ld1ZNID0ge30sXG4gICAgICAgIGZpbHRlciA9ICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHByb3AgPSBtLnByb3AoJycpLFxuICAgICAgICAgICAgICAgIGZpbHRlclByb3AgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wKHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXdWTTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcHJvcCgpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAvLyBKdXN0IHNvIHdlIGNhbiBoYXZlIGEgZGVmYXVsdCB0b19maWx0ZXIgYW5kIGF2b2lkIGlmIF8uaXNGdW5jdGlvbiBjYWxsc1xuICAgICAgICAgICAgZmlsdGVyUHJvcC50b0ZpbHRlciA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gXy5pc1N0cmluZyhmaWx0ZXJQcm9wKCkpID8gZmlsdGVyUHJvcCgpLnRyaW0oKSA6IGZpbHRlclByb3AoKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXR1cm4gZmlsdGVyUHJvcDtcbiAgICAgICAgfSxcblxuICAgICAgICBnZXR0ZXJzID0gXy5yZWR1Y2UoXG4gICAgICAgICAgICBhdHRyaWJ1dGVzLCAobWVtbywgb3BlcmF0b3IsIGF0dHIpID0+IHtcbiAgICAgICAgICAgICAgICAvLyBUaGUgb3BlcmF0b3IgYmV0d2VlbiBpcyBpbXBsZW1lbnRlZCB3aXRoIHR3byBwcm9wZXJ0aWVzLCBvbmUgZm9yIGdyZWF0ZXIgdGhhbiB2YWx1ZSBhbmQgYW5vdGhlciBmb3IgbGVzc2VyIHRoYW4gdmFsdWUuXG4gICAgICAgICAgICAgICAgLy8gQm90aCBwcm9wZXJ0aWVzIGFyZSBzZW50IGluIHRoZSBxdWV1cnlzdHJpbmcgd2l0aCB0aGUgc2FtZSBuYW1lLFxuICAgICAgICAgICAgICAgIC8vIHRoYXQncyB3aHkgd2UgbmVlZCB0aGUgc3BlY2lhbCBjYXNlIGhlcmUsIHNvIHdlIGNhbiB1c2UgYSBzaW1wbGUgbWFwIGFzIGFyZ3VtZW50IHRvIGZpbHRlcnNWTS5cbiAgICAgICAgICAgICAgICBpZiAob3BlcmF0b3IgPT09ICdiZXR3ZWVuJykge1xuICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbHRlOiBmaWx0ZXIoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGd0ZTogZmlsdGVyKClcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gZmlsdGVyKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICAgIG9yZGVyOiBmaWx0ZXIoKVxuICAgICAgICAgICAgfVxuICAgICAgICApLFxuXG4gICAgICAgIHBhcmFtZXRlcnNXaXRob3V0T3JkZXIgPSAoKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gXy5yZWR1Y2UoXG4gICAgICAgICAgICAgICAgZ2V0dGVycywgKG1lbW8sIGdldHRlciwgYXR0cikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXR0ciAhPT0gJ29yZGVyJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3BlcmF0b3IgPSBhdHRyaWJ1dGVzW2F0dHJdO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoXy5pc0Z1bmN0aW9uKGdldHRlci50b0ZpbHRlcikgJiYgKGdldHRlci50b0ZpbHRlcigpID09PSB1bmRlZmluZWQgfHwgZ2V0dGVyLnRvRmlsdGVyKCkgPT09ICcnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBCZWxsb3cgd2UgdXNlIGRpZmZlcmVudCBmb3JtYXR0aW5nIHJ1bGVzIGZvciB0aGUgdmFsdWUgZGVwZW5kaW5nIG9uIHRoZSBvcGVyYXRvclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVGhlc2UgcnVsZXMgYXJlIHVzZWQgcmVnYXJkbGVzcyBvZiB0aGUgdG9GaWx0ZXIgZnVuY3Rpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBzbyB0aGUgdXNlciBjYW4gdXNlIGEgY3VzdG9tIHRvRmlsdGVyIHdpdGhvdXQgaGF2aW5nIHRvIHdvcnJ5IHdpdGggYmFzaWMgZmlsdGVyIHN5bnRheFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9wZXJhdG9yID09PSAnaWxpa2UnIHx8IG9wZXJhdG9yID09PSAnbGlrZScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gb3BlcmF0b3IgKyAnLionICsgZ2V0dGVyLnRvRmlsdGVyKCkgKyAnKic7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG9wZXJhdG9yID09PSAnQEAnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IG9wZXJhdG9yICsgJy4nICsgZ2V0dGVyLnRvRmlsdGVyKCkucmVwbGFjZSgvXFxzKy9nLCAnJicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChvcGVyYXRvciA9PT0gJ2JldHdlZW4nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFnZXR0ZXIubHRlLnRvRmlsdGVyKCkgJiYgIWdldHRlci5ndGUudG9GaWx0ZXIoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChnZXR0ZXIuZ3RlKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXS5wdXNoKCdndGUuJyArIGdldHRlci5ndGUudG9GaWx0ZXIoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChnZXR0ZXIubHRlKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXS5wdXNoKCdsdGUuJyArIGdldHRlci5sdGUudG9GaWx0ZXIoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChvcGVyYXRvciA9PT0gJ2lzLm51bGwnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IGdldHRlci50b0ZpbHRlcigpID09PSBudWxsID8gJ2lzLm51bGwnIDogJ25vdC5pcy5udWxsJztcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IG9wZXJhdG9yICsgJy4nICsgZ2V0dGVyLnRvRmlsdGVyKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgICAgICAgICAgfSwge31cbiAgICAgICAgICAgICk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgcGFyYW1ldGVycyA9ICgpID0+IHtcbiAgICAgICAgICAgIC8vIFRoZSBvcmRlciBwYXJhbWV0ZXJzIGhhdmUgYSBzcGVjaWFsIHN5bnRheCAoanVzdCBsaWtlIGFuIG9yZGVyIGJ5IFNRTCBjbGF1c2UpXG4gICAgICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vYmVncmlmZnMvcG9zdGdyZXN0L3dpa2kvUm91dGluZyNmaWx0ZXJpbmctYW5kLW9yZGVyaW5nXG4gICAgICAgICAgICBjb25zdCBvcmRlciA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZ2V0dGVycy5vcmRlcigpICYmIF8ucmVkdWNlKFxuICAgICAgICAgICAgICAgICAgICBnZXR0ZXJzLm9yZGVyKCksIChtZW1vLCBkaXJlY3Rpb24sIGF0dHIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lbW8ucHVzaChhdHRyICsgJy4nICsgZGlyZWN0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgICAgICAgICB9LCBbXVxuICAgICAgICAgICAgICAgICkuam9pbignLCcpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgIG9yZGVyUGFyYW1ldGVyID0gb3JkZXIoKSA/IHtcbiAgICAgICAgICAgICAgICAgICAgb3JkZXI6IG9yZGVyKClcbiAgICAgICAgICAgICAgICB9IDoge307XG5cbiAgICAgICAgICAgIHJldHVybiBfLmV4dGVuZCh7fSwgb3JkZXJQYXJhbWV0ZXIsIHBhcmFtZXRlcnNXaXRob3V0T3JkZXIoKSk7XG5cbiAgICAgICAgfTtcblxuICAgIHJldHVybiBfLmV4dGVuZChuZXdWTSwgZ2V0dGVycywge1xuICAgICAgICBwYXJhbWV0ZXJzOiBwYXJhbWV0ZXJzLFxuICAgICAgICBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyOiBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyXG4gICAgfSk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBmaWx0ZXJzVk07XG4iLCJpbXBvcnQgbSBmcm9tICdtaXRocmlsJztcbmltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuXG5jb25zdCBwYWdpbmF0aW9uVk0gPSAobW9kZWwsIG9yZGVyLCBleHRyYUhlYWRlcnMgPSB7fSwgYXV0aGVudGljYXRlID0gdHJ1ZSkgPT4ge1xuICAgIGxldCBjb2xsZWN0aW9uID0gbS5wcm9wKFtdKSxcbiAgICAgICAgZGVmYXVsdE9yZGVyID0gb3JkZXIgfHwgJ2lkLmRlc2MnLFxuICAgICAgICBmaWx0ZXJzID0gbS5wcm9wKHtcbiAgICAgICAgICAgIG9yZGVyOiBkZWZhdWx0T3JkZXJcbiAgICAgICAgfSksXG4gICAgICAgIGlzTG9hZGluZyA9IG0ucHJvcChmYWxzZSksXG4gICAgICAgIHBhZ2UgPSBtLnByb3AoMSksXG4gICAgICAgIHJlc3VsdHNDb3VudCA9IG0ucHJvcCgpLFxuICAgICAgICBwYWdlUmVxdWVzdCA9IGF1dGhlbnRpY2F0ZSA/IG1vZGVsLmdldFBhZ2VXaXRoVG9rZW4gOiBtb2RlbC5nZXRQYWdlLFxuICAgICAgICB0b3RhbCA9IG0ucHJvcCgpO1xuXG4gICAgY29uc3QgZmV0Y2ggPSAoKSA9PiB7XG4gICAgICAgIGxldCBkID0gbS5kZWZlcnJlZCgpO1xuICAgICAgICBjb25zdCBnZXRUb3RhbCA9ICh4aHIpID0+IHtcbiAgICAgICAgICAgIGlmICgheGhyIHx8IHhoci5zdGF0dXMgPT09IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICBoaW50OiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBkZXRhaWxzOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBjb2RlOiAwLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnQ29ubmVjdGlvbiBlcnJvcidcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCByYW5nZUhlYWRlciA9IHhoci5nZXRSZXNwb25zZUhlYWRlcignQ29udGVudC1SYW5nZScpO1xuICAgICAgICAgICAgaWYgKF8uaXNTdHJpbmcocmFuZ2VIZWFkZXIpKSB7XG4gICAgICAgICAgICAgICAgbGV0IFtoZWFkZXJTaXplLCBoZWFkZXJDb3VudF0gPSByYW5nZUhlYWRlci5zcGxpdCgnLycpLFxuICAgICAgICAgICAgICAgICAgICBbaGVhZGVyRnJvbSwgaGVhZGVyVG9dID0gaGVhZGVyU2l6ZS5zcGxpdCgnLScpLFxuICAgICAgICAgICAgICAgICAgICB0byA9IHBhcnNlSW50KGhlYWRlclRvKSArIDEgfHwgMCxcbiAgICAgICAgICAgICAgICAgICAgZnJvbSA9IHBhcnNlSW50KGhlYWRlckZyb20pICB8fCAwO1xuXG4gICAgICAgICAgICAgICAgdG90YWwocGFyc2VJbnQoaGVhZGVyQ291bnQpKTtcbiAgICAgICAgICAgICAgICByZXN1bHRzQ291bnQodG8gLSBmcm9tKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgSlNPTi5wYXJzZSh4aHIucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICByZXR1cm4geGhyLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgaGludDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgZGV0YWlsczogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgY29kZTogMCxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogeGhyLnJlc3BvbnNlVGV4dFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBpc0xvYWRpbmcodHJ1ZSk7XG4gICAgICAgIHBhZ2VSZXF1ZXN0KGZpbHRlcnMoKSwgcGFnZSgpLCB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cnVlLFxuICAgICAgICAgICAgZXh0cmFjdDogZ2V0VG90YWxcbiAgICAgICAgfSwgZXh0cmFIZWFkZXJzKS50aGVuKChkYXRhKSA9PiB7XG4gICAgICAgICAgICBjb2xsZWN0aW9uKF8udW5pb24oY29sbGVjdGlvbigpLCBkYXRhKSk7XG4gICAgICAgICAgICBpc0xvYWRpbmcoZmFsc2UpO1xuICAgICAgICAgICAgZC5yZXNvbHZlKGNvbGxlY3Rpb24oKSk7XG4gICAgICAgICAgICBtLnJlZHJhdygpO1xuICAgICAgICB9LCAoZXJyb3IpID0+IHtcbiAgICAgICAgICAgIGlzTG9hZGluZyhmYWxzZSk7XG4gICAgICAgICAgICB0b3RhbCgwKTtcbiAgICAgICAgICAgIGQucmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgIG0ucmVkcmF3KCk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZC5wcm9taXNlO1xuICAgIH0sXG5cbiAgICBmaXJzdFBhZ2UgPSAocGFyYW1ldGVycykgPT4ge1xuICAgICAgICBmaWx0ZXJzKF8uZXh0ZW5kKHtcbiAgICAgICAgICAgIG9yZGVyOiBkZWZhdWx0T3JkZXJcbiAgICAgICAgfSwgcGFyYW1ldGVycykpO1xuICAgICAgICBjb2xsZWN0aW9uKFtdKTtcbiAgICAgICAgcGFnZSgxKTtcbiAgICAgICAgcmV0dXJuIGZldGNoKCk7XG4gICAgfSxcblxuICAgIGlzTGFzdFBhZ2UgPSAoKSA9PiB7XG4gICAgICAgIHJldHVybiAobW9kZWwucGFnZVNpemUoKSA+IHJlc3VsdHNDb3VudCgpKTtcbiAgICB9LFxuXG4gICAgbmV4dFBhZ2UgPSAoKSA9PiB7XG4gICAgICAgIHBhZ2UocGFnZSgpICsgMSk7XG4gICAgICAgIHJldHVybiBmZXRjaCgpO1xuICAgIH07XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uLFxuICAgICAgICBmaXJzdFBhZ2U6IGZpcnN0UGFnZSxcbiAgICAgICAgaXNMb2FkaW5nOiBpc0xvYWRpbmcsXG4gICAgICAgIG5leHRQYWdlOiBuZXh0UGFnZSxcbiAgICAgICAgaXNMYXN0UGFnZTogaXNMYXN0UGFnZSxcbiAgICAgICAgdG90YWw6IHRvdGFsLFxuICAgICAgICByZXN1bHRzQ291bnQ6IHJlc3VsdHNDb3VudFxuICAgIH07XG59O1xuXG5leHBvcnQgZGVmYXVsdCBwYWdpbmF0aW9uVk07XG4iLCJpbXBvcnQgbSBmcm9tICdtaXRocmlsJztcbmltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuaW1wb3J0IGZpbHRlcnNWTSBmcm9tICcuL3Ztcy9maWx0ZXJzVk0nO1xuaW1wb3J0IHBhZ2luYXRpb25WTSBmcm9tICcuL3Ztcy9wYWdpbmF0aW9uVk0nO1xuXG5sZXQgcG9zdGdyZXN0ID0ge307XG5cbmNvbnN0IHRva2VuID0gbS5wcm9wKCksXG5cbiAgICAgIG1lcmdlQ29uZmlnID0gKGNvbmZpZywgb3B0aW9ucykgPT4ge1xuICAgICAgICAgIHJldHVybiBvcHRpb25zICYmIF8uaXNGdW5jdGlvbihvcHRpb25zLmNvbmZpZykgPyBfLmNvbXBvc2Uob3B0aW9ucy5jb25maWcsIGNvbmZpZykgOiBjb25maWc7XG4gICAgICB9LFxuXG4gICAgICBhZGRIZWFkZXJzID0gKGhlYWRlcnMpID0+IHtcbiAgICAgICAgICByZXR1cm4gKHhocikgPT4ge1xuICAgICAgICAgICAgICBfLmVhY2goaGVhZGVycywgKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgICAgICAgICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKGtleSwgdmFsdWUpO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgcmV0dXJuIHhocjtcbiAgICAgICAgICB9O1xuICAgICAgfSxcblxuICAgICAgYWRkQ29uZmlnSGVhZGVycyA9IChoZWFkZXJzLCBvcHRpb25zKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIF8uZXh0ZW5kKHt9LCBvcHRpb25zLCB7XG4gICAgICAgICAgICAgIGNvbmZpZzogbWVyZ2VDb25maWcoYWRkSGVhZGVycyhoZWFkZXJzKSwgb3B0aW9ucylcbiAgICAgICAgICB9KTtcbiAgICAgIH0sXG5cbiAgICAgIGNyZWF0ZUxvYWRlciA9IChyZXF1ZXN0RnVuY3Rpb24sIG9wdGlvbnMsIGRlZmF1bHRTdGF0ZSA9IGZhbHNlKSA9PiB7XG4gICAgICAgICAgY29uc3QgbG9hZGVyID0gbS5wcm9wKGRlZmF1bHRTdGF0ZSksXG4gICAgICAgICAgICAgICAgZCA9IG0uZGVmZXJyZWQoKTtcbiAgICAgICAgICBsb2FkZXIubG9hZCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgbG9hZGVyKHRydWUpO1xuICAgICAgICAgICAgICBtLnJlZHJhdygpO1xuICAgICAgICAgICAgICByZXF1ZXN0RnVuY3Rpb24oXy5leHRlbmQoe30sIG9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6IHRydWVcbiAgICAgICAgICAgICAgfSkpLnRoZW4oKGRhdGEpID0+IHtcbiAgICAgICAgICAgICAgICAgIGxvYWRlcihmYWxzZSk7XG4gICAgICAgICAgICAgICAgICBkLnJlc29sdmUoZGF0YSk7XG4gICAgICAgICAgICAgICAgICBtLnJlZHJhdygpO1xuICAgICAgICAgICAgICB9LCAoZXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgIGxvYWRlcihmYWxzZSk7XG4gICAgICAgICAgICAgICAgICBkLnJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgICBtLnJlZHJhdygpO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgcmV0dXJuIGQucHJvbWlzZTtcbiAgICAgICAgICB9O1xuICAgICAgICAgIHJldHVybiBsb2FkZXI7XG4gICAgICB9LFxuXG4gICAgICByZXByZXNlbnRhdGlvbkhlYWRlciA9IHtcbiAgICAgICAgICAnUHJlZmVyJzogJ3JldHVybj1yZXByZXNlbnRhdGlvbidcbiAgICAgIH07XG5cbnBvc3RncmVzdC50b2tlbiA9IHRva2VuO1xuXG5wb3N0Z3Jlc3QuaW5pdCA9IChhcGlQcmVmaXgsIGF1dGhlbnRpY2F0aW9uT3B0aW9ucykgPT4ge1xuICAgIHBvc3RncmVzdC5yZXF1ZXN0ID0gKG9wdGlvbnMpID0+IHtcbiAgICAgICAgY29uc3QgZXJyb3JIYW5kbGVyID0gKHhocikgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBKU09OLnBhcnNlKHhoci5yZXNwb25zZVRleHQpO1xuICAgICAgICAgICAgICAgIHJldHVybiB4aHIucmVzcG9uc2VUZXh0O1xuICAgICAgICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICBoaW50OiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBkZXRhaWxzOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBjb2RlOiAwLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiB4aHIucmVzcG9uc2VUZXh0XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBtLnJlcXVlc3QoXy5leHRlbmQoe2V4dHJhY3Q6IGVycm9ySGFuZGxlcn0sIG9wdGlvbnMsIHtcbiAgICAgICAgICAgIHVybDogYXBpUHJlZml4ICsgb3B0aW9ucy51cmxcbiAgICAgICAgfSkpO1xuICAgIH07XG5cbiAgICBwb3N0Z3Jlc3QuYXV0aGVudGljYXRlID0gKCkgPT4ge1xuICAgICAgICBjb25zdCBkZWZlcnJlZCA9IG0uZGVmZXJyZWQoKTtcbiAgICAgICAgaWYgKHRva2VuKCkpIHtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoe1xuICAgICAgICAgICAgICAgIHRva2VuOiB0b2tlbigpXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG0ucmVxdWVzdChfLmV4dGVuZCh7fSwgYXV0aGVudGljYXRpb25PcHRpb25zKSkudGhlbigoZGF0YSkgPT4ge1xuICAgICAgICAgICAgICAgIHRva2VuKGRhdGEudG9rZW4pO1xuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoe1xuICAgICAgICAgICAgICAgICAgICB0b2tlbjogdG9rZW4oKVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSwgKGRhdGEpID0+IHtcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZGF0YSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9O1xuXG4gICAgcG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4gPSAob3B0aW9ucykgPT4ge1xuICAgICAgICByZXR1cm4gcG9zdGdyZXN0LmF1dGhlbnRpY2F0ZSgpLnRoZW4oXG4gICAgICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBvc3RncmVzdC5yZXF1ZXN0KGFkZENvbmZpZ0hlYWRlcnMoe1xuICAgICAgICAgICAgICAgICAgICAnQXV0aG9yaXphdGlvbic6ICdCZWFyZXIgJyArIHRva2VuKClcbiAgICAgICAgICAgICAgICB9LCBvcHRpb25zKSk7XG4gICAgICAgICAgICB9LCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBvc3RncmVzdC5yZXF1ZXN0KG9wdGlvbnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICApO1xuICAgIH07XG5cbiAgICBwb3N0Z3Jlc3QubG9hZGVyID0gXy5wYXJ0aWFsKGNyZWF0ZUxvYWRlciwgcG9zdGdyZXN0LnJlcXVlc3QpO1xuXG4gICAgcG9zdGdyZXN0LmxvYWRlcldpdGhUb2tlbiA9IF8ucGFydGlhbChjcmVhdGVMb2FkZXIsIHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuKTtcblxuICAgIHBvc3RncmVzdC5tb2RlbCA9IChuYW1lKSA9PiB7XG4gICAgICAgIGNvbnN0IHBhZ2luYXRpb25IZWFkZXJzID0gKHBhZ2UsIHBhZ2VTaXplKSA9PiB7XG4gICAgICAgICAgICBpZiAoIXBhZ2VTaXplKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCB0b1JhbmdlID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZyb20gPSAocGFnZSAtIDEpICogcGFnZVNpemUsXG4gICAgICAgICAgICAgICAgICAgICAgdG8gPSBmcm9tICsgcGFnZVNpemUgLSAxO1xuICAgICAgICAgICAgICAgIHJldHVybiBmcm9tICsgJy0nICsgdG87XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICdSYW5nZS11bml0JzogJ2l0ZW1zJyxcbiAgICAgICAgICAgICAgICAnUmFuZ2UnOiB0b1JhbmdlKClcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgcGFnZVNpemUgPSBtLnByb3AoMTApLFxuXG4gICAgICAgICAgICAgIG5hbWVPcHRpb25zID0ge1xuICAgICAgICAgICAgICAgICAgdXJsOiAnLycgKyBuYW1lXG4gICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgZ2V0T3B0aW9ucyA9IChkYXRhLCBwYWdlLCBwYWdlU2l6ZSwgb3B0aW9ucywgaGVhZGVycyA9IHt9KSA9PiB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBleHRyYUhlYWRlcnMgPSBfLmV4dGVuZCh7fSwge1xuICAgICAgICAgICAgICAgICAgICAgICdQcmVmZXInOiAnY291bnQ9bm9uZSdcbiAgICAgICAgICAgICAgICAgIH0sIGhlYWRlcnMsIHBhZ2luYXRpb25IZWFkZXJzKHBhZ2UsIHBhZ2VTaXplKSk7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gYWRkQ29uZmlnSGVhZGVycyhleHRyYUhlYWRlcnMsIF8uZXh0ZW5kKHt9LCBvcHRpb25zLCBuYW1lT3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgICAgICAgICAgICAgICAgZGF0YTogZGF0YVxuICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgIHF1ZXJ5c3RyaW5nID0gKGZpbHRlcnMsIG9wdGlvbnMpID0+IHtcbiAgICAgICAgICAgICAgICAgIG9wdGlvbnMudXJsICs9ICc/JyArIG0ucm91dGUuYnVpbGRRdWVyeVN0cmluZyhmaWx0ZXJzKTtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBvcHRpb25zO1xuICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgIG9wdGlvbnMgPSAob3B0aW9ucykgPT4ge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHBvc3RncmVzdC5yZXF1ZXN0KF8uZXh0ZW5kKHt9LCBvcHRpb25zLCBuYW1lT3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICAgIG1ldGhvZDogJ09QVElPTlMnXG4gICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgcG9zdE9wdGlvbnMgPSAoYXR0cmlidXRlcywgb3B0aW9ucywgaGVhZGVycyA9IHt9KSA9PiB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBleHRyYUhlYWRlcnMgPSBfLmV4dGVuZCh7fSwgcmVwcmVzZW50YXRpb25IZWFkZXIsIGhlYWRlcnMpO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIGFkZENvbmZpZ0hlYWRlcnMoXG4gICAgICAgICAgICAgICAgICAgICAgZXh0cmFIZWFkZXJzLFxuICAgICAgICAgICAgICAgICAgICAgIF8uZXh0ZW5kKHt9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZU9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IGF0dHJpYnV0ZXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgIGRlbGV0ZU9wdGlvbnMgPSAoZmlsdGVycywgb3B0aW9ucywgaGVhZGVycyA9IHt9KSA9PiB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBleHRyYUhlYWRlcnMgPSBhZGRIZWFkZXJzKF8uZXh0ZW5kKHt9LCBoZWFkZXJzKSk7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gcXVlcnlzdHJpbmcoZmlsdGVycywgYWRkQ29uZmlnSGVhZGVycyhleHRyYUhlYWRlcnMsIF8uZXh0ZW5kKHt9LCBvcHRpb25zLCBuYW1lT3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICAgIG1ldGhvZDogJ0RFTEVURSdcbiAgICAgICAgICAgICAgICAgIH0pKSk7XG4gICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgcGF0Y2hPcHRpb25zID0gKGZpbHRlcnMsIGF0dHJpYnV0ZXMsIG9wdGlvbnMsIGhlYWRlcnMgPSB7fSkgPT4ge1xuICAgICAgICAgICAgICAgICAgY29uc3QgZXh0cmFIZWFkZXJzID0gXy5leHRlbmQoe30sIHJlcHJlc2VudGF0aW9uSGVhZGVyLCBoZWFkZXJzKTtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBxdWVyeXN0cmluZyhcbiAgICAgICAgICAgICAgICAgICAgICBmaWx0ZXJzLFxuICAgICAgICAgICAgICAgICAgICAgIGFkZENvbmZpZ0hlYWRlcnMoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGV4dHJhSGVhZGVycyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgXy5leHRlbmQoe30sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWVPcHRpb25zLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdQQVRDSCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiBhdHRyaWJ1dGVzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICBnZXRQYWdlT3B0aW9ucyA9IChkYXRhLCBwYWdlLCBvcHRpb25zLCBoZWFkZXJzID0ge30pID0+IHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBnZXRPcHRpb25zKGRhdGEsIChwYWdlIHx8IDEpLCBwYWdlU2l6ZSgpLCBvcHRpb25zLCBoZWFkZXJzKTtcbiAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICBnZXRSb3dPcHRpb25zID0gKGRhdGEsIG9wdGlvbnMsIGhlYWRlcnMgPSB7fSkgPT4ge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIGdldE9wdGlvbnMoZGF0YSwgMSwgMSwgb3B0aW9ucywgaGVhZGVycyk7XG4gICAgICAgICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHBhZ2VTaXplOiBwYWdlU2l6ZSxcbiAgICAgICAgICAgIGdldFBhZ2VPcHRpb25zOiBnZXRQYWdlT3B0aW9ucyxcbiAgICAgICAgICAgIGdldFJvd09wdGlvbnM6IGdldFJvd09wdGlvbnMsXG4gICAgICAgICAgICBwYXRjaE9wdGlvbnM6IHBhdGNoT3B0aW9ucyxcbiAgICAgICAgICAgIHBvc3RPcHRpb25zOiBwb3N0T3B0aW9ucyxcbiAgICAgICAgICAgIGRlbGV0ZU9wdGlvbnM6IGRlbGV0ZU9wdGlvbnMsXG4gICAgICAgICAgICBnZXRQYWdlOiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIGdldFBhZ2VPcHRpb25zKSxcbiAgICAgICAgICAgIGdldFJvdzogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0LCBnZXRSb3dPcHRpb25zKSxcbiAgICAgICAgICAgIHBhdGNoOiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIHBhdGNoT3B0aW9ucyksXG4gICAgICAgICAgICBwb3N0OiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIHBvc3RPcHRpb25zKSxcbiAgICAgICAgICAgIGRlbGV0ZVJlcXVlc3Q6IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgZGVsZXRlT3B0aW9ucyksXG4gICAgICAgICAgICBnZXRQYWdlV2l0aFRva2VuOiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIGdldFBhZ2VPcHRpb25zKSxcbiAgICAgICAgICAgIGdldFJvd1dpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBnZXRSb3dPcHRpb25zKSxcbiAgICAgICAgICAgIHBhdGNoV2l0aFRva2VuOiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIHBhdGNoT3B0aW9ucyksXG4gICAgICAgICAgICBwb3N0V2l0aFRva2VuOiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIHBvc3RPcHRpb25zKSxcbiAgICAgICAgICAgIGRlbGV0ZVdpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBkZWxldGVPcHRpb25zKSxcbiAgICAgICAgICAgIG9wdGlvbnM6IG9wdGlvbnNcbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIHBvc3RncmVzdDtcbn07XG5cbnBvc3RncmVzdC5maWx0ZXJzVk0gPSBmaWx0ZXJzVk07XG5wb3N0Z3Jlc3QucGFnaW5hdGlvblZNID0gcGFnaW5hdGlvblZNO1xuXG5leHBvcnQgZGVmYXVsdCBwb3N0Z3Jlc3Q7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBR0EsSUFBTSxZQUFZLFNBQVosU0FBWSxDQUFDLFVBQUQsRUFBZ0I7QUFDOUIsSUFBQSxRQUFJLFFBQVEsRUFBWjtZQUNJLFNBQVMsU0FBVCxNQUFTLEdBQU07QUFDWCxJQUFBLFlBQU0sT0FBTyxFQUFFLElBQUYsQ0FBTyxFQUFQLENBQWI7Z0JBQ0ksYUFBYSxTQUFiLFVBQWEsQ0FBVSxLQUFWLEVBQWlCO0FBQzFCLElBQUEsZ0JBQUksVUFBVSxNQUFWLEdBQW1CLENBQXZCLEVBQTBCO0FBQ3RCLElBQUEscUJBQUssS0FBTDtBQUNBLElBQUEsdUJBQU8sS0FBUDtBQUNILElBQUE7QUFDRCxJQUFBLG1CQUFPLE1BQVA7QUFDSCxJQUFBLFNBUEw7O0FBU0EsSUFBQSxtQkFBVyxRQUFYLEdBQXNCLFlBQU07QUFDeEIsSUFBQSxtQkFBTyxFQUFFLFFBQUYsQ0FBVyxZQUFYLElBQTJCLGFBQWEsSUFBYixFQUEzQixHQUFpRCxZQUF4RDtBQUNILElBQUEsU0FGRDtBQUdBLElBQUEsZUFBTyxVQUFQO0FBQ0gsSUFBQSxLQWZMO1lBaUJJLFVBQVUsRUFBRSxNQUFGLENBQ04sVUFETSxFQUNNLFVBQUMsSUFBRCxFQUFPLFFBQVAsRUFBaUIsSUFBakIsRUFBMEI7Ozs7QUFJbEMsSUFBQSxZQUFJLGFBQWEsU0FBakIsRUFBNEI7QUFDeEIsSUFBQSxpQkFBSyxJQUFMLElBQWE7QUFDVCxJQUFBLHFCQUFLLFFBREk7QUFFVCxJQUFBLHFCQUFLO0FBRkksSUFBQSxhQUFiO0FBSUgsSUFBQSxTQUxELE1BS087QUFDSCxJ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
