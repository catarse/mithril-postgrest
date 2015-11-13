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
        representationHeader = {
        'Prefer': 'return=representation'
    };

    postgrest.token = token;

    postgrest.loader = function (options, requestFunction) {
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

    postgrest.loaderWithToken = function (options, defaultState) {
        return postgrest.loader(options, postgrest.requestWithToken, defaultState);
    };

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
            order: m.prop()
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
        var authenticate = arguments.length <= 2 || arguments[2] === undefined ? true : arguments[2];

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
            }, {
                'Prefer': 'count=exact'
            }).then(function (data) {
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
            return page() * model.pageSize() >= total();
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1pdGhyaWwucG9zdGdyZXN0LmpzIiwidm1zL2ZpbHRlcnNWTS5qcyIsInZtcy9wYWdpbmF0aW9uVk0uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxBQUFDLENBQUEsVUFBUyxPQUFPLEVBQUU7QUFDZixRQUFJLE9BQU8sT0FBTyxLQUFLLFFBQVEsRUFBRTs7QUFFN0IsZUFBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsRUFBRSxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztLQUN0RCxNQUFNOztBQUVILGVBQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUMvQjtDQUNKLENBQUEsQ0FBQyxVQUFDLENBQUMsRUFBRSxDQUFDLEVBQUs7QUFDUixRQUFJLFNBQVMsR0FBRyxFQUFFLENBQUM7O0FBRW5CLFFBQU0sS0FBSyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUU7UUFFaEIsV0FBVyxHQUFHLFNBQWQsV0FBVyxDQUFJLE1BQU0sRUFBRSxPQUFPLEVBQUs7QUFDL0IsZUFBTyxPQUFPLElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxHQUFHLE1BQU0sQ0FBQztLQUMvRjtRQUVELFVBQVUsR0FBRyxTQUFiLFVBQVUsQ0FBSSxPQUFPLEVBQUs7QUFDdEIsZUFBTyxVQUFDLEdBQUcsRUFBSztBQUNaLGFBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLFVBQUMsS0FBSyxFQUFFLEdBQUcsRUFBSztBQUM1QixtQkFBRyxDQUFDLGdCQUFnQixDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQzthQUNwQyxDQUFDLENBQUM7QUFDSCxtQkFBTyxHQUFHLENBQUM7U0FDZCxDQUFDO0tBQ0w7UUFFRCxnQkFBZ0IsR0FBRyxTQUFuQixnQkFBZ0IsQ0FBSSxPQUFP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O1lBRUQsVUFBVSxHQUFHLFNBQWIsVUFBVSxHQUFTO0FBQ2YsbUJBQVEsSUFBSSxFQUFFLEdBQUcsS0FBSyxDQUFDLFFBQVEsRUFBRSxJQUFJLEtBQUssRUFBRSxDQUFFO1NBQ2pEO1lBRUQsUUFBUSxHQUFHLFNBQVgsUUFBUSxHQUFTO0FBQ2IsZ0JBQUksQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNqQixtQkFBTyxLQUFLLEVBQUUsQ0FBQztTQUNsQixDQUFDOztBQUVSLGVBQU87QUFDSCxzQkFBVSxFQUFFLFVBQVU7QUFDdEIscUJBQVMsRUFBRSxTQUFTO0FBQ3BCLHFCQUFTLEVBQUUsU0FBUztBQUNwQixvQkFBUSxFQUFFLFFBQVE7QUFDbEIsc0JBQVUsRUFBRSxVQUFVO0FBQ3RCLGlCQUFLLEVBQUUsS0FBSztBQUNaLHdCQUFZLEVBQUUsWUFBWTtTQUM3QixDQUFDO0tBQ0wsQ0FBQztDQUVMLENBQUMsQ0FBRSIsImZpbGUiOiJtaXRocmlsLnBvc3RncmVzdC5qcyIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbihmYWN0b3J5KSB7XG4gICAgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xuICAgICAgICAvLyBOb2RlL0NvbW1vbkpTXG4gICAgICAgIGZhY3RvcnkocmVxdWlyZSgnbWl0aHJpbCcpLCByZXF1aXJlKCd1bmRlcnNjb3JlJykpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEJyb3dzZXIgZ2xvYmFsc1xuICAgICAgICBmYWN0b3J5KHdpbmRvdy5tLCB3aW5kb3cuXyk7XG4gICAgfVxufSgobSwgXykgPT4ge1xuICAgIGxldCBwb3N0Z3Jlc3QgPSB7fTtcblxuICAgIGNvbnN0IHRva2VuID0gbS5wcm9wKCksXG5cbiAgICAgICAgICBtZXJnZUNvbmZpZyA9IChjb25maWcsIG9wdGlvbnMpID0+IHtcbiAgICAgICAgICAgICAgcmV0dXJuIG9wdGlvbnMgJiYgXy5pc0Z1bmN0aW9uKG9wdGlvbnMuY29uZmlnKSA/IF8uY29tcG9zZShvcHRpb25zLmNvbmZpZywgY29uZmlnKSA6IGNvbmZpZztcbiAgICAgICAgICB9LFxuXG4gICAgICAgICAgYWRkSGVhZGVycyA9IChoZWFkZXJzKSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiAoeGhyKSA9PiB7XG4gICAgICAgICAgICAgICAgICBfLmVhY2goaGVhZGVycywgKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihrZXksIHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHhocjtcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICB9LFxuXG4gICAgICAgICAgYWRkQ29uZmlnSGVhZGVycyA9IChoZWFkZXJzLCBvcHRpb25zKSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiBfLmV4dGVuZCh7fSwgb3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgY29uZmlnOiBtZXJnZUNvbmZpZyhhZGRIZWFkZXJzKGhlYWRlcnMpLCBvcHRpb25zKVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICB9LFxuXG4gICAgICAgICAgcmVwcmVzZW50YXRpb25IZWFkZXIgPSB7XG4gICAgICAgICAgICAgICdQcmVmZXInOiAncmV0dXJuPXJlcHJlc2VudGF0aW9uJ1xuICAgICAgICAgIH07XG5cbiAgICBwb3N0Z3Jlc3QudG9rZW4gPSB0b2tlbjtcblxuICAgIHBvc3RncmVzdC5sb2FkZXIgPSAob3B0aW9ucywgcmVxdWVzdEZ1bmN0aW9uLCBkZWZhdWx0U3RhdGUgPSBmYWxzZSkgPT4ge1xuICAgICAgICBjb25zdCBsb2FkZXIgPSBtLnByb3AoZGVmYXVsdFN0YXRlKSxcbiAgICAgICAgICAgICAgZCA9IG0uZGVmZXJyZWQoKTtcbiAgICAgICAgbG9hZGVyLmxvYWQgPSAoKSA9PiB7XG4gICAgICAgICAgICBsb2FkZXIodHJ1ZSk7XG4gICAgICAgICAgICBtLnJlZHJhdygpO1xuICAgICAgICAgICAgcmVxdWVzdEZ1bmN0aW9uKF8uZXh0ZW5kKHt9LCBvcHRpb25zLCB7XG4gICAgICAgICAgICAgICAgYmFja2dyb3VuZDogdHJ1ZVxuICAgICAgICAgICAgfSkpLnRoZW4oKGRhdGEpID0+IHtcbiAgICAgICAgICAgICAgICBsb2FkZXIoZmFsc2UpO1xuICAgICAgICAgICAgICAgIGQucmVzb2x2ZShkYXRhKTtcbiAgICAgICAgICAgICAgICBtLnJlZHJhdygpO1xuICAgICAgICAgICAgfSwgKGVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgbG9hZGVyKGZhbHNlKTtcbiAgICAgICAgICAgICAgICBkLnJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgbS5yZWRyYXcoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIGQucHJvbWlzZTtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIGxvYWRlcjtcbiAgICB9O1xuXG4gICAgcG9zdGdyZXN0LmxvYWRlcldpdGhUb2tlbiA9IChvcHRpb25zLCBkZWZhdWx0U3RhdGUpID0+IHtcbiAgICAgICAgcmV0dXJuIHBvc3RncmVzdC5sb2FkZXIob3B0aW9ucywgcG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIGRlZmF1bHRTdGF0ZSk7XG4gICAgfTtcblxuICAgIHBvc3RncmVzdC5pbml0ID0gKGFwaVByZWZpeCwgYXV0aGVudGljYXRpb25PcHRpb25zKSA9PiB7XG4gICAgICAgIHBvc3RncmVzdC5yZXF1ZXN0ID0gKG9wdGlvbnMpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGVycm9ySGFuZGxlciA9ICh4aHIpID0+IHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBKU09OLnBhcnNlKHhoci5yZXNwb25zZVRleHQpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geGhyLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgaGludDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldGFpbHM6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogeGhyLnJlc3BvbnNlVGV4dFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgcmV0dXJuIG0ucmVxdWVzdChfLmV4dGVuZCh7ZXh0cmFjdDogZXJyb3JIYW5kbGVyfSwgb3B0aW9ucywge1xuICAgICAgICAgICAgICAgIHVybDogYXBpUHJlZml4ICsgb3B0aW9ucy51cmxcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfTtcblxuICAgICAgICBwb3N0Z3Jlc3QuYXV0aGVudGljYXRlID0gKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZGVmZXJyZWQgPSBtLmRlZmVycmVkKCk7XG4gICAgICAgICAgICBpZiAodG9rZW4oKSkge1xuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoe1xuICAgICAgICAgICAgICAgICAgICB0b2tlbjogdG9rZW4oKVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtLnJlcXVlc3QoXy5leHRlbmQoe30sIGF1dGhlbnRpY2F0aW9uT3B0aW9ucykpLnRoZW4oKGRhdGEpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdG9rZW4oZGF0YS50b2tlbik7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoe1xuICAgICAgICAgICAgICAgICAgICAgICAgdG9rZW46IHRva2VuKClcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSwgKGRhdGEpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVqZWN0KGRhdGEpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgICAgIH07XG5cbiAgICAgICAgcG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4gPSAob3B0aW9ucykgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIG0ucG9zdGdyZXN0LmF1dGhlbnRpY2F0ZSgpLnRoZW4oXG4gICAgICAgICAgICAgICAgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbS5wb3N0Z3Jlc3QucmVxdWVzdChhZGRDb25maWdIZWFkZXJzKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICdBdXRob3JpemF0aW9uJzogJ0JlYXJlciAnICsgdG9rZW4oKVxuICAgICAgICAgICAgICAgICAgICB9LCBvcHRpb25zKSk7XG4gICAgICAgICAgICAgICAgfSwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbS5wb3N0Z3Jlc3QucmVxdWVzdChvcHRpb25zKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApO1xuICAgICAgICB9O1xuXG4gICAgICAgIHBvc3RncmVzdC5tb2RlbCA9IChuYW1lKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwYWdpbmF0aW9uSGVhZGVycyA9IChwYWdlLCBwYWdlU2l6ZSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghcGFnZVNpemUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IHRvUmFuZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZyb20gPSAocGFnZSAtIDEpICogcGFnZVNpemUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRvID0gZnJvbSArIHBhZ2VTaXplIC0gMTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZyb20gKyAnLScgKyB0bztcbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgJ1JhbmdlLXVuaXQnOiAnaXRlbXMnLFxuICAgICAgICAgICAgICAgICAgICAnUmFuZ2UnOiB0b1JhbmdlKClcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgcGFnZVNpemUgPSBtLnByb3AoMTApLFxuXG4gICAgICAgICAgICAgICAgICBuYW1lT3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgICAgICAgICB1cmw6ICcvJyArIG5hbWVcbiAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgIGdldE9wdGlvbnMgPSAoZGF0YSwgcGFnZSwgcGFnZVNpemUsIG9wdGlvbnMsIGhlYWRlcnMgPSB7fSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGV4dHJhSGVhZGVycyA9IF8uZXh0ZW5kKHt9LCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICdQcmVmZXInOiAnY291bnQ9bm9uZSdcbiAgICAgICAgICAgICAgICAgICAgICB9LCBoZWFkZXJzLCBwYWdpbmF0aW9uSGVhZGVycyhwYWdlLCBwYWdlU2l6ZSkpO1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBhZGRDb25maWdIZWFkZXJzKGV4dHJhSGVhZGVycywgXy5leHRlbmQoe30sIG9wdGlvbnMsIG5hbWVPcHRpb25zLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IGRhdGFcbiAgICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgICBxdWVyeXN0cmluZyA9IChmaWx0ZXJzLCBvcHRpb25zKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy51cmwgKz0gJz8nICsgbS5yb3V0ZS5idWlsZFF1ZXJ5U3RyaW5nKGZpbHRlcnMpO1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBvcHRpb25zO1xuICAgICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgb3B0aW9ucyA9IChvcHRpb25zKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG0ucG9zdGdyZXN0LnJlcXVlc3QoXy5leHRlbmQoe30sIG9wdGlvbnMsIG5hbWVPcHRpb25zLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIG1ldGhvZDogJ09QVElPTlMnXG4gICAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgcG9zdE9wdGlvbnMgPSAoYXR0cmlidXRlcywgb3B0aW9ucywgaGVhZGVycyA9IHt9KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgZXh0cmFIZWFkZXJzID0gXy5leHRlbmQoe30sIHJlcHJlc2VudGF0aW9uSGVhZGVyLCBoZWFkZXJzKTtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWRkQ29uZmlnSGVhZGVycyhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZXh0cmFIZWFkZXJzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBfLmV4dGVuZCh7fSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZU9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YTogYXR0cmlidXRlc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgICBkZWxldGVPcHRpb25zID0gKGZpbHRlcnMsIG9wdGlvbnMsIGhlYWRlcnMgPSB7fSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGV4dHJhSGVhZGVycyA9IGFkZEhlYWRlcnMoXy5leHRlbmQoe30sIGhlYWRlcnMpKTtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcXVlcnlzdHJpbmcoZmlsdGVycywgYWRkQ29uZmlnSGVhZGVycyhleHRyYUhlYWRlcnMsIF8uZXh0ZW5kKHt9LCBvcHRpb25zLCBuYW1lT3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdERUxFVEUnXG4gICAgICAgICAgICAgICAgICAgICAgfSkpKTtcbiAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgIHBhdGNoT3B0aW9ucyA9IChmaWx0ZXJzLCBhdHRyaWJ1dGVzLCBvcHRpb25zLCBoZWFkZXJzID0ge30pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBleHRyYUhlYWRlcnMgPSBfLmV4dGVuZCh7fSwgcmVwcmVzZW50YXRpb25IZWFkZXIsIGhlYWRlcnMpO1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBxdWVyeXN0cmluZyhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsdGVycyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkQ29uZmlnSGVhZGVycyhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4dHJhSGVhZGVycyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF8uZXh0ZW5kKHt9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWVPcHRpb25zLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnUEFUQ0gnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IGF0dHJpYnV0ZXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgIGdldFBhZ2VPcHRpb25zID0gKGRhdGEsIHBhZ2UsIG9wdGlvbnMsIGhlYWRlcnMgPSB7fSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBnZXRPcHRpb25zKGRhdGEsIChwYWdlIHx8IDEpLCBwYWdlU2l6ZSgpLCBvcHRpb25zLCBoZWFkZXJzKTtcbiAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgIGdldFJvd09wdGlvbnMgPSAoZGF0YSwgb3B0aW9ucywgaGVhZGVycyA9IHt9KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGdldE9wdGlvbnMoZGF0YSwgMSwgMSwgb3B0aW9ucywgaGVhZGVycyk7XG4gICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHBhZ2VTaXplOiBwYWdlU2l6ZSxcbiAgICAgICAgICAgICAgICBnZXRQYWdlT3B0aW9uczogZ2V0UGFnZU9wdGlvbnMsXG4gICAgICAgICAgICAgICAgZ2V0Um93T3B0aW9uczogZ2V0Um93T3B0aW9ucyxcbiAgICAgICAgICAgICAgICBwYXRjaE9wdGlvbnM6IHBhdGNoT3B0aW9ucyxcbiAgICAgICAgICAgICAgICBwb3N0T3B0aW9uczogcG9zdE9wdGlvbnMsXG4gICAgICAgICAgICAgICAgZGVsZXRlT3B0aW9uczogZGVsZXRlT3B0aW9ucyxcbiAgICAgICAgICAgICAgICBnZXRQYWdlOiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIGdldFBhZ2VPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBnZXRSb3c6IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgZ2V0Um93T3B0aW9ucyksXG4gICAgICAgICAgICAgICAgcGF0Y2g6IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgcGF0Y2hPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBwb3N0OiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIHBvc3RPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBkZWxldGVSZXF1ZXN0OiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIGRlbGV0ZU9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIGdldFBhZ2VXaXRoVG9rZW46IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgZ2V0UGFnZU9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIGdldFJvd1dpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBnZXRSb3dPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBwYXRjaFdpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBwYXRjaE9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIHBvc3RXaXRoVG9rZW46IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgcG9zdE9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIGRlbGV0ZVdpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBkZWxldGVPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBvcHRpb25zOiBvcHRpb25zXG4gICAgICAgICAgICB9O1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiBwb3N0Z3Jlc3Q7XG4gICAgfTtcblxuICAgIG0ucG9zdGdyZXN0ID0gcG9zdGdyZXN0O1xufSkpO1xuIiwiKGZ1bmN0aW9uKGZhY3RvcnkpIHtcbiAgICBpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIC8vIE5vZGUvQ29tbW9uSlNcbiAgICAgICAgZmFjdG9yeShyZXF1aXJlKCdtaXRocmlsJyksIHJlcXVpcmUoJ3VuZGVyc2NvcmUnKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy8gQnJvd3NlciBnbG9iYWxzXG4gICAgICAgIGZhY3Rvcnkod2luZG93Lm0sIHdpbmRvdy5fKTtcbiAgICB9XG59KChtLCBfKSA9PiB7XG4gICAgbS5wb3N0Z3Jlc3QuZmlsdGVyc1ZNID0gKGF0dHJpYnV0ZXMpID0+IHtcbiAgICAgICAgdmFyIG5ld1ZNID0ge30sXG4gICAgICAgICAgICBmaWx0ZXIgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdmFyIHByb3AgPSBtLnByb3AoJycpLFxuICAgICAgICAgICAgICAgICAgICBmaWx0ZXJQcm9wID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3AodmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXdWTTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwcm9wKCk7XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgLy8gSnVzdCBzbyB3ZSBjYW4gaGF2ZSBhIGRlZmF1bHQgdG9fZmlsdGVyIGFuZCBhdm9pZCBpZiBfLmlzRnVuY3Rpb24gY2FsbHNcbiAgICAgICAgICAgICAgICBmaWx0ZXJQcm9wLnRvRmlsdGVyID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gXy5pc1N0cmluZyhmaWx0ZXJQcm9wKCkpID8gZmlsdGVyUHJvcCgpLnRyaW0oKSA6IGZpbHRlclByb3AoKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIHJldHVybiBmaWx0ZXJQcm9wO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgZ2V0dGVycyA9IF8ucmVkdWNlKFxuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXMsIChtZW1vLCBvcGVyYXRvciwgYXR0cikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyBUaGUgb3BlcmF0b3IgYmV0d2VlbiBpcyBpbXBsZW1lbnRlZCB3aXRoIHR3byBwcm9wZXJ0aWVzLCBvbmUgZm9yIGdyZWF0ZXIgdGhhbiB2YWx1ZSBhbmQgYW5vdGhlciBmb3IgbGVzc2VyIHRoYW4gdmFsdWUuXG4gICAgICAgICAgICAgICAgICAgIC8vIEJvdGggcHJvcGVydGllcyBhcmUgc2VudCBpbiB0aGUgcXVldXJ5c3RyaW5nIHdpdGggdGhlIHNhbWUgbmFtZSxcbiAgICAgICAgICAgICAgICAgICAgLy8gdGhhdCdzIHdoeSB3ZSBuZWVkIHRoZSBzcGVjaWFsIGNhc2UgaGVyZSwgc28gd2UgY2FuIHVzZSBhIHNpbXBsZSBtYXAgYXMgYXJndW1lbnQgdG8gZmlsdGVyc1ZNLlxuICAgICAgICAgICAgICAgICAgICBpZiAob3BlcmF0b3IgPT09ICdiZXR3ZWVuJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsdGU6IGZpbHRlcigpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGd0ZTogZmlsdGVyKClcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gZmlsdGVyKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICAgICAgICBvcmRlcjogbS5wcm9wKClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApLFxuXG4gICAgICAgICAgICBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBfLnJlZHVjZShcbiAgICAgICAgICAgICAgICAgICAgZ2V0dGVycywgKG1lbW8sIGdldHRlciwgYXR0cikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGF0dHIgIT09ICdvcmRlcicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgb3BlcmF0b3IgPSBhdHRyaWJ1dGVzW2F0dHJdO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKF8uaXNGdW5jdGlvbihnZXR0ZXIudG9GaWx0ZXIpICYmIChnZXR0ZXIudG9GaWx0ZXIoKSA9PT0gdW5kZWZpbmVkIHx8IGdldHRlci50b0ZpbHRlcigpID09PSAnJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQmVsbG93IHdlIHVzZSBkaWZmZXJlbnQgZm9ybWF0dGluZyBydWxlcyBmb3IgdGhlIHZhbHVlIGRlcGVuZGluZyBvbiB0aGUgb3BlcmF0b3JcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBUaGVzZSBydWxlcyBhcmUgdXNlZCByZWdhcmRsZXNzIG9mIHRoZSB0b0ZpbHRlciBmdW5jdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBzbyB0aGUgdXNlciBjYW4gdXNlIGEgY3VzdG9tIHRvRmlsdGVyIHdpdGhvdXQgaGF2aW5nIHRvIHdvcnJ5IHdpdGggYmFzaWMgZmlsdGVyIHN5bnRheFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvcGVyYXRvciA9PT0gJ2lsaWtlJyB8fCBvcGVyYXRvciA9PT0gJ2xpa2UnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lbW9bYXR0cl0gPSBvcGVyYXRvciArICcuKicgKyBnZXR0ZXIudG9GaWx0ZXIoKSArICcqJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG9wZXJhdG9yID09PSAnQEAnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lbW9bYXR0cl0gPSBvcGVyYXRvciArICcuJyArIGdldHRlci50b0ZpbHRlcigpLnJlcGxhY2UoL1xccysvZywgJyYnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG9wZXJhdG9yID09PSAnYmV0d2VlbicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFnZXR0ZXIubHRlLnRvRmlsdGVyKCkgJiYgIWdldHRlci5ndGUudG9GaWx0ZXIoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZ2V0dGVyLmd0ZSgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdLnB1c2goJ2d0ZS4nICsgZ2V0dGVyLmd0ZS50b0ZpbHRlcigpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZ2V0dGVyLmx0ZSgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdLnB1c2goJ2x0ZS4nICsgZ2V0dGVyLmx0ZS50b0ZpbHRlcigpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAob3BlcmF0b3IgPT09ICdpcy5udWxsJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gZ2V0dGVyLnRvRmlsdGVyKCkgPT09IG51bGwgPyAnaXMubnVsbCcgOiAnbm90LmlzLm51bGwnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lbW9bYXR0cl0gPSBvcGVyYXRvciArICcuJyArIGdldHRlci50b0ZpbHRlcigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgICAgICAgICB9LCB7fVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBwYXJhbWV0ZXJzID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIC8vIFRoZSBvcmRlciBwYXJhbWV0ZXJzIGhhdmUgYSBzcGVjaWFsIHN5bnRheCAoanVzdCBsaWtlIGFuIG9yZGVyIGJ5IFNRTCBjbGF1c2UpXG4gICAgICAgICAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2JlZ3JpZmZzL3Bvc3RncmVzdC93aWtpL1JvdXRpbmcjZmlsdGVyaW5nLWFuZC1vcmRlcmluZ1xuICAgICAgICAgICAgICAgIHZhciBvcmRlciA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGdldHRlcnMub3JkZXIoKSAmJiBfLnJlZHVjZShcbiAgICAgICAgICAgICAgICAgICAgICAgIGdldHRlcnMub3JkZXIoKSwgKG1lbW8sIGRpcmVjdGlvbiwgYXR0cikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lbW8ucHVzaChhdHRyICsgJy4nICsgZGlyZWN0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sIFtdXG4gICAgICAgICAgICAgICAgICAgICkuam9pbignLCcpO1xuICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgICAgb3JkZXJQYXJhbWV0ZXIgPSBvcmRlcigpID8ge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3JkZXI6IG9yZGVyKClcbiAgICAgICAgICAgICAgICAgICAgfSA6IHt9O1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIF8uZXh0ZW5kKHt9LCBvcmRlclBhcmFtZXRlciwgcGFyYW1ldGVyc1dpdGhvdXRPcmRlcigpKTtcblxuICAgICAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gXy5leHRlbmQobmV3Vk0sIGdldHRlcnMsIHtcbiAgICAgICAgICAgIHBhcmFtZXRlcnM6IHBhcmFtZXRlcnMsXG4gICAgICAgICAgICBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyOiBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyXG4gICAgICAgIH0pO1xuICAgIH07XG59KSk7XG4iLCIoZnVuY3Rpb24oZmFjdG9yeSkge1xuICAgIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgLy8gTm9kZS9Db21tb25KU1xuICAgICAgICBmYWN0b3J5KHJlcXVpcmUoJ21pdGhyaWwnKSwgcmVxdWlyZSgndW5kZXJzY29yZScpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyBCcm93c2VyIGdsb2JhbHNcbiAgICAgICAgZmFjdG9yeSh3aW5kb3cubSwgd2luZG93Ll8pO1xuICAgIH1cbn0oZnVuY3Rpb24obSwgXykge1xuICAgIG0ucG9zdGdyZXN0LnBhZ2luYXRpb25WTSA9IChtb2RlbCwgb3JkZXIsIGF1dGhlbnRpY2F0ZSA9IHRydWUpID0+IHtcbiAgICAgICAgbGV0IGNvbGxlY3Rpb24gPSBtLnByb3AoW10pLFxuICAgICAgICAgICAgZGVmYXVsdE9yZGVyID0gb3JkZXIgfHwgJ2lkLmRlc2MnLFxuICAgICAgICAgICAgZmlsdGVycyA9IG0ucHJvcCh7XG4gICAgICAgICAgICAgICAgb3JkZXI6IGRlZmF1bHRPcmRlclxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBpc0xvYWRpbmcgPSBtLnByb3AoZmFsc2UpLFxuICAgICAgICAgICAgcGFnZSA9IG0ucHJvcCgxKSxcbiAgICAgICAgICAgIHJlc3VsdHNDb3VudCA9IG0ucHJvcCgpLFxuICAgICAgICAgICAgcGFnZVJlcXVlc3QgPSBhdXRoZW50aWNhdGUgPyBtb2RlbC5nZXRQYWdlV2l0aFRva2VuIDogbW9kZWwuZ2V0UGFnZSxcbiAgICAgICAgICAgIHRvdGFsID0gbS5wcm9wKCk7XG5cbiAgICAgICAgY29uc3QgZmV0Y2ggPSAoKSA9PiB7XG4gICAgICAgICAgICBsZXQgZCA9IG0uZGVmZXJyZWQoKTtcbiAgICAgICAgICAgIGNvbnN0IGdldFRvdGFsID0gKHhocikgPT4ge1xuICAgICAgICAgICAgICAgIGlmICgheGhyIHx8IHhoci5zdGF0dXMgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGhpbnQ6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXRhaWxzOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdDb25uZWN0aW9uIGVycm9yJ1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbGV0IHJhbmdlSGVhZGVyID0geGhyLmdldFJlc3BvbnNlSGVhZGVyKCdDb250ZW50LVJhbmdlJyk7XG4gICAgICAgICAgICAgICAgaWYgKF8uaXNTdHJpbmcocmFuZ2VIZWFkZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBbc2l6ZSwgY291bnRdID0gcmFuZ2VIZWFkZXIuc3BsaXQoJy8nKSwgW2Zyb20sIHRvXSA9IHNpemUuc3BsaXQoJy0nKTtcblxuICAgICAgICAgICAgICAgICAgICB0b3RhbChwYXJzZUludChjb3VudCkpO1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRzQ291bnQoKHBhcnNlSW50KHRvKSAtIHBhcnNlSW50KGZyb20pICsgMSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBKU09OLnBhcnNlKHhoci5yZXNwb25zZVRleHQpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geGhyLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgaGludDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldGFpbHM6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogeGhyLnJlc3BvbnNlVGV4dFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaXNMb2FkaW5nKHRydWUpO1xuICAgICAgICAgICAgcGFnZVJlcXVlc3QoZmlsdGVycygpLCBwYWdlKCksIHtcbiAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cnVlLFxuICAgICAgICAgICAgICAgIGV4dHJhY3Q6IGdldFRvdGFsXG4gICAgICAgICAgICB9LCB7XG4gICAgICAgICAgICAgICAgJ1ByZWZlcic6ICdjb3VudD1leGFjdCdcbiAgICAgICAgICAgIH0pLnRoZW4oKGRhdGEpID0+IHtcbiAgICAgICAgICAgICAgICBjb2xsZWN0aW9uKF8udW5pb24oY29sbGVjdGlvbigpLCBkYXRhKSk7XG4gICAgICAgICAgICAgICAgaXNMb2FkaW5nKGZhbHNlKTtcbiAgICAgICAgICAgICAgICBkLnJlc29sdmUoY29sbGVjdGlvbigpKTtcbiAgICAgICAgICAgICAgICBtLnJlZHJhdygpO1xuICAgICAgICAgICAgfSwgKGVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgaXNMb2FkaW5nKGZhbHNlKTtcbiAgICAgICAgICAgICAgICB0b3RhbCgwKTtcbiAgICAgICAgICAgICAgICBkLnJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgbS5yZWRyYXcoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIGQucHJvbWlzZTtcbiAgICAgICAgfSxcblxuICAgICAgICAgICAgICBmaXJzdFBhZ2UgPSAocGFyYW1ldGVycykgPT4ge1xuICAgICAgICAgICAgICAgICAgZmlsdGVycyhfLmV4dGVuZCh7XG4gICAgICAgICAgICAgICAgICAgICAgb3JkZXI6IGRlZmF1bHRPcmRlclxuICAgICAgICAgICAgICAgICAgfSwgcGFyYW1ldGVycykpO1xuICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbihbXSk7XG4gICAgICAgICAgICAgICAgICBwYWdlKDEpO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIGZldGNoKCk7XG4gICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgaXNMYXN0UGFnZSA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiAocGFnZSgpICogbW9kZWwucGFnZVNpemUoKSA+PSB0b3RhbCgpKTtcbiAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICBuZXh0UGFnZSA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgIHBhZ2UocGFnZSgpICsgMSk7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gZmV0Y2goKTtcbiAgICAgICAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY29sbGVjdGlvbjogY29sbGVjdGlvbixcbiAgICAgICAgICAgIGZpcnN0UGFnZTogZmlyc3RQYWdlLFxuICAgICAgICAgICAgaXNMb2FkaW5nOiBpc0xvYWRpbmcsXG4gICAgICAgICAgICBuZXh0UGFnZTogbmV4dFBhZ2UsXG4gICAgICAgICAgICBpc0xhc3RQYWdlOiBpc0xhc3RQYWdlLFxuICAgICAgICAgICAgdG90YWw6IHRvdGFsLFxuICAgICAgICAgICAgcmVzdWx0c0NvdW50OiByZXN1bHRzQ291bnRcbiAgICAgICAgfTtcbiAgICB9O1xuXG59KSk7XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=