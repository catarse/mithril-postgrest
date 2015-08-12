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
