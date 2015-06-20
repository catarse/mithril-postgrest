/*
    A Mithril.js plugin to authenticate requests against PostgREST
    Copyright (c) 2007 - 2015 Diogo Biazus
    Licensed under the MIT license (http://digitalbush.com/projects/masked-input-plugin/#license)
    Version: 1.0.0
*/
!function(factory) {
    "object" == typeof exports ? factory(require("mithril"), require("node-localstorage")) : factory(m, localStorage);
}(function(m, localStorage) {
    var postgrest = {}, xhrConfig = function(xhr) {
        return xhr.setRequestHeader("Authorization", "Bearer " + token()), xhr;
    }, token = function(token) {
        return token ? localStorage.setItem("postgrest.token", token) : localStorage.getItem("postgrest.token");
    };
    postgrest.reset = function() {
        localStorage.removeItem("postgrest.token");
    }, postgrest.init = function(apiPrefix, authenticationOptions) {
        return postgrest.request = function(options) {
            return m.request(_.extend(options, {
                url: apiPrefix + options.url
            }));
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