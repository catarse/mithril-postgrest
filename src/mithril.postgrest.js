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
  function xhrConfig(xhr){
    if(token()){
      xhr.setRequestHeader("Authorization", "Bearer " + token());
    }
  }

  function token(){
    return localStorage.getItem("postgrest.token");
  }

  postgrest.reset = function(){};
  postgrest.init = function(apiPrefix){
    postgrest.request = function(options){
      return m.request(_.extend(options, {url: apiPrefix + options.url, config: xhrConfig}));
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
