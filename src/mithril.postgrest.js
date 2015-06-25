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

  var token = function(token){
    return (token) ? localStorage.setItem("postgrest.token", token) : localStorage.getItem("postgrest.token");
  };

  postgrest.reset = function(){
    localStorage.removeItem("postgrest.token");
  };

  postgrest.init = function(apiPrefix, authenticationOptions){
    postgrest.request = function(options){
      return m.request(_.extend(options, {url: apiPrefix + options.url}));
    };

    postgrest.model = function(name, attributes){
      var constructor = function(data){
        data = data || {};
        _.extend(
          this, 
          _.reduce(
            attributes, 
            function(memo, attr){ 
              memo[attr] = m.prop(data[attr]); 
              return memo;
            }, 
            {}
          )
        );
        this.pageSize = m.prop(10);
      }

      var generateXhrConfig = function(page){
        var toRange = function(){
          return (page * constructor.pageSize()) + "-" + ((page * constructor.pageSize()) + constructor.pageSize());
        };

        return function(xhr){
          xhr.setRequestHeader("Range-unit", "items");
          xhr.setRequestHeader("Range", toRange());
        };
      }

      constructor.getPage = function(filters, page){
        filters = filters || {};
        return m.postgrest.requestWithToken({method: "GET", url: "/" + name, config: generateXhrConfig(page)});
      };

      return constructor;
    };

    postgrest.requestWithToken = function(options){
      return m.postgrest.authenticate().then(function(data){
        var config = _.isFunction(options.config) ? _.compose(options.config, xhrConfig) : xhrConfig;
        return m.postgrest.request(_.extend(options, {config: config}));
      });
    };

    postgrest.authenticate = function(){
      var deferred = m.deferred();
      if(token()){
        deferred.resolve({token: token()});
      }
      else{
        m.request(authenticationOptions).then(function(data){
          token(data.token);
          deferred.resolve({token: data.token});
        });  
      }
      return deferred.promise;
    };
    return postgrest;
  };

  m.postgrest = postgrest;
}));
