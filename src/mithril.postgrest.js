(function (factory) {
    if (typeof exports === 'object') {
        // Node/CommonJS
        factory(require('mithril'), require('underscore'), require('node-localstorage'));
    } else {
        // Browser globals
        factory(m, _, localStorage);
    }
}(function (m, _, localStorage) {
  var postgrest = {};

  var xhrConfig = function(xhr){
    xhr.setRequestHeader("Authorization", "Bearer " + token());
    return xhr;
  };

  var token = function(){
    return localStorage.getItem("postgrest.token");
  };

  postgrest.reset = function(){
    localStorage.removeItem("postgrest.token");
  };

  postgrest.init = function(apiPrefix){
    postgrest.request = function(options){
      return m.request(_.extend(options, {url: apiPrefix + options.url}));
    };

    postgrest.requestWithToken = function(options){
      var config = _.isFunction(options.config) ? _.compose(options.config, xhrConfig) : xhrConfig;
      return m.postgrest.request(_.extend(options, {config: config}));
    };
  };

  postgrest.authenticate = function(options){
    var deferred = m.deferred();
    if(token()){
      deferred.resolve({token: token()});
    }
    else{
      m.request(options).then(function(data){
        localStorage.setItem("postgrest.token", data.token);
        deferred.resolve({token: data.token});
      });  
    }
    return deferred.promise;
  };

  m.postgrest = postgrest;
}));
