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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1pdGhyaWwucG9zdGdyZXN0LmpzIiwidm1zL2ZpbHRlcnNWTS5qcyIsInZtcy9wYWdpbmF0aW9uVk0uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxBQUFDLENBQUEsVUFBUyxPQUFPLEVBQUU7QUFDZixRQUFJLE9BQU8sT0FBTyxLQUFLLFFBQVEsRUFBRTs7QUFFN0IsZUFBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsRUFBRSxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztLQUN0RCxNQUFNOztBQUVILGVBQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUMvQjtDQUNKLENBQUEsQ0FBQyxVQUFDLENBQUMsRUFBRSxDQUFDLEVBQUs7QUFDUixRQUFJLFNBQVMsR0FBRyxFQUFFLENBQUM7O0FBRW5CLFFBQU0sS0FBSyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUU7UUFFaEIsV0FBVyxHQUFHLFNBQWQsV0FBVyxDQUFJLE1BQU0sRUFBRSxPQUFPLEVBQUs7QUFDL0IsZUFBTyxPQUFPLElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxHQUFHLE1BQU0sQ0FBQztLQUMvRjtRQUVELFVBQVUsR0FBRyxTQUFiLFVBQVUsQ0FBSSxPQUFPLEVBQUs7QUFDdEIsZUFBTyxVQUFDLEdBQUcsRUFBSztBQUNaLGFBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLFVBQUMsS0FBSyxFQUFFLEdBQUcsRUFBSztBQUM1QixtQkFBRyxDQUFDLGdCQUFnQixDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQzthQUNwQyxDQUFDLENBQUM7QUFDSCxtQkFBTyxHQUFHLENBQUM7U0FDZCxDQUFDO0tBQ0w7UUFFRCxnQkFBZ0IsR0FBRyxTQUFuQixnQkFBZ0IsQ0FBSSxPQUFP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LEdBQUcsU0FBYixVQUFVLEdBQVM7QUFDZixtQkFBUSxZQUFZLEVBQUUsSUFBSSxLQUFLLENBQUMsUUFBUSxFQUFFLEdBQUcsWUFBWSxFQUFFLENBQUU7U0FDaEU7WUFFRCxRQUFRLEdBQUcsU0FBWCxRQUFRLEdBQVM7QUFDYixnQkFBSSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ2pCLG1CQUFPLEtBQUssRUFBRSxDQUFDO1NBQ2xCLENBQUM7O0FBRVIsZUFBTztBQUNILHNCQUFVLEVBQUUsVUFBVTtBQUN0QixxQkFBUyxFQUFFLFNBQVM7QUFDcEIscUJBQVMsRUFBRSxTQUFTO0FBQ3BCLG9CQUFRLEVBQUUsUUFBUTtBQUNsQixzQkFBVSxFQUFFLFVBQVU7QUFDdEIsaUJBQUssRUFBRSxLQUFLO0FBQ1osd0JBQVksRUFBRSxZQUFZO1NBQzdCLENBQUM7S0FDTCxDQUFDO0NBRUwsQ0FBQyxDQUFFIiwiZmlsZSI6Im1pdGhyaWwucG9zdGdyZXN0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKGZhY3RvcnkpIHtcbiAgICBpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIC8vIE5vZGUvQ29tbW9uSlNcbiAgICAgICAgZmFjdG9yeShyZXF1aXJlKCdtaXRocmlsJyksIHJlcXVpcmUoJ3VuZGVyc2NvcmUnKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy8gQnJvd3NlciBnbG9iYWxzXG4gICAgICAgIGZhY3Rvcnkod2luZG93Lm0sIHdpbmRvdy5fKTtcbiAgICB9XG59KChtLCBfKSA9PiB7XG4gICAgbGV0IHBvc3RncmVzdCA9IHt9O1xuXG4gICAgY29uc3QgdG9rZW4gPSBtLnByb3AoKSxcblxuICAgICAgICAgIG1lcmdlQ29uZmlnID0gKGNvbmZpZywgb3B0aW9ucykgPT4ge1xuICAgICAgICAgICAgICByZXR1cm4gb3B0aW9ucyAmJiBfLmlzRnVuY3Rpb24ob3B0aW9ucy5jb25maWcpID8gXy5jb21wb3NlKG9wdGlvbnMuY29uZmlnLCBjb25maWcpIDogY29uZmlnO1xuICAgICAgICAgIH0sXG5cbiAgICAgICAgICBhZGRIZWFkZXJzID0gKGhlYWRlcnMpID0+IHtcbiAgICAgICAgICAgICAgcmV0dXJuICh4aHIpID0+IHtcbiAgICAgICAgICAgICAgICAgIF8uZWFjaChoZWFkZXJzLCAodmFsdWUsIGtleSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKGtleSwgdmFsdWUpO1xuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICByZXR1cm4geGhyO1xuICAgICAgICAgICAgICB9O1xuICAgICAgICAgIH0sXG5cbiAgICAgICAgICBhZGRDb25maWdIZWFkZXJzID0gKGhlYWRlcnMsIG9wdGlvbnMpID0+IHtcbiAgICAgICAgICAgICAgcmV0dXJuIF8uZXh0ZW5kKHt9LCBvcHRpb25zLCB7XG4gICAgICAgICAgICAgICAgICBjb25maWc6IG1lcmdlQ29uZmlnKGFkZEhlYWRlcnMoaGVhZGVycyksIG9wdGlvbnMpXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0sXG5cbiAgICAgICAgICByZXByZXNlbnRhdGlvbkhlYWRlciA9IHtcbiAgICAgICAgICAgICAgJ1ByZWZlcic6ICdyZXR1cm49cmVwcmVzZW50YXRpb24nXG4gICAgICAgICAgfTtcblxuICAgIHBvc3RncmVzdC50b2tlbiA9IHRva2VuO1xuXG4gICAgcG9zdGdyZXN0LmxvYWRlciA9IChvcHRpb25zLCByZXF1ZXN0RnVuY3Rpb24sIGRlZmF1bHRTdGF0ZSA9IGZhbHNlKSA9PiB7XG4gICAgICAgIGNvbnN0IGxvYWRlciA9IG0ucHJvcChkZWZhdWx0U3RhdGUpLFxuICAgICAgICAgICAgICBkID0gbS5kZWZlcnJlZCgpO1xuICAgICAgICBsb2FkZXIubG9hZCA9ICgpID0+IHtcbiAgICAgICAgICAgIGxvYWRlcih0cnVlKTtcbiAgICAgICAgICAgIG0ucmVkcmF3KCk7XG4gICAgICAgICAgICByZXF1ZXN0RnVuY3Rpb24oXy5leHRlbmQoe30sIG9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cnVlXG4gICAgICAgICAgICB9KSkudGhlbigoZGF0YSkgPT4ge1xuICAgICAgICAgICAgICAgIGxvYWRlcihmYWxzZSk7XG4gICAgICAgICAgICAgICAgZC5yZXNvbHZlKGRhdGEpO1xuICAgICAgICAgICAgICAgIG0ucmVkcmF3KCk7XG4gICAgICAgICAgICB9LCAoZXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICBsb2FkZXIoZmFsc2UpO1xuICAgICAgICAgICAgICAgIGQucmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgICAgICBtLnJlZHJhdygpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gZC5wcm9taXNlO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gbG9hZGVyO1xuICAgIH07XG5cbiAgICBwb3N0Z3Jlc3QubG9hZGVyV2l0aFRva2VuID0gKG9wdGlvbnMsIGRlZmF1bHRTdGF0ZSkgPT4ge1xuICAgICAgICByZXR1cm4gcG9zdGdyZXN0LmxvYWRlcihvcHRpb25zLCBwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgZGVmYXVsdFN0YXRlKTtcbiAgICB9O1xuXG4gICAgcG9zdGdyZXN0LmluaXQgPSAoYXBpUHJlZml4LCBhdXRoZW50aWNhdGlvbk9wdGlvbnMpID0+IHtcbiAgICAgICAgcG9zdGdyZXN0LnJlcXVlc3QgPSAob3B0aW9ucykgPT4ge1xuICAgICAgICAgICAgY29uc3QgZXJyb3JIYW5kbGVyID0gKHhocikgPT4ge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIEpTT04ucGFyc2UoeGhyLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB4aHIucmVzcG9uc2VUZXh0O1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBoaW50OiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGV0YWlsczogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiB4aHIucmVzcG9uc2VUZXh0XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXR1cm4gbS5yZXF1ZXN0KF8uZXh0ZW5kKHtleHRyYWN0OiBlcnJvckhhbmRsZXJ9LCBvcHRpb25zLCB7XG4gICAgICAgICAgICAgICAgdXJsOiBhcGlQcmVmaXggKyBvcHRpb25zLnVybFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHBvc3RncmVzdC5hdXRoZW50aWNhdGUgPSAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBkZWZlcnJlZCA9IG0uZGVmZXJyZWQoKTtcbiAgICAgICAgICAgIGlmICh0b2tlbigpKSB7XG4gICAgICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSh7XG4gICAgICAgICAgICAgICAgICAgIHRva2VuOiB0b2tlbigpXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG0ucmVxdWVzdChfLmV4dGVuZCh7fSwgYXV0aGVudGljYXRpb25PcHRpb25zKSkudGhlbigoZGF0YSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0b2tlbihkYXRhLnRva2VuKTtcbiAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSh7XG4gICAgICAgICAgICAgICAgICAgICAgICB0b2tlbjogdG9rZW4oKVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9LCAoZGF0YSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZGF0YSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICAgICAgfTtcblxuICAgICAgICBwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiA9IChvcHRpb25zKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gbS5wb3N0Z3Jlc3QuYXV0aGVudGljYXRlKCkudGhlbihcbiAgICAgICAgICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBtLnBvc3RncmVzdC5yZXF1ZXN0KGFkZENvbmZpZ0hlYWRlcnMoe1xuICAgICAgICAgICAgICAgICAgICAgICAgJ0F1dGhvcml6YXRpb24nOiAnQmVhcmVyICcgKyB0b2tlbigpXG4gICAgICAgICAgICAgICAgICAgIH0sIG9wdGlvbnMpKTtcbiAgICAgICAgICAgICAgICB9LCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBtLnBvc3RncmVzdC5yZXF1ZXN0KG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG4gICAgICAgIH07XG5cbiAgICAgICAgcG9zdGdyZXN0Lm1vZGVsID0gKG5hbWUpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHBhZ2luYXRpb25IZWFkZXJzID0gKHBhZ2UsIHBhZ2VTaXplKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCFwYWdlU2l6ZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgdG9SYW5nZSA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZnJvbSA9IChwYWdlIC0gMSkgKiBwYWdlU2l6ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdG8gPSBmcm9tICsgcGFnZVNpemUgLSAxO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZnJvbSArICctJyArIHRvO1xuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAnUmFuZ2UtdW5pdCc6ICdpdGVtcycsXG4gICAgICAgICAgICAgICAgICAgICdSYW5nZSc6IHRvUmFuZ2UoKVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgICBwYWdlU2l6ZSA9IG0ucHJvcCgxMCksXG5cbiAgICAgICAgICAgICAgICAgIG5hbWVPcHRpb25zID0ge1xuICAgICAgICAgICAgICAgICAgICAgIHVybDogJy8nICsgbmFtZVxuICAgICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgZ2V0T3B0aW9ucyA9IChkYXRhLCBwYWdlLCBwYWdlU2l6ZSwgb3B0aW9ucywgaGVhZGVycyA9IHt9KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgZXh0cmFIZWFkZXJzID0gXy5leHRlbmQoe30sIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgJ1ByZWZlcic6ICdjb3VudD1ub25lJ1xuICAgICAgICAgICAgICAgICAgICAgIH0sIGhlYWRlcnMsIHBhZ2luYXRpb25IZWFkZXJzKHBhZ2UsIHBhZ2VTaXplKSk7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFkZENvbmZpZ0hlYWRlcnMoZXh0cmFIZWFkZXJzLCBfLmV4dGVuZCh7fSwgb3B0aW9ucywgbmFtZU9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YTogZGF0YVxuICAgICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgIHF1ZXJ5c3RyaW5nID0gKGZpbHRlcnMsIG9wdGlvbnMpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLnVybCArPSAnPycgKyBtLnJvdXRlLmJ1aWxkUXVlcnlTdHJpbmcoZmlsdGVycyk7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9wdGlvbnM7XG4gICAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgICBvcHRpb25zID0gKG9wdGlvbnMpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbS5wb3N0Z3Jlc3QucmVxdWVzdChfLmV4dGVuZCh7fSwgb3B0aW9ucywgbmFtZU9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnT1BUSU9OUydcbiAgICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgICBwb3N0T3B0aW9ucyA9IChhdHRyaWJ1dGVzLCBvcHRpb25zLCBoZWFkZXJzID0ge30pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBleHRyYUhlYWRlcnMgPSBfLmV4dGVuZCh7fSwgcmVwcmVzZW50YXRpb25IZWFkZXIsIGhlYWRlcnMpO1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBhZGRDb25maWdIZWFkZXJzKFxuICAgICAgICAgICAgICAgICAgICAgICAgICBleHRyYUhlYWRlcnMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIF8uZXh0ZW5kKHt9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lT3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiBhdHRyaWJ1dGVzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgIGRlbGV0ZU9wdGlvbnMgPSAoZmlsdGVycywgb3B0aW9ucywgaGVhZGVycyA9IHt9KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgZXh0cmFIZWFkZXJzID0gYWRkSGVhZGVycyhfLmV4dGVuZCh7fSwgaGVhZGVycykpO1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBxdWVyeXN0cmluZyhmaWx0ZXJzLCBhZGRDb25maWdIZWFkZXJzKGV4dHJhSGVhZGVycywgXy5leHRlbmQoe30sIG9wdGlvbnMsIG5hbWVPcHRpb25zLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIG1ldGhvZDogJ0RFTEVURSdcbiAgICAgICAgICAgICAgICAgICAgICB9KSkpO1xuICAgICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgcGF0Y2hPcHRpb25zID0gKGZpbHRlcnMsIGF0dHJpYnV0ZXMsIG9wdGlvbnMsIGhlYWRlcnMgPSB7fSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGV4dHJhSGVhZGVycyA9IF8uZXh0ZW5kKHt9LCByZXByZXNlbnRhdGlvbkhlYWRlciwgaGVhZGVycyk7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHF1ZXJ5c3RyaW5nKFxuICAgICAgICAgICAgICAgICAgICAgICAgICBmaWx0ZXJzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBhZGRDb25maWdIZWFkZXJzKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXh0cmFIZWFkZXJzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXy5leHRlbmQoe30sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZU9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdQQVRDSCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YTogYXR0cmlidXRlc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgZ2V0UGFnZU9wdGlvbnMgPSAoZGF0YSwgcGFnZSwgb3B0aW9ucywgaGVhZGVycyA9IHt9KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGdldE9wdGlvbnMoZGF0YSwgKHBhZ2UgfHwgMSksIHBhZ2VTaXplKCksIG9wdGlvbnMsIGhlYWRlcnMpO1xuICAgICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgZ2V0Um93T3B0aW9ucyA9IChkYXRhLCBvcHRpb25zLCBoZWFkZXJzID0ge30pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZ2V0T3B0aW9ucyhkYXRhLCAxLCAxLCBvcHRpb25zLCBoZWFkZXJzKTtcbiAgICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgcGFnZVNpemU6IHBhZ2VTaXplLFxuICAgICAgICAgICAgICAgIGdldFBhZ2VPcHRpb25zOiBnZXRQYWdlT3B0aW9ucyxcbiAgICAgICAgICAgICAgICBnZXRSb3dPcHRpb25zOiBnZXRSb3dPcHRpb25zLFxuICAgICAgICAgICAgICAgIHBhdGNoT3B0aW9uczogcGF0Y2hPcHRpb25zLFxuICAgICAgICAgICAgICAgIHBvc3RPcHRpb25zOiBwb3N0T3B0aW9ucyxcbiAgICAgICAgICAgICAgICBkZWxldGVPcHRpb25zOiBkZWxldGVPcHRpb25zLFxuICAgICAgICAgICAgICAgIGdldFBhZ2U6IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgZ2V0UGFnZU9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIGdldFJvdzogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0LCBnZXRSb3dPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBwYXRjaDogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0LCBwYXRjaE9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIHBvc3Q6IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgcG9zdE9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIGRlbGV0ZVJlcXVlc3Q6IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgZGVsZXRlT3B0aW9ucyksXG4gICAgICAgICAgICAgICAgZ2V0UGFnZVdpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBnZXRQYWdlT3B0aW9ucyksXG4gICAgICAgICAgICAgICAgZ2V0Um93V2l0aFRva2VuOiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIGdldFJvd09wdGlvbnMpLFxuICAgICAgICAgICAgICAgIHBhdGNoV2l0aFRva2VuOiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIHBhdGNoT3B0aW9ucyksXG4gICAgICAgICAgICAgICAgcG9zdFdpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBwb3N0T3B0aW9ucyksXG4gICAgICAgICAgICAgICAgZGVsZXRlV2l0aFRva2VuOiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIGRlbGV0ZU9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIG9wdGlvbnM6IG9wdGlvbnNcbiAgICAgICAgICAgIH07XG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIHBvc3RncmVzdDtcbiAgICB9O1xuXG4gICAgbS5wb3N0Z3Jlc3QgPSBwb3N0Z3Jlc3Q7XG59KSk7XG4iLCIoZnVuY3Rpb24oZmFjdG9yeSkge1xuICAgIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgLy8gTm9kZS9Db21tb25KU1xuICAgICAgICBmYWN0b3J5KHJlcXVpcmUoJ21pdGhyaWwnKSwgcmVxdWlyZSgndW5kZXJzY29yZScpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyBCcm93c2VyIGdsb2JhbHNcbiAgICAgICAgZmFjdG9yeSh3aW5kb3cubSwgd2luZG93Ll8pO1xuICAgIH1cbn0oKG0sIF8pID0+IHtcbiAgICBtLnBvc3RncmVzdC5maWx0ZXJzVk0gPSAoYXR0cmlidXRlcykgPT4ge1xuICAgICAgICB2YXIgbmV3Vk0gPSB7fSxcbiAgICAgICAgICAgIGZpbHRlciA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICB2YXIgcHJvcCA9IG0ucHJvcCgnJyksXG4gICAgICAgICAgICAgICAgICAgIGZpbHRlclByb3AgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ld1ZNO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByb3AoKTtcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAvLyBKdXN0IHNvIHdlIGNhbiBoYXZlIGEgZGVmYXVsdCB0b19maWx0ZXIgYW5kIGF2b2lkIGlmIF8uaXNGdW5jdGlvbiBjYWxsc1xuICAgICAgICAgICAgICAgIGZpbHRlclByb3AudG9GaWx0ZXIgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBfLmlzU3RyaW5nKGZpbHRlclByb3AoKSkgPyBmaWx0ZXJQcm9wKCkudHJpbSgpIDogZmlsdGVyUHJvcCgpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZpbHRlclByb3A7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBnZXR0ZXJzID0gXy5yZWR1Y2UoXG4gICAgICAgICAgICAgICAgYXR0cmlidXRlcywgKG1lbW8sIG9wZXJhdG9yLCBhdHRyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFRoZSBvcGVyYXRvciBiZXR3ZWVuIGlzIGltcGxlbWVudGVkIHdpdGggdHdvIHByb3BlcnRpZXMsIG9uZSBmb3IgZ3JlYXRlciB0aGFuIHZhbHVlIGFuZCBhbm90aGVyIGZvciBsZXNzZXIgdGhhbiB2YWx1ZS5cbiAgICAgICAgICAgICAgICAgICAgLy8gQm90aCBwcm9wZXJ0aWVzIGFyZSBzZW50IGluIHRoZSBxdWV1cnlzdHJpbmcgd2l0aCB0aGUgc2FtZSBuYW1lLFxuICAgICAgICAgICAgICAgICAgICAvLyB0aGF0J3Mgd2h5IHdlIG5lZWQgdGhlIHNwZWNpYWwgY2FzZSBoZXJlLCBzbyB3ZSBjYW4gdXNlIGEgc2ltcGxlIG1hcCBhcyBhcmd1bWVudCB0byBmaWx0ZXJzVk0uXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcGVyYXRvciA9PT0gJ2JldHdlZW4nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGx0ZTogZmlsdGVyKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ3RlOiBmaWx0ZXIoKVxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lbW9bYXR0cl0gPSBmaWx0ZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgICAgICAgICB9LCB7XG4gICAgICAgICAgICAgICAgICAgIG9yZGVyOiBmaWx0ZXIoKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICksXG5cbiAgICAgICAgICAgIHBhcmFtZXRlcnNXaXRob3V0T3JkZXIgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIF8ucmVkdWNlKFxuICAgICAgICAgICAgICAgICAgICBnZXR0ZXJzLCAobWVtbywgZ2V0dGVyLCBhdHRyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXR0ciAhPT0gJ29yZGVyJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhciBvcGVyYXRvciA9IGF0dHJpYnV0ZXNbYXR0cl07XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoXy5pc0Z1bmN0aW9uKGdldHRlci50b0ZpbHRlcikgJiYgKGdldHRlci50b0ZpbHRlcigpID09PSB1bmRlZmluZWQgfHwgZ2V0dGVyLnRvRmlsdGVyKCkgPT09ICcnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBCZWxsb3cgd2UgdXNlIGRpZmZlcmVudCBmb3JtYXR0aW5nIHJ1bGVzIGZvciB0aGUgdmFsdWUgZGVwZW5kaW5nIG9uIHRoZSBvcGVyYXRvclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRoZXNlIHJ1bGVzIGFyZSB1c2VkIHJlZ2FyZGxlc3Mgb2YgdGhlIHRvRmlsdGVyIGZ1bmN0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNvIHRoZSB1c2VyIGNhbiB1c2UgYSBjdXN0b20gdG9GaWx0ZXIgd2l0aG91dCBoYXZpbmcgdG8gd29ycnkgd2l0aCBiYXNpYyBmaWx0ZXIgc3ludGF4XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9wZXJhdG9yID09PSAnaWxpa2UnIHx8IG9wZXJhdG9yID09PSAnbGlrZScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IG9wZXJhdG9yICsgJy4qJyArIGdldHRlci50b0ZpbHRlcigpICsgJyonO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAob3BlcmF0b3IgPT09ICdAQCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IG9wZXJhdG9yICsgJy4nICsgZ2V0dGVyLnRvRmlsdGVyKCkucmVwbGFjZSgvXFxzKy9nLCAnJicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAob3BlcmF0b3IgPT09ICdiZXR3ZWVuJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWdldHRlci5sdGUudG9GaWx0ZXIoKSAmJiAhZ2V0dGVyLmd0ZS50b0ZpbHRlcigpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChnZXR0ZXIuZ3RlKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lbW9bYXR0cl0ucHVzaCgnZ3RlLicgKyBnZXR0ZXIuZ3RlLnRvRmlsdGVyKCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChnZXR0ZXIubHRlKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lbW9bYXR0cl0ucHVzaCgnbHRlLicgKyBnZXR0ZXIubHRlLnRvRmlsdGVyKCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChvcGVyYXRvciA9PT0gJ2lzLm51bGwnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lbW9bYXR0cl0gPSBnZXR0ZXIudG9GaWx0ZXIoKSA9PT0gbnVsbCA/ICdpcy5udWxsJyA6ICdub3QuaXMubnVsbCc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IG9wZXJhdG9yICsgJy4nICsgZ2V0dGVyLnRvRmlsdGVyKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgICAgICAgICAgICAgIH0sIHt9XG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIHBhcmFtZXRlcnMgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgLy8gVGhlIG9yZGVyIHBhcmFtZXRlcnMgaGF2ZSBhIHNwZWNpYWwgc3ludGF4IChqdXN0IGxpa2UgYW4gb3JkZXIgYnkgU1FMIGNsYXVzZSlcbiAgICAgICAgICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vYmVncmlmZnMvcG9zdGdyZXN0L3dpa2kvUm91dGluZyNmaWx0ZXJpbmctYW5kLW9yZGVyaW5nXG4gICAgICAgICAgICAgICAgdmFyIG9yZGVyID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZ2V0dGVycy5vcmRlcigpICYmIF8ucmVkdWNlKFxuICAgICAgICAgICAgICAgICAgICAgICAgZ2V0dGVycy5vcmRlcigpLCAobWVtbywgZGlyZWN0aW9uLCBhdHRyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtby5wdXNoKGF0dHIgKyAnLicgKyBkaXJlY3Rpb24pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSwgW11cbiAgICAgICAgICAgICAgICAgICAgKS5qb2luKCcsJyk7XG4gICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgICBvcmRlclBhcmFtZXRlciA9IG9yZGVyKCkgPyB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcmRlcjogb3JkZXIoKVxuICAgICAgICAgICAgICAgICAgICB9IDoge307XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gXy5leHRlbmQoe30sIG9yZGVyUGFyYW1ldGVyLCBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyKCkpO1xuXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiBfLmV4dGVuZChuZXdWTSwgZ2V0dGVycywge1xuICAgICAgICAgICAgcGFyYW1ldGVyczogcGFyYW1ldGVycyxcbiAgICAgICAgICAgIHBhcmFtZXRlcnNXaXRob3V0T3JkZXI6IHBhcmFtZXRlcnNXaXRob3V0T3JkZXJcbiAgICAgICAgfSk7XG4gICAgfTtcbn0pKTtcbiIsIihmdW5jdGlvbihmYWN0b3J5KSB7XG4gICAgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xuICAgICAgICAvLyBOb2RlL0NvbW1vbkpTXG4gICAgICAgIGZhY3RvcnkocmVxdWlyZSgnbWl0aHJpbCcpLCByZXF1aXJlKCd1bmRlcnNjb3JlJykpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEJyb3dzZXIgZ2xvYmFsc1xuICAgICAgICBmYWN0b3J5KHdpbmRvdy5tLCB3aW5kb3cuXyk7XG4gICAgfVxufShmdW5jdGlvbihtLCBfKSB7XG4gICAgbS5wb3N0Z3Jlc3QucGFnaW5hdGlvblZNID0gKG1vZGVsLCBvcmRlciwgZXh0cmFIZWFkZXJzID0ge30sIGF1dGhlbnRpY2F0ZSA9IHRydWUpID0+IHtcbiAgICAgICAgbGV0IGNvbGxlY3Rpb24gPSBtLnByb3AoW10pLFxuICAgICAgICAgICAgZGVmYXVsdE9yZGVyID0gb3JkZXIgfHwgJ2lkLmRlc2MnLFxuICAgICAgICAgICAgZmlsdGVycyA9IG0ucHJvcCh7XG4gICAgICAgICAgICAgICAgb3JkZXI6IGRlZmF1bHRPcmRlclxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBpc0xvYWRpbmcgPSBtLnByb3AoZmFsc2UpLFxuICAgICAgICAgICAgcGFnZSA9IG0ucHJvcCgxKSxcbiAgICAgICAgICAgIHJlc3VsdHNDb3VudCA9IG0ucHJvcCgpLFxuICAgICAgICAgICAgcGFnZVJlcXVlc3QgPSBhdXRoZW50aWNhdGUgPyBtb2RlbC5nZXRQYWdlV2l0aFRva2VuIDogbW9kZWwuZ2V0UGFnZSxcbiAgICAgICAgICAgIHRvdGFsID0gbS5wcm9wKCk7XG5cbiAgICAgICAgY29uc3QgZmV0Y2ggPSAoKSA9PiB7XG4gICAgICAgICAgICBsZXQgZCA9IG0uZGVmZXJyZWQoKTtcbiAgICAgICAgICAgIGNvbnN0IGdldFRvdGFsID0gKHhocikgPT4ge1xuICAgICAgICAgICAgICAgIGlmICgheGhyIHx8IHhoci5zdGF0dXMgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGhpbnQ6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXRhaWxzOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdDb25uZWN0aW9uIGVycm9yJ1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbGV0IHJhbmdlSGVhZGVyID0geGhyLmdldFJlc3BvbnNlSGVhZGVyKCdDb250ZW50LVJhbmdlJyk7XG4gICAgICAgICAgICAgICAgaWYgKF8uaXNTdHJpbmcocmFuZ2VIZWFkZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBbc2l6ZSwgY291bnRdID0gcmFuZ2VIZWFkZXIuc3BsaXQoJy8nKSwgW2Zyb20sIHRvXSA9IHNpemUuc3BsaXQoJy0nKTtcblxuICAgICAgICAgICAgICAgICAgICB0b3RhbChwYXJzZUludChjb3VudCkpO1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRzQ291bnQoKHBhcnNlSW50KHRvKSAtIHBhcnNlSW50KGZyb20pICsgMSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBKU09OLnBhcnNlKHhoci5yZXNwb25zZVRleHQpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geGhyLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgaGludDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldGFpbHM6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogeGhyLnJlc3BvbnNlVGV4dFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaXNMb2FkaW5nKHRydWUpO1xuICAgICAgICAgICAgcGFnZVJlcXVlc3QoZmlsdGVycygpLCBwYWdlKCksIHtcbiAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cnVlLFxuICAgICAgICAgICAgICAgIGV4dHJhY3Q6IGdldFRvdGFsXG4gICAgICAgICAgICB9LCBleHRyYUhlYWRlcnMpLnRoZW4oKGRhdGEpID0+IHtcbiAgICAgICAgICAgICAgICBjb2xsZWN0aW9uKF8udW5pb24oY29sbGVjdGlvbigpLCBkYXRhKSk7XG4gICAgICAgICAgICAgICAgaXNMb2FkaW5nKGZhbHNlKTtcbiAgICAgICAgICAgICAgICBkLnJlc29sdmUoY29sbGVjdGlvbigpKTtcbiAgICAgICAgICAgICAgICBtLnJlZHJhdygpO1xuICAgICAgICAgICAgfSwgKGVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgaXNMb2FkaW5nKGZhbHNlKTtcbiAgICAgICAgICAgICAgICB0b3RhbCgwKTtcbiAgICAgICAgICAgICAgICBkLnJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgICAgbS5yZWRyYXcoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIGQucHJvbWlzZTtcbiAgICAgICAgfSxcblxuICAgICAgICAgICAgICBmaXJzdFBhZ2UgPSAocGFyYW1ldGVycykgPT4ge1xuICAgICAgICAgICAgICAgICAgZmlsdGVycyhfLmV4dGVuZCh7XG4gICAgICAgICAgICAgICAgICAgICAgb3JkZXI6IGRlZmF1bHRPcmRlclxuICAgICAgICAgICAgICAgICAgfSwgcGFyYW1ldGVycykpO1xuICAgICAgICAgICAgICAgICAgY29sbGVjdGlvbihbXSk7XG4gICAgICAgICAgICAgICAgICBwYWdlKDEpO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIGZldGNoKCk7XG4gICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgaXNMYXN0UGFnZSA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiAocmVzdWx0c0NvdW50KCkgJiYgbW9kZWwucGFnZVNpemUoKSA+IHJlc3VsdHNDb3VudCgpKTtcbiAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICBuZXh0UGFnZSA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgIHBhZ2UocGFnZSgpICsgMSk7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gZmV0Y2goKTtcbiAgICAgICAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY29sbGVjdGlvbjogY29sbGVjdGlvbixcbiAgICAgICAgICAgIGZpcnN0UGFnZTogZmlyc3RQYWdlLFxuICAgICAgICAgICAgaXNMb2FkaW5nOiBpc0xvYWRpbmcsXG4gICAgICAgICAgICBuZXh0UGFnZTogbmV4dFBhZ2UsXG4gICAgICAgICAgICBpc0xhc3RQYWdlOiBpc0xhc3RQYWdlLFxuICAgICAgICAgICAgdG90YWw6IHRvdGFsLFxuICAgICAgICAgICAgcmVzdWx0c0NvdW50OiByZXN1bHRzQ291bnRcbiAgICAgICAgfTtcbiAgICB9O1xuXG59KSk7XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=