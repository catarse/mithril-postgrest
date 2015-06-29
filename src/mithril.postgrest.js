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
      }
      constructor.pageSize = m.prop(10);

      var generateXhrConfig = function(page){
        var toRange = function(){
          var from = (page - 1) * constructor.pageSize();
          var to = from + constructor.pageSize() - 1;
          return from + "-" + to;
        };

        return function(xhr){
          xhr.setRequestHeader("Range-unit", "items");
          xhr.setRequestHeader("Range", toRange());
        };
      }

      var generateGetPage = function(requestFunction){
        return function(page, filters){
          filters = filters || {};
          return requestFunction({method: "GET", url: "/" + name, config: generateXhrConfig(page)});
        };
      };

      constructor.getPageWithToken = generateGetPage(m.postgrest.requestWithToken);
      constructor.getPage = generateGetPage(m.postgrest.request);

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
