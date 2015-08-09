/*
    A Mithril.js plugin to authenticate requests against PostgREST
    Copyright (c) 2007 - 2015 Diogo Biazus
    Licensed under the MIT license 
    Version: 1.0.2
*/
!function(factory) {
    "object" == typeof exports ? factory(require("mithril"), require("underscore"), require("node-localstorage")) : factory(window.m, window._, window.localStorage);
}(function(m, _, localStorage) {
    var postgrest = {}, token = function(token) {
        return token ? localStorage.setItem("postgrest.token", token) : localStorage.getItem("postgrest.token");
    }, xhrConfig = function(xhr) {
        return xhr.setRequestHeader("Authorization", "Bearer " + token()), xhr;
    };
    postgrest.reset = function() {
        localStorage.removeItem("postgrest.token");
    }, postgrest.paginationVM = function(pageRequest, order) {
        var collection = m.prop([]), defaultOrder = order || "id.desc", filters = m.prop({
            order: defaultOrder
        }), isLoading = m.prop(!1), page = m.prop(1), total = m.prop(), fetch = function() {
            var d = m.deferred(), getTotal = function(xhr) {
                if (!xhr || 0 === xhr.status) return JSON.stringify({
                    hint: null,
                    details: null,
                    code: 0,
                    message: "Connection error"
                });
                var rangeHeader = xhr.getResponseHeader("Content-Range");
                return _.isString(rangeHeader) && rangeHeader.split("/").length > 1 && total(parseInt(rangeHeader.split("/")[1])), 
                xhr.responseText;
            };
            return isLoading(!0), m.redraw(), m.startComputation(), pageRequest(page(), filters(), {
                extract: getTotal
            }).then(function(data) {
                collection(_.union(collection(), data)), isLoading(!1), d.resolve(collection()), 
                m.endComputation();
            }, function(error) {
                isLoading(!1), total(0), m.endComputation(), d.reject(error);
            }), d.promise;
        }, firstPage = function(parameters) {
            return filters(_.extend({
                order: defaultOrder
            }, parameters)), collection([]), page(1), fetch();
        }, nextPage = function() {
            return page(page() + 1), fetch();
        };
        return {
            collection: collection,
            firstPage: firstPage,
            isLoading: isLoading,
            nextPage: nextPage,
            total: total
        };
    }, postgrest.filtersVM = function(attributes) {
        var filter = function() {
            var prop = m.prop("");
            return prop.toFilter = function() {
                return (prop() || "").toString().trim();
            }, prop;
        }, getters = _.reduce(attributes, function(memo, operator, attr) {
            return "between" === operator ? memo[attr] = {
                lte: filter(),
                gte: filter()
            } : memo[attr] = filter(), memo;
        }, {
            order: m.prop()
        }), parameters = function() {
            var order = function() {
                return getters.order() && _.reduce(getters.order(), function(memo, direction, attr) {
                    return memo.push(attr + "." + direction), memo;
                }, []).join(",");
            };
            return _.reduce(getters, function(memo, getter, attr) {
                if (order() && (memo.order = order()), "order" !== attr) {
                    var operator = attributes[attr];
                    if (_.isFunction(getter) && !getter()) return memo;
                    if ("ilike" === operator || "like" === operator) memo[attr] = operator + ".*" + getter.toFilter() + "*"; else if ("@@" === operator) memo[attr] = operator + "." + getter.toFilter().replace(/\s+/g, "&"); else if ("between" === operator) {
                        if (!getter.lte.toFilter() && !getter.gte.toFilter()) return memo;
                        memo[attr] = [], getter.gte() && memo[attr].push("gte." + getter.gte.toFilter()), 
                        getter.lte() && memo[attr].push("lte." + getter.lte.toFilter());
                    } else memo[attr] = operator + "." + getter.toFilter();
                }
                return memo;
            }, {});
        };
        return _.extend({}, getters, {
            parameters: parameters
        });
    }, postgrest.init = function(apiPrefix, authenticationOptions) {
        return postgrest.onAuthFailure = m.prop(function() {}), postgrest.request = function(options) {
            return m.request(_.extend(options, {
                url: apiPrefix + options.url
            }));
        }, postgrest.model = function(name, attributes) {
            var constructor = function(data) {
                data = data || {}, _.extend(this, _.reduce(attributes, function(memo, attr) {
                    return memo[attr] = m.prop(data[attr]), memo;
                }, {}));
            }, generateXhrConfig = function(page, pageSize) {
                var toRange = function() {
                    var from = (page - 1) * pageSize, to = from + pageSize - 1;
                    return from + "-" + to;
                };
                return function(xhr) {
                    xhr.setRequestHeader("Range-unit", "items"), xhr.setRequestHeader("Range", toRange());
                };
            }, request = function(requestFunction, config, data, options) {
                return requestFunction(_.extend({
                    method: "GET",
                    url: "/" + name,
                    data: data,
                    config: config
                }, options));
            }, generateGetPage = function(requestFunction) {
                return function(page, data, options) {
                    return request(requestFunction, generateXhrConfig(page, constructor.pageSize()), data, options);
                };
            }, generateGetRow = function(requestFunction) {
                return function(data, options) {
                    return request(requestFunction, generateXhrConfig(1, 1), data, options);
                };
            };
            return constructor.pageSize = m.prop(10), constructor.getPageWithToken = generateGetPage(m.postgrest.requestWithToken), 
            constructor.getPage = generateGetPage(m.postgrest.request), constructor.getRowWithToken = generateGetRow(m.postgrest.requestWithToken), 
            constructor.getRow = generateGetRow(m.postgrest.request), constructor;
        }, postgrest.requestWithToken = function(options) {
            return m.postgrest.authenticate().then(function() {
                var config = _.isFunction(options.config) ? _.compose(options.config, xhrConfig) : xhrConfig;
                return m.postgrest.request(_.extend(options, {
                    config: config
                }));
            });
        }, postgrest.authenticate = function() {
            var deferred = m.deferred();
            return token() ? (deferred.resolve({
                token: token()
            }), deferred.promise) : m.request(authenticationOptions).then(function(data) {
                token(data.token);
            }, postgrest.onAuthFailure());
        }, postgrest;
    }, m.postgrest = postgrest;
});