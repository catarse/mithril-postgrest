(function (factory) {
    if (typeof exports === 'object') {
        // Node/CommonJS
        factory(require('mithril'), require('underscore'), require('node-localstorage'));
    } else {
        // Browser globals
        factory(window.m, window._, window.localStorage);
    }
}(function (m, _, localStorage) {
  var postgrest = {},

  token = function(token){
    return token ? localStorage.setItem('postgrest.token', token) : localStorage.getItem('postgrest.token');
  },

  xhrConfig = function(xhr){
    xhr.setRequestHeader('Authorization', 'Bearer ' + token());
    return xhr;
  };

  postgrest.reset = function(){
    localStorage.removeItem('postgrest.token');
  };

  postgrest.paginationVM = function(pageRequest, order){
    var collection = m.prop([]),
        defaultOrder = order || 'id.desc',
        filters = m.prop({order: defaultOrder}),
        isLoading = m.prop(false),
        page = m.prop(1),
        total = m.prop(),

    fetch = function(){
      var d = m.deferred(),
          getTotal = function(xhr) {
        if(!xhr || xhr.status === 0){
          return JSON.stringify({hint: null, details: null, code: 0, message: 'Connection error'});
        }
        var rangeHeader = xhr.getResponseHeader('Content-Range');
        if(_.isString(rangeHeader) && rangeHeader.split('/').length > 1){
          total(parseInt(rangeHeader.split('/')[1]));
        }
        try{
          JSON.parse(xhr.responseText);
          return xhr.responseText;
        }
        catch(ex){
          return JSON.stringify({hint: null, details: null, code: 0, message: xhr.responseText});
        }
      };
      isLoading(true);
      pageRequest(page(), filters(), {background: true, extract: getTotal}).then(function(data){
        collection(_.union(collection(), data));
        isLoading(false);
        d.resolve(collection());
        m.redraw();
      }, function(error){
        isLoading(false);
        total(0);
        d.reject(error);
        m.redraw();
      });
      return d.promise;
    },

    firstPage = function(parameters){
      filters(_.extend({order: defaultOrder}, parameters));
      collection([]);
      page(1);
      return fetch();
    },

    nextPage = function(){
      page(page()+1);
      return fetch();
    };

    return {
      collection: collection,
      firstPage: firstPage,
      isLoading: isLoading,
      nextPage: nextPage,
      total: total
    };
  };

  postgrest.filtersVM = function(attributes){
    var filter = function(){
      var prop = m.prop('');
      // Just so we can have a default to_filter and avoid if _.isFunction calls
      prop.toFilter = function(){ return (prop() || '').toString().trim(); };
      return prop;
    },

    getters = _.reduce(
      attributes,
      function(memo, operator, attr){
        // The operator between is implemented with two properties, one for greater than value and another for lesser than value.
        // Both properties are sent in the queurystring with the same name,
        // that's why we need the special case here, so we can use a simple map as argument to filtersVM.
        if(operator === 'between'){
          memo[attr] = {lte: filter(), gte: filter()};
        }
        else{
          memo[attr] = filter();
        }
        return memo;
      },
      {order: m.prop()}
    ),

    parametersWithoutOrder = function(){
      return _.reduce(
        getters,
        function(memo, getter, attr){
          if(attr !== 'order'){
            var operator = attributes[attr];

            if(_.isFunction(getter) && !getter()){ return memo; }

            // Bellow we use different formatting rules for the value depending on the operator
            // These rules are used regardless of the toFilter function,
            // so the user can use a custom toFilter without having to worry with basic filter syntax
            if(operator === 'ilike' || operator === 'like'){
              memo[attr] = operator + '.*' + getter.toFilter() + '*';
            }
            else if(operator === '@@'){
              memo[attr] = operator + '.' + getter.toFilter().replace(/\s+/g, '&');
            }
            else if(operator === 'between'){
              if(!getter.lte.toFilter() && !getter.gte.toFilter()){ return memo; }
              memo[attr] = [];
              if(getter.gte()){
                memo[attr].push('gte.' + getter.gte.toFilter());
              }
              if(getter.lte()){
                memo[attr].push('lte.' + getter.lte.toFilter());
              }
            }
            else{
              memo[attr] = operator + '.' + getter.toFilter();
            }
          }
          return memo;
        },
        {}
      );
    },

    parameters = function(){
      // The order parameters have a special syntax (just like an order by SQL clause)
      // https://github.com/begriffs/postgrest/wiki/Routing#filtering-and-ordering
      var order = function(){
        return getters.order() && _.reduce(
          getters.order(),
          function(memo, direction, attr){
            memo.push(attr + '.' + direction);
            return memo;
          },
          []
        ).join(',');
      },

      orderParameter = order() ? {order: order()} : {};

      return _.extend({}, orderParameter, parametersWithoutOrder());

    };

    return _.extend({}, getters, {parameters: parameters, parametersWithoutOrder: parametersWithoutOrder});
  };

  postgrest.init = function(apiPrefix, authenticationOptions){
    postgrest.onAuthFailure = m.prop(function(){});

    postgrest.request = function(options){
      return m.request(_.extend({}, options, {url: apiPrefix + options.url}));
    };

    postgrest.model = function(name){
      var generateXhrConfig = function(page, pageSize){
        var toRange = function(){
          var from = (page - 1) * pageSize,
              to = from + pageSize - 1;
          return from + '-' + to;
        };

        return function(xhr){
          xhr.setRequestHeader('Range-unit', 'items');
          xhr.setRequestHeader('Range', toRange());
        };
      },

      pageSize = m.prop(10),

      nameOptions = {url: '/' + name},

      getOptions = function(data, page, pageSize, options){
        return _.extend({}, options, nameOptions, {method: 'GET', data: data, config: generateXhrConfig(page, pageSize)});
      },

      querystring = function(filters, options){
        options.url += '?' + m.route.buildQueryString(filters);
        return options;
      },

      options = function(options){
        return m.postgrest.request(_.extend({}, options, nameOptions, {method: 'OPTIONS'}));
      },

      generatePost = function(requestFunction){
        return function(attributes, options){
          return requestFunction(_.extend({}, options, nameOptions, {method: 'POST', data: attributes}));
        };
      },

      generateDelete = function(requestFunction){
        return function(filters, options){
          return requestFunction(querystring(filters, _.extend({}, options, nameOptions, {method: 'DELETE'})));
        };
      },

      generatePatch = function(requestFunction){
        return function(filters, attributes, options){
          return requestFunction(querystring(filters, _.extend({}, options, nameOptions, {method: 'PATCH', data: attributes})));
        };
      },

      generateGetPage = function(requestFunction){
        return function(page, data, options){
          return requestFunction(getOptions(data, page, pageSize(), options));
        };
      },

      generateGetRow = function(requestFunction) {
        return function(data, options){
          return requestFunction(getOptions(data, 1, 1, options));
        };
      };

      return {
        pageSize: pageSize,
        getPageWithToken: generateGetPage(m.postgrest.requestWithToken),
        getPage: generateGetPage(m.postgrest.request),
        getRowWithToken: generateGetRow(m.postgrest.requestWithToken),
        getRow: generateGetRow(m.postgrest.request),
        patchWithToken: generatePatch(m.postgrest.requestWithToken),
        patch: generatePatch(m.postgrest.request),
        deleteWithToken: generateDelete(m.postgrest.requestWithToken),
        delete: generateDelete(m.postgrest.request),
        postWithToken: generatePost(m.postgrest.requestWithToken),
        post: generatePost(m.postgrest.request),
        options: options
      };
    };

    postgrest.requestWithToken = function(options){
      return m.postgrest.authenticate().then(function(){
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
        return m.request(authenticationOptions).then(function(data){
          token(data.token);
        }, postgrest.onAuthFailure());
      }
      return deferred.promise;
    };
    return postgrest;
  };

  m.postgrest = postgrest;
}));
