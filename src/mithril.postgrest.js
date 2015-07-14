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

  postgrest.paginationVM = function(pageRequest, order){
    var collection = m.prop([]),
        defaultOrder = order || "id.desc",
        filters = m.prop({order: defaultOrder}),
        isLoading = m.prop(false),
        page = m.prop(1),
        total = m.prop();

    var fetch = function(){
      var d = m.deferred();
      var getTotal = function(xhr, xhrOptions) {
        var rangeHeader = xhr.getResponseHeader("Content-Range")
        if(_.isString(rangeHeader) && rangeHeader.split("/").length > 1){
          total(parseInt(rangeHeader.split("/")[1]));
        }
        return xhr.responseText;
      };
      isLoading(true);
      m.redraw();
      m.startComputation();
      pageRequest(page(), filters(), {extract: getTotal}).then(function(data){
        collection(_.union(collection(), data));
        isLoading(false);
        d.resolve(collection());
        m.endComputation();
      });
      return d.promise;
    };

    var filter = function(parameters){
      filters(_.extend({order: defaultOrder}, parameters));
      collection([]);
      page(1);
      return fetch();
    };

    var nextPage = function(){
      page(page()+1);
      return fetch();
    };

    return {
      collection: collection,
      filter: filter,
      isLoading: isLoading,
      nextPage: nextPage,
      total: total
    };
  };

  postgrest.filtersVM = function(attributes){
    var getters = _.reduce(
      attributes, 
      function(memo, operator, attr){ 
        if(operator === "between"){
          memo[attr] = {lte: m.prop(''), gte: m.prop('')}; 
        }
        else{
          memo[attr] = m.prop(''); 
        }
        return memo;
      }, 
      {order: m.prop()}
    );

    var parameters = function(){
      var order = function(){
        return getters.order() && _.reduce(
          getters.order(), 
          function(memo, direction, attr){ 
            memo.push(attr + '.' + direction);
            return memo;
          }, 
          []
        ).join(",");
      };

      return _.reduce(
        getters, 
        function(memo, getter, attr){ 
          if(order()){
            memo["order"] = order(); 
          }
          if(attr !== "order"){
            var operator = attributes[attr];

            if(_.isFunction(getter) && !getter()){ return memo; }

            if(operator === "ilike" || operator === "like"){
              memo[attr] = operator + '.*' + getter() + '*';
            }
            else if(operator === "@@"){
              memo[attr] = operator + '.' + getter().trim().replace(/\s+/g, '&');
            }
            else if(operator === "between"){
              if(!getter['lte']() && !getter['gte']()){ return memo; }
              memo[attr] = [];
              if(getter['gte']()){
                memo[attr].push('gte.' + getter['gte']());
              }
              if(getter['lte']()){
                memo[attr].push('lte.' + getter['lte']());
              }
            }
            else{
              memo[attr] = operator + '.' + getter(); 
            }
          }
          return memo;
        }, 
        {}
      );
    };

    return _.extend({}, getters, {parameters: parameters});
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
        return function(page, data, options){
          return requestFunction(_.extend({method: "GET", url: "/" + name, data: data, config: generateXhrConfig(page)}, options));
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
