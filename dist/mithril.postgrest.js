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
            return m.request(_.extend({}, options, {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1pdGhyaWwucG9zdGdyZXN0LmpzIiwidm1zL2ZpbHRlcnNWTS5qcyIsInZtcy9wYWdpbmF0aW9uVk0uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxBQUFDLENBQUEsVUFBUyxPQUFPLEVBQUU7QUFDZixRQUFJLE9BQU8sT0FBTyxLQUFLLFFBQVEsRUFBRTs7QUFFN0IsZUFBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsRUFBRSxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztLQUN0RCxNQUFNOztBQUVILGVBQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUMvQjtDQUNKLENBQUEsQ0FBQyxVQUFDLENBQUMsRUFBRSxDQUFDLEVBQUs7QUFDUixRQUFJLFNBQVMsR0FBRyxFQUFFLENBQUM7O0FBRW5CLFFBQU0sS0FBSyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUU7UUFFaEIsV0FBVyxHQUFHLFNBQWQsV0FBVyxDQUFJLE1BQU0sRUFBRSxPQUFPLEVBQUs7QUFDL0IsZUFBTyxPQUFPLElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxHQUFHLE1BQU0sQ0FBQztLQUMvRjtRQUVELFVBQVUsR0FBRyxTQUFiLFVBQVUsQ0FBSSxPQUFPLEVBQUs7QUFDdEIsZUFBTyxVQUFDLEdBQUcsRUFBSztBQUNaLGFBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLFVBQUMsS0FBSyxFQUFFLEdBQUcsRUFBSztBQUM1QixtQkFBRyxDQUFDLGdCQUFnQixDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQzthQUNwQyxDQUFDLENBQUM7QUFDSCxtQkFBTyxHQUFHLENBQUM7U0FDZCxDQUFDO0tBQ0w7UUFFRCxnQkFBZ0IsR0FBRyxTQUFuQixnQkFBZ0IsQ0FBSSxPQUFP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dGlvbihmYWN0b3J5KSB7XG4gICAgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xuICAgICAgICAvLyBOb2RlL0NvbW1vbkpTXG4gICAgICAgIGZhY3RvcnkocmVxdWlyZSgnbWl0aHJpbCcpLCByZXF1aXJlKCd1bmRlcnNjb3JlJykpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEJyb3dzZXIgZ2xvYmFsc1xuICAgICAgICBmYWN0b3J5KHdpbmRvdy5tLCB3aW5kb3cuXyk7XG4gICAgfVxufSgobSwgXykgPT4ge1xuICAgIGxldCBwb3N0Z3Jlc3QgPSB7fTtcblxuICAgIGNvbnN0IHRva2VuID0gbS5wcm9wKCksXG5cbiAgICAgICAgICBtZXJnZUNvbmZpZyA9IChjb25maWcsIG9wdGlvbnMpID0+IHtcbiAgICAgICAgICAgICAgcmV0dXJuIG9wdGlvbnMgJiYgXy5pc0Z1bmN0aW9uKG9wdGlvbnMuY29uZmlnKSA/IF8uY29tcG9zZShvcHRpb25zLmNvbmZpZywgY29uZmlnKSA6IGNvbmZpZztcbiAgICAgICAgICB9LFxuXG4gICAgICAgICAgYWRkSGVhZGVycyA9IChoZWFkZXJzKSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiAoeGhyKSA9PiB7XG4gICAgICAgICAgICAgICAgICBfLmVhY2goaGVhZGVycywgKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihrZXksIHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHhocjtcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICB9LFxuXG4gICAgICAgICAgYWRkQ29uZmlnSGVhZGVycyA9IChoZWFkZXJzLCBvcHRpb25zKSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiBfLmV4dGVuZCh7fSwgb3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgY29uZmlnOiBtZXJnZUNvbmZpZyhhZGRIZWFkZXJzKGhlYWRlcnMpLCBvcHRpb25zKVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICB9LFxuXG4gICAgICAgICAgcmVwcmVzZW50YXRpb25IZWFkZXIgPSB7XG4gICAgICAgICAgICAgICdQcmVmZXInOiAncmV0dXJuPXJlcHJlc2VudGF0aW9uJ1xuICAgICAgICAgIH07XG5cbiAgICBwb3N0Z3Jlc3QudG9rZW4gPSB0b2tlbjtcblxuICAgIHBvc3RncmVzdC5sb2FkZXIgPSAob3B0aW9ucywgcmVxdWVzdEZ1bmN0aW9uLCBkZWZhdWx0U3RhdGUgPSBmYWxzZSkgPT4ge1xuICAgICAgICBjb25zdCBsb2FkZXIgPSBtLnByb3AoZGVmYXVsdFN0YXRlKSxcbiAgICAgICAgICAgICAgZCA9IG0uZGVmZXJyZWQoKTtcbiAgICAgICAgbG9hZGVyLmxvYWQgPSAoKSA9PiB7XG4gICAgICAgICAgICBsb2FkZXIodHJ1ZSk7XG4gICAgICAgICAgICBtLnJlZHJhdygpO1xuICAgICAgICAgICAgcmVxdWVzdEZ1bmN0aW9uKF8uZXh0ZW5kKHt9LCBvcHRpb25zLCB7XG4gICAgICAgICAgICAgICAgYmFja2dyb3VuZDogdHJ1ZVxuICAgICAgICAgICAgfSkpLnRoZW4oKGRhdGEpID0+IHtcbiAgICAgICAgICAgICAgICBsb2FkZXIoZmFsc2UpO1xuICAgICAgICAgICAgICAgIGQucmVzb2x2ZShkYXRhKTtcbiAgICAgICAgICAgICAgICBtLnJlZHJhdygpO1xuICAgICAgICAgICAgfSwgKGVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgbG9hZGVyKGZhbHNlKTtcbiAgICAgICAgICAgICAgICBkLnJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgbS5yZWRyYXcoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIGQucHJvbWlzZTtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIGxvYWRlcjtcbiAgICB9O1xuXG4gICAgcG9zdGdyZXN0LmxvYWRlcldpdGhUb2tlbiA9IChvcHRpb25zLCBkZWZhdWx0U3RhdGUpID0+IHtcbiAgICAgICAgcmV0dXJuIHBvc3RncmVzdC5sb2FkZXIob3B0aW9ucywgcG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIGRlZmF1bHRTdGF0ZSk7XG4gICAgfTtcblxuICAgIHBvc3RncmVzdC5pbml0ID0gKGFwaVByZWZpeCwgYXV0aGVudGljYXRpb25PcHRpb25zKSA9PiB7XG4gICAgICAgIHBvc3RncmVzdC5yZXF1ZXN0ID0gKG9wdGlvbnMpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBtLnJlcXVlc3QoXy5leHRlbmQoe30sIG9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICB1cmw6IGFwaVByZWZpeCArIG9wdGlvbnMudXJsXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgcG9zdGdyZXN0LmF1dGhlbnRpY2F0ZSA9ICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGRlZmVycmVkID0gbS5kZWZlcnJlZCgpO1xuICAgICAgICAgICAgaWYgKHRva2VuKCkpIHtcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHtcbiAgICAgICAgICAgICAgICAgICAgdG9rZW46IHRva2VuKClcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbS5yZXF1ZXN0KF8uZXh0ZW5kKHt9LCBhdXRoZW50aWNhdGlvbk9wdGlvbnMpKS50aGVuKChkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRva2VuKGRhdGEudG9rZW4pO1xuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRva2VuOiB0b2tlbigpXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0sIChkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChkYXRhKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgICAgICB9O1xuXG4gICAgICAgIHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuID0gKG9wdGlvbnMpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBtLnBvc3RncmVzdC5hdXRoZW50aWNhdGUoKS50aGVuKFxuICAgICAgICAgICAgICAgICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG0ucG9zdGdyZXN0LnJlcXVlc3QoYWRkQ29uZmlnSGVhZGVycyh7XG4gICAgICAgICAgICAgICAgICAgICAgICAnQXV0aG9yaXphdGlvbic6ICdCZWFyZXIgJyArIHRva2VuKClcbiAgICAgICAgICAgICAgICAgICAgfSwgb3B0aW9ucykpO1xuICAgICAgICAgICAgICAgIH0sICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG0ucG9zdGdyZXN0LnJlcXVlc3Qob3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfTtcblxuICAgICAgICBwb3N0Z3Jlc3QubW9kZWwgPSAobmFtZSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgcGFnaW5hdGlvbkhlYWRlcnMgPSAocGFnZSwgcGFnZVNpemUpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIXBhZ2VTaXplKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCB0b1JhbmdlID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmcm9tID0gKHBhZ2UgLSAxKSAqIHBhZ2VTaXplLFxuICAgICAgICAgICAgICAgICAgICAgICAgICB0byA9IGZyb20gKyBwYWdlU2l6ZSAtIDE7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmcm9tICsgJy0nICsgdG87XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICdSYW5nZS11bml0JzogJ2l0ZW1zJyxcbiAgICAgICAgICAgICAgICAgICAgJ1JhbmdlJzogdG9SYW5nZSgpXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgIHBhZ2VTaXplID0gbS5wcm9wKDEwKSxcblxuICAgICAgICAgICAgICAgICAgbmFtZU9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgdXJsOiAnLycgKyBuYW1lXG4gICAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgICBnZXRPcHRpb25zID0gKGRhdGEsIHBhZ2UsIHBhZ2VTaXplLCBvcHRpb25zLCBoZWFkZXJzID0ge30pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBleHRyYUhlYWRlcnMgPSBfLmV4dGVuZCh7fSwge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAnUHJlZmVyJzogJ2NvdW50PW5vbmUnXG4gICAgICAgICAgICAgICAgICAgICAgfSwgaGVhZGVycywgcGFnaW5hdGlvbkhlYWRlcnMocGFnZSwgcGFnZVNpemUpKTtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWRkQ29uZmlnSGVhZGVycyhleHRyYUhlYWRlcnMsIF8uZXh0ZW5kKHt9LCBvcHRpb25zLCBuYW1lT3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiBkYXRhXG4gICAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgcXVlcnlzdHJpbmcgPSAoZmlsdGVycywgb3B0aW9ucykgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMudXJsICs9ICc/JyArIG0ucm91dGUuYnVpbGRRdWVyeVN0cmluZyhmaWx0ZXJzKTtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gb3B0aW9ucztcbiAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgIG9wdGlvbnMgPSAob3B0aW9ucykgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtLnBvc3RncmVzdC5yZXF1ZXN0KF8uZXh0ZW5kKHt9LCBvcHRpb25zLCBuYW1lT3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdPUFRJT05TJ1xuICAgICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgIHBvc3RPcHRpb25zID0gKGF0dHJpYnV0ZXMsIG9wdGlvbnMsIGhlYWRlcnMgPSB7fSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGV4dHJhSGVhZGVycyA9IF8uZXh0ZW5kKHt9LCByZXByZXNlbnRhdGlvbkhlYWRlciwgaGVhZGVycyk7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFkZENvbmZpZ0hlYWRlcnMoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGV4dHJhSGVhZGVycyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgXy5leHRlbmQoe30sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWVPcHRpb25zLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IGF0dHJpYnV0ZXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgZGVsZXRlT3B0aW9ucyA9IChmaWx0ZXJzLCBvcHRpb25zLCBoZWFkZXJzID0ge30pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBleHRyYUhlYWRlcnMgPSBhZGRIZWFkZXJzKF8uZXh0ZW5kKHt9LCBoZWFkZXJzKSk7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHF1ZXJ5c3RyaW5nKGZpbHRlcnMsIGFkZENvbmZpZ0hlYWRlcnMoZXh0cmFIZWFkZXJzLCBfLmV4dGVuZCh7fSwgb3B0aW9ucywgbmFtZU9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnREVMRVRFJ1xuICAgICAgICAgICAgICAgICAgICAgIH0pKSk7XG4gICAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgICBwYXRjaE9wdGlvbnMgPSAoZmlsdGVycywgYXR0cmlidXRlcywgb3B0aW9ucywgaGVhZGVycyA9IHt9KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgZXh0cmFIZWFkZXJzID0gXy5leHRlbmQoe30sIHJlcHJlc2VudGF0aW9uSGVhZGVyLCBoZWFkZXJzKTtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcXVlcnlzdHJpbmcoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGZpbHRlcnMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGFkZENvbmZpZ0hlYWRlcnMoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleHRyYUhlYWRlcnMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBfLmV4dGVuZCh7fSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lT3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1ldGhvZDogJ1BBVENIJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiBhdHRyaWJ1dGVzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgICBnZXRQYWdlT3B0aW9ucyA9IChkYXRhLCBwYWdlLCBvcHRpb25zLCBoZWFkZXJzID0ge30pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZ2V0T3B0aW9ucyhkYXRhLCAocGFnZSB8fCAxKSwgcGFnZVNpemUoKSwgb3B0aW9ucywgaGVhZGVycyk7XG4gICAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgICBnZXRSb3dPcHRpb25zID0gKGRhdGEsIG9wdGlvbnMsIGhlYWRlcnMgPSB7fSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBnZXRPcHRpb25zKGRhdGEsIDEsIDEsIG9wdGlvbnMsIGhlYWRlcnMpO1xuICAgICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBwYWdlU2l6ZTogcGFnZVNpemUsXG4gICAgICAgICAgICAgICAgZ2V0UGFnZU9wdGlvbnM6IGdldFBhZ2VPcHRpb25zLFxuICAgICAgICAgICAgICAgIGdldFJvd09wdGlvbnM6IGdldFJvd09wdGlvbnMsXG4gICAgICAgICAgICAgICAgcGF0Y2hPcHRpb25zOiBwYXRjaE9wdGlvbnMsXG4gICAgICAgICAgICAgICAgcG9zdE9wdGlvbnM6IHBvc3RPcHRpb25zLFxuICAgICAgICAgICAgICAgIGRlbGV0ZU9wdGlvbnM6IGRlbGV0ZU9wdGlvbnMsXG4gICAgICAgICAgICAgICAgZ2V0UGFnZTogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0LCBnZXRQYWdlT3B0aW9ucyksXG4gICAgICAgICAgICAgICAgZ2V0Um93OiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIGdldFJvd09wdGlvbnMpLFxuICAgICAgICAgICAgICAgIHBhdGNoOiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIHBhdGNoT3B0aW9ucyksXG4gICAgICAgICAgICAgICAgcG9zdDogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0LCBwb3N0T3B0aW9ucyksXG4gICAgICAgICAgICAgICAgZGVsZXRlUmVxdWVzdDogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0LCBkZWxldGVPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBnZXRQYWdlV2l0aFRva2VuOiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIGdldFBhZ2VPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBnZXRSb3dXaXRoVG9rZW46IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgZ2V0Um93T3B0aW9ucyksXG4gICAgICAgICAgICAgICAgcGF0Y2hXaXRoVG9rZW46IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgcGF0Y2hPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBwb3N0V2l0aFRva2VuOiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIHBvc3RPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBkZWxldGVXaXRoVG9rZW46IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgZGVsZXRlT3B0aW9ucyksXG4gICAgICAgICAgICAgICAgb3B0aW9uczogb3B0aW9uc1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gcG9zdGdyZXN0O1xuICAgIH07XG5cbiAgICBtLnBvc3RncmVzdCA9IHBvc3RncmVzdDtcbn0pKTtcbiIsIihmdW5jdGlvbihmYWN0b3J5KSB7XG4gICAgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xuICAgICAgICAvLyBOb2RlL0NvbW1vbkpTXG4gICAgICAgIGZhY3RvcnkocmVxdWlyZSgnbWl0aHJpbCcpLCByZXF1aXJlKCd1bmRlcnNjb3JlJykpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEJyb3dzZXIgZ2xvYmFsc1xuICAgICAgICBmYWN0b3J5KHdpbmRvdy5tLCB3aW5kb3cuXyk7XG4gICAgfVxufSgobSwgXykgPT4ge1xuICAgIG0ucG9zdGdyZXN0LmZpbHRlcnNWTSA9IChhdHRyaWJ1dGVzKSA9PiB7XG4gICAgICAgIHZhciBuZXdWTSA9IHt9LFxuICAgICAgICAgICAgZmlsdGVyID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIHZhciBwcm9wID0gbS5wcm9wKCcnKSxcbiAgICAgICAgICAgICAgICAgICAgZmlsdGVyUHJvcCA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wKHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3Vk07XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcHJvcCgpO1xuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIC8vIEp1c3Qgc28gd2UgY2FuIGhhdmUgYSBkZWZhdWx0IHRvX2ZpbHRlciBhbmQgYXZvaWQgaWYgXy5pc0Z1bmN0aW9uIGNhbGxzXG4gICAgICAgICAgICAgICAgZmlsdGVyUHJvcC50b0ZpbHRlciA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIF8uaXNTdHJpbmcoZmlsdGVyUHJvcCgpKSA/IGZpbHRlclByb3AoKS50cmltKCkgOiBmaWx0ZXJQcm9wKCk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmlsdGVyUHJvcDtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIGdldHRlcnMgPSBfLnJlZHVjZShcbiAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzLCAobWVtbywgb3BlcmF0b3IsIGF0dHIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVGhlIG9wZXJhdG9yIGJldHdlZW4gaXMgaW1wbGVtZW50ZWQgd2l0aCB0d28gcHJvcGVydGllcywgb25lIGZvciBncmVhdGVyIHRoYW4gdmFsdWUgYW5kIGFub3RoZXIgZm9yIGxlc3NlciB0aGFuIHZhbHVlLlxuICAgICAgICAgICAgICAgICAgICAvLyBCb3RoIHByb3BlcnRpZXMgYXJlIHNlbnQgaW4gdGhlIHF1ZXVyeXN0cmluZyB3aXRoIHRoZSBzYW1lIG5hbWUsXG4gICAgICAgICAgICAgICAgICAgIC8vIHRoYXQncyB3aHkgd2UgbmVlZCB0aGUgc3BlY2lhbCBjYXNlIGhlcmUsIHNvIHdlIGNhbiB1c2UgYSBzaW1wbGUgbWFwIGFzIGFyZ3VtZW50IHRvIGZpbHRlcnNWTS5cbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wZXJhdG9yID09PSAnYmV0d2VlbicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lbW9bYXR0cl0gPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbHRlOiBmaWx0ZXIoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBndGU6IGZpbHRlcigpXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IGZpbHRlcigpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgICAgIH0sIHtcbiAgICAgICAgICAgICAgICAgICAgb3JkZXI6IG0ucHJvcCgpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKSxcblxuICAgICAgICAgICAgcGFyYW1ldGVyc1dpdGhvdXRPcmRlciA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gXy5yZWR1Y2UoXG4gICAgICAgICAgICAgICAgICAgIGdldHRlcnMsIChtZW1vLCBnZXR0ZXIsIGF0dHIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhdHRyICE9PSAnb3JkZXInKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG9wZXJhdG9yID0gYXR0cmlidXRlc1thdHRyXTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChfLmlzRnVuY3Rpb24oZ2V0dGVyLnRvRmlsdGVyKSAmJiAoZ2V0dGVyLnRvRmlsdGVyKCkgPT09IHVuZGVmaW5lZCB8fCBnZXR0ZXIudG9GaWx0ZXIoKSA9PT0gJycpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEJlbGxvdyB3ZSB1c2UgZGlmZmVyZW50IGZvcm1hdHRpbmcgcnVsZXMgZm9yIHRoZSB2YWx1ZSBkZXBlbmRpbmcgb24gdGhlIG9wZXJhdG9yXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gVGhlc2UgcnVsZXMgYXJlIHVzZWQgcmVnYXJkbGVzcyBvZiB0aGUgdG9GaWx0ZXIgZnVuY3Rpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc28gdGhlIHVzZXIgY2FuIHVzZSBhIGN1c3RvbSB0b0ZpbHRlciB3aXRob3V0IGhhdmluZyB0byB3b3JyeSB3aXRoIGJhc2ljIGZpbHRlciBzeW50YXhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAob3BlcmF0b3IgPT09ICdpbGlrZScgfHwgb3BlcmF0b3IgPT09ICdsaWtlJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gb3BlcmF0b3IgKyAnLionICsgZ2V0dGVyLnRvRmlsdGVyKCkgKyAnKic7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChvcGVyYXRvciA9PT0gJ0BAJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gb3BlcmF0b3IgKyAnLicgKyBnZXR0ZXIudG9GaWx0ZXIoKS5yZXBsYWNlKC9cXHMrL2csICcmJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChvcGVyYXRvciA9PT0gJ2JldHdlZW4nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZ2V0dGVyLmx0ZS50b0ZpbHRlcigpICYmICFnZXR0ZXIuZ3RlLnRvRmlsdGVyKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lbW9bYXR0cl0gPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGdldHRlci5ndGUoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXS5wdXNoKCdndGUuJyArIGdldHRlci5ndGUudG9GaWx0ZXIoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGdldHRlci5sdGUoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXS5wdXNoKCdsdGUuJyArIGdldHRlci5sdGUudG9GaWx0ZXIoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gb3BlcmF0b3IgKyAnLicgKyBnZXR0ZXIudG9GaWx0ZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgICAgICAgICAgICAgfSwge31cbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgcGFyYW1ldGVycyA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAvLyBUaGUgb3JkZXIgcGFyYW1ldGVycyBoYXZlIGEgc3BlY2lhbCBzeW50YXggKGp1c3QgbGlrZSBhbiBvcmRlciBieSBTUUwgY2xhdXNlKVxuICAgICAgICAgICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9iZWdyaWZmcy9wb3N0Z3Jlc3Qvd2lraS9Sb3V0aW5nI2ZpbHRlcmluZy1hbmQtb3JkZXJpbmdcbiAgICAgICAgICAgICAgICB2YXIgb3JkZXIgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBnZXR0ZXJzLm9yZGVyKCkgJiYgXy5yZWR1Y2UoXG4gICAgICAgICAgICAgICAgICAgICAgICBnZXR0ZXJzLm9yZGVyKCksIChtZW1vLCBkaXJlY3Rpb24sIGF0dHIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZW1vLnB1c2goYXR0ciArICcuJyArIGRpcmVjdGlvbik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgICAgICAgICAgICAgICAgICB9LCBbXVxuICAgICAgICAgICAgICAgICAgICApLmpvaW4oJywnKTtcbiAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgICAgIG9yZGVyUGFyYW1ldGVyID0gb3JkZXIoKSA/IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9yZGVyOiBvcmRlcigpXG4gICAgICAgICAgICAgICAgICAgIH0gOiB7fTtcblxuICAgICAgICAgICAgICAgIHJldHVybiBfLmV4dGVuZCh7fSwgb3JkZXJQYXJhbWV0ZXIsIHBhcmFtZXRlcnNXaXRob3V0T3JkZXIoKSk7XG5cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIF8uZXh0ZW5kKG5ld1ZNLCBnZXR0ZXJzLCB7XG4gICAgICAgICAgICBwYXJhbWV0ZXJzOiBwYXJhbWV0ZXJzLFxuICAgICAgICAgICAgcGFyYW1ldGVyc1dpdGhvdXRPcmRlcjogcGFyYW1ldGVyc1dpdGhvdXRPcmRlclxuICAgICAgICB9KTtcbiAgICB9O1xufSkpO1xuIiwiKGZ1bmN0aW9uKGZhY3RvcnkpIHtcbiAgICBpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIC8vIE5vZGUvQ29tbW9uSlNcbiAgICAgICAgZmFjdG9yeShyZXF1aXJlKCdtaXRocmlsJyksIHJlcXVpcmUoJ3VuZGVyc2NvcmUnKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy8gQnJvd3NlciBnbG9iYWxzXG4gICAgICAgIGZhY3Rvcnkod2luZG93Lm0sIHdpbmRvdy5fKTtcbiAgICB9XG59KGZ1bmN0aW9uKG0sIF8pIHtcbiAgICBtLnBvc3RncmVzdC5wYWdpbmF0aW9uVk0gPSAobW9kZWwsIG9yZGVyLCBhdXRoZW50aWNhdGUgPSB0cnVlKSA9PiB7XG4gICAgICAgIGxldCBjb2xsZWN0aW9uID0gbS5wcm9wKFtdKSxcbiAgICAgICAgICAgIGRlZmF1bHRPcmRlciA9IG9yZGVyIHx8ICdpZC5kZXNjJyxcbiAgICAgICAgICAgIGZpbHRlcnMgPSBtLnByb3Aoe1xuICAgICAgICAgICAgICAgIG9yZGVyOiBkZWZhdWx0T3JkZXJcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgaXNMb2FkaW5nID0gbS5wcm9wKGZhbHNlKSxcbiAgICAgICAgICAgIHBhZ2UgPSBtLnByb3AoMSksXG4gICAgICAgICAgICByZXN1bHRzQ291bnQgPSBtLnByb3AoKSxcbiAgICAgICAgICAgIHBhZ2VSZXF1ZXN0ID0gYXV0aGVudGljYXRlID8gbW9kZWwuZ2V0UGFnZVdpdGhUb2tlbiA6IG1vZGVsLmdldFBhZ2UsXG4gICAgICAgICAgICB0b3RhbCA9IG0ucHJvcCgpO1xuXG4gICAgICAgIGNvbnN0IGZldGNoID0gKCkgPT4ge1xuICAgICAgICAgICAgbGV0IGQgPSBtLmRlZmVycmVkKCk7XG4gICAgICAgICAgICBjb25zdCBnZXRUb3RhbCA9ICh4aHIpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIXhociB8fCB4aHIuc3RhdHVzID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBoaW50OiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGV0YWlsczogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnQ29ubmVjdGlvbiBlcnJvcidcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGxldCByYW5nZUhlYWRlciA9IHhoci5nZXRSZXNwb25zZUhlYWRlcignQ29udGVudC1SYW5nZScpO1xuICAgICAgICAgICAgICAgIGlmIChfLmlzU3RyaW5nKHJhbmdlSGVhZGVyKSkge1xuICAgICAgICAgICAgICAgICAgICBsZXQgW3NpemUsIGNvdW50XSA9IHJhbmdlSGVhZGVyLnNwbGl0KCcvJyksIFtmcm9tLCB0b10gPSBzaXplLnNwbGl0KCctJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgdG90YWwocGFyc2VJbnQoY291bnQpKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0c0NvdW50KChwYXJzZUludCh0bykgLSBwYXJzZUludChmcm9tKSArIDEpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgSlNPTi5wYXJzZSh4aHIucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHhoci5yZXNwb25zZVRleHQ7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGhpbnQ6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXRhaWxzOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IHhoci5yZXNwb25zZVRleHRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlzTG9hZGluZyh0cnVlKTtcbiAgICAgICAgICAgIHBhZ2VSZXF1ZXN0KGZpbHRlcnMoKSwgcGFnZSgpLCB7XG4gICAgICAgICAgICAgICAgYmFja2dyb3VuZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBleHRyYWN0OiBnZXRUb3RhbFxuICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICAgICdQcmVmZXInOiAnY291bnQ9ZXhhY3QnXG4gICAgICAgICAgICB9KS50aGVuKChkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgY29sbGVjdGlvbihfLnVuaW9uKGNvbGxlY3Rpb24oKSwgZGF0YSkpO1xuICAgICAgICAgICAgICAgIGlzTG9hZGluZyhmYWxzZSk7XG4gICAgICAgICAgICAgICAgZC5yZXNvbHZlKGNvbGxlY3Rpb24oKSk7XG4gICAgICAgICAgICAgICAgbS5yZWRyYXcoKTtcbiAgICAgICAgICAgIH0sIChlcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIGlzTG9hZGluZyhmYWxzZSk7XG4gICAgICAgICAgICAgICAgdG90YWwoMCk7XG4gICAgICAgICAgICAgICAgZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgIG0ucmVkcmF3KCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBkLnByb21pc2U7XG4gICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgZmlyc3RQYWdlID0gKHBhcmFtZXRlcnMpID0+IHtcbiAgICAgICAgICAgICAgICAgIGZpbHRlcnMoXy5leHRlbmQoe1xuICAgICAgICAgICAgICAgICAgICAgIG9yZGVyOiBkZWZhdWx0T3JkZXJcbiAgICAgICAgICAgICAgICAgIH0sIHBhcmFtZXRlcnMpKTtcbiAgICAgICAgICAgICAgICAgIGNvbGxlY3Rpb24oW10pO1xuICAgICAgICAgICAgICAgICAgcGFnZSgxKTtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBmZXRjaCgpO1xuICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgIGlzTGFzdFBhZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gKHBhZ2UoKSAqIG1vZGVsLnBhZ2VTaXplKCkgPj0gdG90YWwoKSk7XG4gICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgbmV4dFBhZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICBwYWdlKHBhZ2UoKSArIDEpO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIGZldGNoKCk7XG4gICAgICAgICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGNvbGxlY3Rpb246IGNvbGxlY3Rpb24sXG4gICAgICAgICAgICBmaXJzdFBhZ2U6IGZpcnN0UGFnZSxcbiAgICAgICAgICAgIGlzTG9hZGluZzogaXNMb2FkaW5nLFxuICAgICAgICAgICAgbmV4dFBhZ2U6IG5leHRQYWdlLFxuICAgICAgICAgICAgaXNMYXN0UGFnZTogaXNMYXN0UGFnZSxcbiAgICAgICAgICAgIHRvdGFsOiB0b3RhbCxcbiAgICAgICAgICAgIHJlc3VsdHNDb3VudDogcmVzdWx0c0NvdW50XG4gICAgICAgIH07XG4gICAgfTtcblxufSkpO1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9