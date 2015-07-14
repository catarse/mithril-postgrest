/*
    A Mithril.js plugin to authenticate requests against PostgREST
    Copyright (c) 2007 - 2015 Diogo Biazus
    Licensed under the MIT license (http://digitalbush.com/projects/masked-input-plugin/#license)
    Version: 1.0.0
*/
!function(factory) {
    "object" == typeof exports ? factory(require("mithril"), require("underscore"), require("node-localstorage")) : factory(m, _, localStorage);
}(function(m, _, localStorage) {
    var postgrest = {}, xhrConfig = function(xhr) {
        return xhr.setRequestHeader("Authorization", "Bearer " + token()), xhr;
    }, token = function(token) {
        return token ? localStorage.setItem("postgrest.token", token) : localStorage.getItem("postgrest.token");
    };
    postgrest.reset = function() {
        localStorage.removeItem("postgrest.token");
    }, postgrest.paginationVM = function(pageRequest, order) {
        var collection = m.prop([]), defaultOrder = order || "id.desc", filters = m.prop({
            order: defaultOrder
        }), isLoading = m.prop(!1), page = m.prop(1), total = m.prop(), fetch = function() {
            var d = m.deferred(), getTotal = function(xhr, xhrOptions) {
                var rangeHeader = xhr.getResponseHeader("Content-Range");
                return _.isString(rangeHeader) && rangeHeader.split("/").length > 1 && total(parseInt(rangeHeader.split("/")[1])), 
                xhr.responseText;
            };
            return isLoading(!0), m.redraw(), m.startComputation(), pageRequest(page(), filters(), {
                extract: getTotal
            }).then(function(data) {
                collection(_.union(collection(), data)), isLoading(!1), d.resolve(collection()), 
                m.endComputation();
            }), d.promise;
        }, filter = function(parameters) {
            return filters(_.extend({
                order: defaultOrder
            }, parameters)), collection([]), page(1), fetch();
        }, nextPage = function() {
            return page(page() + 1), fetch();
        };
        return {
            collection: collection,
            filter: filter,
            isLoading: isLoading,
            nextPage: nextPage,
            total: total
        };
    }, postgrest.filtersVM = function(attributes) {
        var getters = _.reduce(attributes, function(memo, operator, attr) {
            return "between" === operator ? memo[attr] = {
                lte: m.prop(""),
                gte: m.prop("")
            } : memo[attr] = m.prop(""), memo;
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
                    if ("ilike" === operator || "like" === operator) memo[attr] = operator + ".*" + getter() + "*"; else if ("@@" === operator) memo[attr] = operator + "." + getter().trim().replace(/\s+/g, "&"); else if ("between" === operator) {
                        if (!getter.lte() && !getter.gte()) return memo;
                        memo[attr] = [], getter.gte() && memo[attr].push("gte." + getter.gte()), getter.lte() && memo[attr].push("lte." + getter.lte());
                    } else memo[attr] = operator + "." + getter();
                }
                return memo;
            }, {});
        };
        return _.extend({}, getters, {
            parameters: parameters
        });
    }, postgrest.init = function(apiPrefix, authenticationOptions) {
        return postgrest.request = function(options) {
            return m.request(_.extend(options, {
                url: apiPrefix + options.url
            }));
        }, postgrest.model = function(name, attributes) {
            var constructor = function(data) {
                data = data || {}, _.extend(this, _.reduce(attributes, function(memo, attr) {
                    return memo[attr] = m.prop(data[attr]), memo;
                }, {}));
            };
            constructor.pageSize = m.prop(10);
            var generateXhrConfig = function(page) {
                var toRange = function() {
                    var from = (page - 1) * constructor.pageSize(), to = from + constructor.pageSize() - 1;
                    return from + "-" + to;
                };
                return function(xhr) {
                    xhr.setRequestHeader("Range-unit", "items"), xhr.setRequestHeader("Range", toRange());
                };
            }, generateGetPage = function(requestFunction) {
                return function(page, data, options) {
                    return requestFunction(_.extend({
                        method: "GET",
                        url: "/" + name,
                        data: data,
                        config: generateXhrConfig(page)
                    }, options));
                };
            };
            return constructor.getPageWithToken = generateGetPage(m.postgrest.requestWithToken), 
            constructor.getPage = generateGetPage(m.postgrest.request), constructor;
        }, postgrest.requestWithToken = function(options) {
            return m.postgrest.authenticate().then(function(data) {
                var config = _.isFunction(options.config) ? _.compose(options.config, xhrConfig) : xhrConfig;
                return m.postgrest.request(_.extend(options, {
                    config: config
                }));
            });
        }, postgrest.authenticate = function() {
            var deferred = m.deferred();
            return token() ? deferred.resolve({
                token: token()
            }) : m.request(authenticationOptions).then(function(data) {
                token(data.token), deferred.resolve({
                    token: data.token
                });
            }), deferred.promise;
        }, postgrest;
    }, m.postgrest = postgrest;
});