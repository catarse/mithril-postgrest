'use strict';

(function (factory) {
    if (typeof exports === 'object') {
        // Node/CommonJS
        factory(require('mithril'), require('underscore'));
    } else {
        // Browser globals
        factory(window.m, window._);
    }
})(function (m, _) {
    var postgrest = {};

    var token = m.prop(),
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
    },
        representationHeader = {
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
            return m.postgrest.authenticate().then(function () {
                return m.postgrest.request(addConfigHeaders({
                    'Authorization': 'Bearer ' + token()
                }, options));
            }, function () {
                return m.postgrest.request(options);
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
                return m.postgrest.request(_.extend({}, _options, nameOptions, {
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

    m.postgrest = postgrest;
});
'use strict';

(function (factory) {
    if (typeof exports === 'object') {
        // Node/CommonJS
        factory(require('mithril'), require('underscore'));
    } else {
        // Browser globals
        factory(window.m, window._);
    }
})(function (m, _) {
    m.postgrest.filtersVM = function (attributes) {
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
});
'use strict';

var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

(function (factory) {
    if (typeof exports === 'object') {
        // Node/CommonJS
        factory(require('mithril'), require('underscore'));
    } else {
        // Browser globals
        factory(window.m, window._);
    }
})(function (m, _) {
    m.postgrest.paginationVM = function (model, order) {
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

                    var _rangeHeader$split2 = _slicedToArray(_rangeHeader$split, 2);

                    var size = _rangeHeader$split2[0];
                    var count = _rangeHeader$split2[1];
                    var _size$split = size.split('-');

                    var _size$split2 = _slicedToArray(_size$split, 2);

                    var from = _size$split2[0];
                    var to = _size$split2[1];

                    total(parseInt(count));
                    resultsCount(parseInt(to) - parseInt(from) + 1);
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
            return resultsCount() && model.pageSize() > resultsCount();
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
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1pdGhyaWwucG9zdGdyZXN0LmpzIiwidm1zL2ZpbHRlcnNWTS5qcyIsInZtcy9wYWdpbmF0aW9uVk0uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxBQUFDLENBQUEsVUFBUyxPQUFPLEVBQUU7QUFDZixRQUFJLE9BQU8sT0FBTyxLQUFLLFFBQVEsRUFBRTs7QUFFN0IsZUFBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsRUFBRSxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztLQUN0RCxNQUFNOztBQUVILGVBQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUMvQjtDQUNKLENBQUEsQ0FBQyxVQUFDLENBQUMsRUFBRSxDQUFDLEVBQUs7QUFDUixRQUFJLFNBQVMsR0FBRyxFQUFFLENBQUM7O0FBRW5CLFFBQU0sS0FBSyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUU7UUFFaEIsV0FBVyxHQUFHLFNBQWQsV0FBVyxDQUFJLE1BQU0sRUFBRSxPQUFPLEVBQUs7QUFDL0IsZUFBTyxPQUFPLElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxHQUFHLE1BQU0sQ0FBQztLQUMvRjtRQUVELFVBQVUsR0FBRyxTQUFiLFVBQVUsQ0FBSSxPQUFPLEVBQUs7QUFDdEIsZUFBTyxVQUFDLEdBQUcsRUFBSztBQUNaLGFBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLFVBQUMsS0FBSyxFQUFFLEdBQUcsRUFBSztBQUM1QixtQkFBRyxDQUFDLGdCQUFnQixDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQzthQUNwQyxDQUFDLENBQUM7QUFDSCxtQkFBTyxHQUFHLENBQUM7U0FDZCxDQUFDO0tBQ0w7UUFFRCxnQkFBZ0IsR0FBRyxTQUFuQixnQkFBZ0IsQ0FBSSxPQUFP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RSxDQUFDO1NBQ2xCO1lBRUQsVUFBVSxHQUFHLFNBQWIsVUFBVSxHQUFTO0FBQ2YsbUJBQVEsWUFBWSxFQUFFLElBQUksS0FBSyxDQUFDLFFBQVEsRUFBRSxHQUFHLFlBQVksRUFBRSxDQUFFO1NBQ2hFO1lBRUQsUUFBUSxHQUFHLFNBQVgsUUFBUSxHQUFTO0FBQ2IsZ0JBQUksQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNqQixtQkFBTyxLQUFLLEVBQUUsQ0FBQztTQUNsQixDQUFDOztBQUVSLGVBQU87QUFDSCxzQkFBVSxFQUFFLFVBQVU7QUFDdEIscUJBQVMsRUFBRSxTQUFTO0FBQ3BCLHFCQUFTLEVBQUUsU0FBUztBQUNwQixvQkFBUSxFQUFFLFFBQVE7QUFDbEIsc0JBQVUsRUFBRSxVQUFVO0FBQ3RCLGlCQUFLLEVBQUUsS0FBSztBQUNaLHdCQUFZLEVBQUUsWUFBWTtTQUM3QixDQUFDO0tBQ0wsQ0FBQztDQUVMLENBQUMsQ0FBRSIsImZpbGUiOiJtaXRocmlsLnBvc3RncmVzdC5qcyIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbihmYWN0b3J5KSB7XG4gICAgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xuICAgICAgICAvLyBOb2RlL0NvbW1vbkpTXG4gICAgICAgIGZhY3RvcnkocmVxdWlyZSgnbWl0aHJpbCcpLCByZXF1aXJlKCd1bmRlcnNjb3JlJykpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEJyb3dzZXIgZ2xvYmFsc1xuICAgICAgICBmYWN0b3J5KHdpbmRvdy5tLCB3aW5kb3cuXyk7XG4gICAgfVxufSgobSwgXykgPT4ge1xuICAgIGxldCBwb3N0Z3Jlc3QgPSB7fTtcblxuICAgIGNvbnN0IHRva2VuID0gbS5wcm9wKCksXG5cbiAgICAgICAgICBtZXJnZUNvbmZpZyA9IChjb25maWcsIG9wdGlvbnMpID0+IHtcbiAgICAgICAgICAgICAgcmV0dXJuIG9wdGlvbnMgJiYgXy5pc0Z1bmN0aW9uKG9wdGlvbnMuY29uZmlnKSA/IF8uY29tcG9zZShvcHRpb25zLmNvbmZpZywgY29uZmlnKSA6IGNvbmZpZztcbiAgICAgICAgICB9LFxuXG4gICAgICAgICAgYWRkSGVhZGVycyA9IChoZWFkZXJzKSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiAoeGhyKSA9PiB7XG4gICAgICAgICAgICAgICAgICBfLmVhY2goaGVhZGVycywgKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihrZXksIHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHhocjtcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICB9LFxuXG4gICAgICAgICAgYWRkQ29uZmlnSGVhZGVycyA9IChoZWFkZXJzLCBvcHRpb25zKSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiBfLmV4dGVuZCh7fSwgb3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgY29uZmlnOiBtZXJnZUNvbmZpZyhhZGRIZWFkZXJzKGhlYWRlcnMpLCBvcHRpb25zKVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICB9LFxuXG4gICAgICAgICAgY3JlYXRlTG9hZGVyID0gKHJlcXVlc3RGdW5jdGlvbiwgb3B0aW9ucywgZGVmYXVsdFN0YXRlID0gZmFsc2UpID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgbG9hZGVyID0gbS5wcm9wKGRlZmF1bHRTdGF0ZSksXG4gICAgICAgICAgICAgICAgICAgIGQgPSBtLmRlZmVycmVkKCk7XG4gICAgICAgICAgICAgIGxvYWRlci5sb2FkID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgbG9hZGVyKHRydWUpO1xuICAgICAgICAgICAgICAgICAgbS5yZWRyYXcoKTtcbiAgICAgICAgICAgICAgICAgIHJlcXVlc3RGdW5jdGlvbihfLmV4dGVuZCh7fSwgb3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6IHRydWVcbiAgICAgICAgICAgICAgICAgIH0pKS50aGVuKChkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgbG9hZGVyKGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgICBkLnJlc29sdmUoZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgbS5yZWRyYXcoKTtcbiAgICAgICAgICAgICAgICAgIH0sIChlcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIGxvYWRlcihmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgIG0ucmVkcmF3KCk7XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBkLnByb21pc2U7XG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgIHJldHVybiBsb2FkZXI7XG4gICAgICAgICAgfSxcblxuICAgICAgICAgIHJlcHJlc2VudGF0aW9uSGVhZGVyID0ge1xuICAgICAgICAgICAgICAnUHJlZmVyJzogJ3JldHVybj1yZXByZXNlbnRhdGlvbidcbiAgICAgICAgICB9O1xuXG4gICAgcG9zdGdyZXN0LnRva2VuID0gdG9rZW47XG5cbiAgICBwb3N0Z3Jlc3QuaW5pdCA9IChhcGlQcmVmaXgsIGF1dGhlbnRpY2F0aW9uT3B0aW9ucykgPT4ge1xuICAgICAgICBwb3N0Z3Jlc3QucmVxdWVzdCA9IChvcHRpb25zKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBlcnJvckhhbmRsZXIgPSAoeGhyKSA9PiB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgSlNPTi5wYXJzZSh4aHIucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHhoci5yZXNwb25zZVRleHQ7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGhpbnQ6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXRhaWxzOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IHhoci5yZXNwb25zZVRleHRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiBtLnJlcXVlc3QoXy5leHRlbmQoe2V4dHJhY3Q6IGVycm9ySGFuZGxlcn0sIG9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICB1cmw6IGFwaVByZWZpeCArIG9wdGlvbnMudXJsXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgcG9zdGdyZXN0LmF1dGhlbnRpY2F0ZSA9ICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGRlZmVycmVkID0gbS5kZWZlcnJlZCgpO1xuICAgICAgICAgICAgaWYgKHRva2VuKCkpIHtcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHtcbiAgICAgICAgICAgICAgICAgICAgdG9rZW46IHRva2VuKClcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbS5yZXF1ZXN0KF8uZXh0ZW5kKHt9LCBhdXRoZW50aWNhdGlvbk9wdGlvbnMpKS50aGVuKChkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRva2VuKGRhdGEudG9rZW4pO1xuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRva2VuOiB0b2tlbigpXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0sIChkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChkYXRhKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgICAgICB9O1xuXG4gICAgICAgIHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuID0gKG9wdGlvbnMpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBtLnBvc3RncmVzdC5hdXRoZW50aWNhdGUoKS50aGVuKFxuICAgICAgICAgICAgICAgICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG0ucG9zdGdyZXN0LnJlcXVlc3QoYWRkQ29uZmlnSGVhZGVycyh7XG4gICAgICAgICAgICAgICAgICAgICAgICAnQXV0aG9yaXphdGlvbic6ICdCZWFyZXIgJyArIHRva2VuKClcbiAgICAgICAgICAgICAgICAgICAgfSwgb3B0aW9ucykpO1xuICAgICAgICAgICAgICAgIH0sICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG0ucG9zdGdyZXN0LnJlcXVlc3Qob3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfTtcblxuICAgICAgICBwb3N0Z3Jlc3QubG9hZGVyID0gXy5wYXJ0aWFsKGNyZWF0ZUxvYWRlciwgcG9zdGdyZXN0LnJlcXVlc3QpO1xuXG4gICAgICAgIHBvc3RncmVzdC5sb2FkZXJXaXRoVG9rZW4gPSBfLnBhcnRpYWwoY3JlYXRlTG9hZGVyLCBwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbik7XG5cbiAgICAgICAgcG9zdGdyZXN0Lm1vZGVsID0gKG5hbWUpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHBhZ2luYXRpb25IZWFkZXJzID0gKHBhZ2UsIHBhZ2VTaXplKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCFwYWdlU2l6ZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgdG9SYW5nZSA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZnJvbSA9IChwYWdlIC0gMSkgKiBwYWdlU2l6ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdG8gPSBmcm9tICsgcGFnZVNpemUgLSAxO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZnJvbSArICctJyArIHRvO1xuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAnUmFuZ2UtdW5pdCc6ICdpdGVtcycsXG4gICAgICAgICAgICAgICAgICAgICdSYW5nZSc6IHRvUmFuZ2UoKVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgICBwYWdlU2l6ZSA9IG0ucHJvcCgxMCksXG5cbiAgICAgICAgICAgICAgICAgIG5hbWVPcHRpb25zID0ge1xuICAgICAgICAgICAgICAgICAgICAgIHVybDogJy8nICsgbmFtZVxuICAgICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgZ2V0T3B0aW9ucyA9IChkYXRhLCBwYWdlLCBwYWdlU2l6ZSwgb3B0aW9ucywgaGVhZGVycyA9IHt9KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgZXh0cmFIZWFkZXJzID0gXy5leHRlbmQoe30sIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgJ1ByZWZlcic6ICdjb3VudD1ub25lJ1xuICAgICAgICAgICAgICAgICAgICAgIH0sIGhlYWRlcnMsIHBhZ2luYXRpb25IZWFkZXJzKHBhZ2UsIHBhZ2VTaXplKSk7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFkZENvbmZpZ0hlYWRlcnMoZXh0cmFIZWFkZXJzLCBfLmV4dGVuZCh7fSwgb3B0aW9ucywgbmFtZU9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YTogZGF0YVxuICAgICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgIHF1ZXJ5c3RyaW5nID0gKGZpbHRlcnMsIG9wdGlvbnMpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLnVybCArPSAnPycgKyBtLnJvdXRlLmJ1aWxkUXVlcnlTdHJpbmcoZmlsdGVycyk7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9wdGlvbnM7XG4gICAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgICBvcHRpb25zID0gKG9wdGlvbnMpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbS5wb3N0Z3Jlc3QucmVxdWVzdChfLmV4dGVuZCh7fSwgb3B0aW9ucywgbmFtZU9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnT1BUSU9OUydcbiAgICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgICBwb3N0T3B0aW9ucyA9IChhdHRyaWJ1dGVzLCBvcHRpb25zLCBoZWFkZXJzID0ge30pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBleHRyYUhlYWRlcnMgPSBfLmV4dGVuZCh7fSwgcmVwcmVzZW50YXRpb25IZWFkZXIsIGhlYWRlcnMpO1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBhZGRDb25maWdIZWFkZXJzKFxuICAgICAgICAgICAgICAgICAgICAgICAgICBleHRyYUhlYWRlcnMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIF8uZXh0ZW5kKHt9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lT3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiBhdHRyaWJ1dGVzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgIGRlbGV0ZU9wdGlvbnMgPSAoZmlsdGVycywgb3B0aW9ucywgaGVhZGVycyA9IHt9KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgZXh0cmFIZWFkZXJzID0gYWRkSGVhZGVycyhfLmV4dGVuZCh7fSwgaGVhZGVycykpO1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBxdWVyeXN0cmluZyhmaWx0ZXJzLCBhZGRDb25maWdIZWFkZXJzKGV4dHJhSGVhZGVycywgXy5leHRlbmQoe30sIG9wdGlvbnMsIG5hbWVPcHRpb25zLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIG1ldGhvZDogJ0RFTEVURSdcbiAgICAgICAgICAgICAgICAgICAgICB9KSkpO1xuICAgICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgcGF0Y2hPcHRpb25zID0gKGZpbHRlcnMsIGF0dHJpYnV0ZXMsIG9wdGlvbnMsIGhlYWRlcnMgPSB7fSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGV4dHJhSGVhZGVycyA9IF8uZXh0ZW5kKHt9LCByZXByZXNlbnRhdGlvbkhlYWRlciwgaGVhZGVycyk7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHF1ZXJ5c3RyaW5nKFxuICAgICAgICAgICAgICAgICAgICAgICAgICBmaWx0ZXJzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBhZGRDb25maWdIZWFkZXJzKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXh0cmFIZWFkZXJzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXy5leHRlbmQoe30sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZU9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdQQVRDSCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YTogYXR0cmlidXRlc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgZ2V0UGFnZU9wdGlvbnMgPSAoZGF0YSwgcGFnZSwgb3B0aW9ucywgaGVhZGVycyA9IHt9KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGdldE9wdGlvbnMoZGF0YSwgKHBhZ2UgfHwgMSksIHBhZ2VTaXplKCksIG9wdGlvbnMsIGhlYWRlcnMpO1xuICAgICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgZ2V0Um93T3B0aW9ucyA9IChkYXRhLCBvcHRpb25zLCBoZWFkZXJzID0ge30pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZ2V0T3B0aW9ucyhkYXRhLCAxLCAxLCBvcHRpb25zLCBoZWFkZXJzKTtcbiAgICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgcGFnZVNpemU6IHBhZ2VTaXplLFxuICAgICAgICAgICAgICAgIGdldFBhZ2VPcHRpb25zOiBnZXRQYWdlT3B0aW9ucyxcbiAgICAgICAgICAgICAgICBnZXRSb3dPcHRpb25zOiBnZXRSb3dPcHRpb25zLFxuICAgICAgICAgICAgICAgIHBhdGNoT3B0aW9uczogcGF0Y2hPcHRpb25zLFxuICAgICAgICAgICAgICAgIHBvc3RPcHRpb25zOiBwb3N0T3B0aW9ucyxcbiAgICAgICAgICAgICAgICBkZWxldGVPcHRpb25zOiBkZWxldGVPcHRpb25zLFxuICAgICAgICAgICAgICAgIGdldFBhZ2U6IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgZ2V0UGFnZU9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIGdldFJvdzogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0LCBnZXRSb3dPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBwYXRjaDogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0LCBwYXRjaE9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIHBvc3Q6IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgcG9zdE9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIGRlbGV0ZVJlcXVlc3Q6IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgZGVsZXRlT3B0aW9ucyksXG4gICAgICAgICAgICAgICAgZ2V0UGFnZVdpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBnZXRQYWdlT3B0aW9ucyksXG4gICAgICAgICAgICAgICAgZ2V0Um93V2l0aFRva2VuOiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIGdldFJvd09wdGlvbnMpLFxuICAgICAgICAgICAgICAgIHBhdGNoV2l0aFRva2VuOiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIHBhdGNoT3B0aW9ucyksXG4gICAgICAgICAgICAgICAgcG9zdFdpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBwb3N0T3B0aW9ucyksXG4gICAgICAgICAgICAgICAgZGVsZXRlV2l0aFRva2VuOiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIGRlbGV0ZU9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIG9wdGlvbnM6IG9wdGlvbnNcbiAgICAgICAgICAgIH07XG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIHBvc3RncmVzdDtcbiAgICB9O1xuXG4gICAgbS5wb3N0Z3Jlc3QgPSBwb3N0Z3Jlc3Q7XG59KSk7XG4iLCIoZnVuY3Rpb24oZmFjdG9yeSkge1xuICAgIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgLy8gTm9kZS9Db21tb25KU1xuICAgICAgICBmYWN0b3J5KHJlcXVpcmUoJ21pdGhyaWwnKSwgcmVxdWlyZSgndW5kZXJzY29yZScpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyBCcm93c2VyIGdsb2JhbHNcbiAgICAgICAgZmFjdG9yeSh3aW5kb3cubSwgd2luZG93Ll8pO1xuICAgIH1cbn0oKG0sIF8pID0+IHtcbiAgICBtLnBvc3RncmVzdC5maWx0ZXJzVk0gPSAoYXR0cmlidXRlcykgPT4ge1xuICAgICAgICB2YXIgbmV3Vk0gPSB7fSxcbiAgICAgICAgICAgIGZpbHRlciA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICB2YXIgcHJvcCA9IG0ucHJvcCgnJyksXG4gICAgICAgICAgICAgICAgICAgIGZpbHRlclByb3AgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ld1ZNO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByb3AoKTtcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAvLyBKdXN0IHNvIHdlIGNhbiBoYXZlIGEgZGVmYXVsdCB0b19maWx0ZXIgYW5kIGF2b2lkIGlmIF8uaXNGdW5jdGlvbiBjYWxsc1xuICAgICAgICAgICAgICAgIGZpbHRlclByb3AudG9GaWx0ZXIgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBfLmlzU3RyaW5nKGZpbHRlclByb3AoKSkgPyBmaWx0ZXJQcm9wKCkudHJpbSgpIDogZmlsdGVyUHJvcCgpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZpbHRlclByb3A7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBnZXR0ZXJzID0gXy5yZWR1Y2UoXG4gICAgICAgICAgICAgICAgYXR0cmlidXRlcywgKG1lbW8sIG9wZXJhdG9yLCBhdHRyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFRoZSBvcGVyYXRvciBiZXR3ZWVuIGlzIGltcGxlbWVudGVkIHdpdGggdHdvIHByb3BlcnRpZXMsIG9uZSBmb3IgZ3JlYXRlciB0aGFuIHZhbHVlIGFuZCBhbm90aGVyIGZvciBsZXNzZXIgdGhhbiB2YWx1ZS5cbiAgICAgICAgICAgICAgICAgICAgLy8gQm90aCBwcm9wZXJ0aWVzIGFyZSBzZW50IGluIHRoZSBxdWV1cnlzdHJpbmcgd2l0aCB0aGUgc2FtZSBuYW1lLFxuICAgICAgICAgICAgICAgICAgICAvLyB0aGF0J3Mgd2h5IHdlIG5lZWQgdGhlIHNwZWNpYWwgY2FzZSBoZXJlLCBzbyB3ZSBjYW4gdXNlIGEgc2ltcGxlIG1hcCBhcyBhcmd1bWVudCB0byBmaWx0ZXJzVk0uXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcGVyYXRvciA9PT0gJ2JldHdlZW4nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGx0ZTogZmlsdGVyKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ3RlOiBmaWx0ZXIoKVxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lbW9bYXR0cl0gPSBmaWx0ZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgICAgICAgICB9LCB7XG4gICAgICAgICAgICAgICAgICAgIG9yZGVyOiBmaWx0ZXIoKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICksXG5cbiAgICAgICAgICAgIHBhcmFtZXRlcnNXaXRob3V0T3JkZXIgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIF8ucmVkdWNlKFxuICAgICAgICAgICAgICAgICAgICBnZXR0ZXJzLCAobWVtbywgZ2V0dGVyLCBhdHRyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXR0ciAhPT0gJ29yZGVyJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBvcGVyYXRvciA9IGF0dHJpYnV0ZXNbYXR0cl07XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoXy5pc0Z1bmN0aW9uKGdldHRlci50b0ZpbHRlcikgJiYgKGdldHRlci50b0ZpbHRlcigpID09PSB1bmRlZmluZWQgfHwgZ2V0dGVyLnRvRmlsdGVyKCkgPT09ICcnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBCZWxsb3cgd2UgdXNlIGRpZmZlcmVudCBmb3JtYXR0aW5nIHJ1bGVzIGZvciB0aGUgdmFsdWUgZGVwZW5kaW5nIG9uIHRoZSBvcGVyYXRvclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRoZXNlIHJ1bGVzIGFyZSB1c2VkIHJlZ2FyZGxlc3Mgb2YgdGhlIHRvRmlsdGVyIGZ1bmN0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNvIHRoZSB1c2VyIGNhbiB1c2UgYSBjdXN0b20gdG9GaWx0ZXIgd2l0aG91dCBoYXZpbmcgdG8gd29ycnkgd2l0aCBiYXNpYyBmaWx0ZXIgc3ludGF4XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9wZXJhdG9yID09PSAnaWxpa2UnIHx8IG9wZXJhdG9yID09PSAnbGlrZScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IG9wZXJhdG9yICsgJy4qJyArIGdldHRlci50b0ZpbHRlcigpICsgJyonO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAob3BlcmF0b3IgPT09ICdAQCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IG9wZXJhdG9yICsgJy4nICsgZ2V0dGVyLnRvRmlsdGVyKCkucmVwbGFjZSgvXFxzKy9nLCAnJicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAob3BlcmF0b3IgPT09ICdiZXR3ZWVuJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWdldHRlci5sdGUudG9GaWx0ZXIoKSAmJiAhZ2V0dGVyLmd0ZS50b0ZpbHRlcigpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChnZXR0ZXIuZ3RlKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lbW9bYXR0cl0ucHVzaCgnZ3RlLicgKyBnZXR0ZXIuZ3RlLnRvRmlsdGVyKCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChnZXR0ZXIubHRlKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lbW9bYXR0cl0ucHVzaCgnbHRlLicgKyBnZXR0ZXIubHRlLnRvRmlsdGVyKCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChvcGVyYXRvciA9PT0gJ2lzLm51bGwnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lbW9bYXR0cl0gPSBnZXR0ZXIudG9GaWx0ZXIoKSA9PT0gbnVsbCA/ICdpcy5udWxsJyA6ICdub3QuaXMubnVsbCc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IG9wZXJhdG9yICsgJy4nICsgZ2V0dGVyLnRvRmlsdGVyKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgICAgICAgICAgICAgIH0sIHt9XG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHBhcmFtZXRlcnMgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgLy8gVGhlIG9yZGVyIHBhcmFtZXRlcnMgaGF2ZSBhIHNwZWNpYWwgc3ludGF4IChqdXN0IGxpa2UgYW4gb3JkZXIgYnkgU1FMIGNsYXVzZSlcbiAgICAgICAgICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vYmVncmlmZnMvcG9zdGdyZXN0L3dpa2kvUm91dGluZyNmaWx0ZXJpbmctYW5kLW9yZGVyaW5nXG4gICAgICAgICAgICAgICAgdmFyIG9yZGVyID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZ2V0dGVycy5vcmRlcigpICYmIF8ucmVkdWNlKFxuICAgICAgICAgICAgICAgICAgICAgICAgZ2V0dGVycy5vcmRlcigpLCAobWVtbywgZGlyZWN0aW9uLCBhdHRyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtby5wdXNoKGF0dHIgKyAnLicgKyBkaXJlY3Rpb24pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSwgW11cbiAgICAgICAgICAgICAgICAgICAgKS5qb2luKCcsJyk7XG4gICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgICBvcmRlclBhcmFtZXRlciA9IG9yZGVyKCkgPyB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcmRlcjogb3JkZXIoKVxuICAgICAgICAgICAgICAgICAgICB9IDoge307XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gXy5leHRlbmQoe30sIG9yZGVyUGFyYW1ldGVyLCBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyKCkpO1xuXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiBfLmV4dGVuZChuZXdWTSwgZ2V0dGVycywge1xuICAgICAgICAgICAgcGFyYW1ldGVyczogcGFyYW1ldGVycyxcbiAgICAgICAgICAgIHBhcmFtZXRlcnNXaXRob3V0T3JkZXI6IHBhcmFtZXRlcnNXaXRob3V0T3JkZXJcbiAgICAgICAgfSk7XG4gICAgfTtcbn0pKTtcbiIsIihmdW5jdGlvbihmYWN0b3J5KSB7XG4gICAgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xuICAgICAgICAvLyBOb2RlL0NvbW1vbkpTXG4gICAgICAgIGZhY3RvcnkocmVxdWlyZSgnbWl0aHJpbCcpLCByZXF1aXJlKCd1bmRlcnNjb3JlJykpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEJyb3dzZXIgZ2xvYmFsc1xuICAgICAgICBmYWN0b3J5KHdpbmRvdy5tLCB3aW5kb3cuXyk7XG4gICAgfVxufShmdW5jdGlvbihtLCBfKSB7XG4gICAgbS5wb3N0Z3Jlc3QucGFnaW5hdGlvblZNID0gKG1vZGVsLCBvcmRlciwgZXh0cmFIZWFkZXJzID0ge30sIGF1dGhlbnRpY2F0ZSA9IHRydWUpID0+IHtcbiAgICAgICAgbGV0IGNvbGxlY3Rpb24gPSBtLnByb3AoW10pLFxuICAgICAgICAgICAgZGVmYXVsdE9yZGVyID0gb3JkZXIgfHwgJ2lkLmRlc2MnLFxuICAgICAgICAgICAgZmlsdGVycyA9IG0ucHJvcCh7XG4gICAgICAgICAgICAgICAgb3JkZXI6IGRlZmF1bHRPcmRlclxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBpc0xvYWRpbmcgPSBtLnByb3AoZmFsc2UpLFxuICAgICAgICAgICAgcGFnZSA9IG0ucHJvcCgxKSxcbiAgICAgICAgICAgIHJlc3VsdHNDb3VudCA9IG0ucHJvcCgpLFxuICAgICAgICAgICAgcGFnZVJlcXVlc3QgPSBhdXRoZW50aWNhdGUgPyBtb2RlbC5nZXRQYWdlV2l0aFRva2VuIDogbW9kZWwuZ2V0UGFnZSxcbiAgICAgICAgICAgIHRvdGFsID0gbS5wcm9wKCk7XG5cbiAgICAgICAgY29uc3QgZmV0Y2ggPSAoKSA9PiB7XG4gICAgICAgICAgICBsZXQgZCA9IG0uZGVmZXJyZWQoKTtcbiAgICAgICAgICAgIGNvbnN0IGdldFRvdGFsID0gKHhocikgPT4ge1xuICAgICAgICAgICAgICAgIGlmICgheGhyIHx8IHhoci5zdGF0dXMgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGhpbnQ6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXRhaWxzOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdDb25uZWN0aW9uIGVycm9yJ1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbGV0IHJhbmdlSGVhZGVyID0geGhyLmdldFJlc3BvbnNlSGVhZGVyKCdDb250ZW50LVJhbmdlJyk7XG4gICAgICAgICAgICAgICAgaWYgKF8uaXNTdHJpbmcocmFuZ2VIZWFkZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBbc2l6ZSwgY291bnRdID0gcmFuZ2VIZWFkZXIuc3BsaXQoJy8nKSwgW2Zyb20sIHRvXSA9IHNpemUuc3BsaXQoJy0nKTtcblxuICAgICAgICAgICAgICAgICAgICB0b3RhbChwYXJzZUludChjb3VudCkpO1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRzQ291bnQoKHBhcnNlSW50KHRvKSAtIHBhcnNlSW50KGZyb20pICsgMSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBKU09OLnBhcnNlKHhoci5yZXNwb25zZVRleHQpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geGhyLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgaGludDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldGFpbHM6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogeGhyLnJlc3BvbnNlVGV4dFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaXNMb2FkaW5nKHRydWUpO1xuICAgICAgICAgICAgcGFnZVJlcXVlc3QoZmlsdGVycygpLCBwYWdlKCksIHtcbiAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cnVlLFxuICAgICAgICAgICAgICAgIGV4dHJhY3Q6IGdldFRvdGFsXG4gICAgICAgICAgICB9LCBleHRyYUhlYWRlcnMpLnRoZW4oKGRhdGEpID0+IHtcbiAgICAgICAgICAgICAgICBjb2xsZWN0aW9uKF8udW5pb24oY29sbGVjdGlvbigpLCBkYXRhKSk7XG4gICAgICAgICAgICAgICAgaXNMb2FkaW5nKGZhbHNlKTtcbiAgICAgICAgICAgICAgICBkLnJlc29sdmUoY29sbGVjdGlvbigpKTtcbiAgICAgICAgICAgICAgICBtLnJlZHJhdygpO1xuICAgICAgICAgICAgfSwgKGVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgaXNMb2FkaW5nKGZhbHNlKTtcbiAgICAgICAgICAgICAgICB0b3RhbCgwKTtcbiAgICAgICAgICAgICAgICBkLnJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgbS5yZWRyYXcoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIGQucHJvbWlzZTtcbiAgICAgICAgfSxcblxuICAgICAgICAgICAgICBmaXJzdFBhZ2UgPSAocGFyYW1ldGVycykgPT4ge1xuICAgICAgICAgICAgICAgICAgZmlsdGVycyhfLmV4dGVuZCh7XG4gICAgICAgICAgICAgICAgICAgICAgb3JkZXI6IGRlZmF1bHRPcmRlclxuICAgICAgICAgICAgICAgICAgfSwgcGFyYW1ldGVycykpO1xuICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbihbXSk7XG4gICAgICAgICAgICAgICAgICBwYWdlKDEpO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIGZldGNoKCk7XG4gICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgaXNMYXN0UGFnZSA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiAocmVzdWx0c0NvdW50KCkgJiYgbW9kZWwucGFnZVNpemUoKSA+IHJlc3VsdHNDb3VudCgpKTtcbiAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICBuZXh0UGFnZSA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgIHBhZ2UocGFnZSgpICsgMSk7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gZmV0Y2goKTtcbiAgICAgICAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY29sbGVjdGlvbjogY29sbGVjdGlvbixcbiAgICAgICAgICAgIGZpcnN0UGFnZTogZmlyc3RQYWdlLFxuICAgICAgICAgICAgaXNMb2FkaW5nOiBpc0xvYWRpbmcsXG4gICAgICAgICAgICBuZXh0UGFnZTogbmV4dFBhZ2UsXG4gICAgICAgICAgICBpc0xhc3RQYWdlOiBpc0xhc3RQYWdlLFxuICAgICAgICAgICAgdG90YWw6IHRvdGFsLFxuICAgICAgICAgICAgcmVzdWx0c0NvdW50OiByZXN1bHRzQ291bnRcbiAgICAgICAgfTtcbiAgICB9O1xuXG59KSk7XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=
