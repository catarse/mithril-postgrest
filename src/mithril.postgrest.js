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
  postgrest.init = function(apiPrefix){

    postgrest.authenticate = function(options){
      var token = localStorage.getItem("postgrest.token");
      if(_.isString(token) && token.length > 0){
        var then = function(callback){ 
          callback({token: token}) 
        };

        postgrest.request = function(options){
          return m.request(_.extend(options, {url: apiPrefix + options.url, config: function(){} }));
        };

        return {then: then};
      }

      //TODO: should also redefine postgrest.request
      return m.request(options).then(function(data){
        localStorage.setItem("postgrest.token", data.token);
      });
    };

    postgrest.request = function(options){
      return m.request(_.extend(options, {url: apiPrefix + options.url}));
    };
  };

  m.postgrest = postgrest;
}));
