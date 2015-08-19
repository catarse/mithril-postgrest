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

  mergeConfig = function(config, options){ 
    return options && _.isFunction(options.config) ? _.compose(options.config, config) : config;
  },

  addHeaders = function(headers){
    return function(xhr){
      _.each(headers, function(value, key){
        xhr.setRequestHeader(key, value);
      });
      return xhr;
    };
  },

  addRepresentationHeader = addHeaders({'Prefer': 'return=representation'});

  postgrest.reset = function(){
    localStorage.removeItem('postgrest.token');
  };

  postgrest.loader = function(defaultState, request){
    return m.prop(defaultState);
  };

  postgrest.init = function(apiPrefix, authenticationOptions){
    postgrest.onAuthFailure = m.prop(function(){});

    postgrest.request = function(options){
      return m.request(_.extend({}, options, {url: apiPrefix + options.url}));
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

    postgrest.requestWithToken = function(options){
      var addAuthorizationHeader = addHeaders({'Authorization': 'Bearer ' + token()});
      return m.postgrest.authenticate().then(function(){
        return m.postgrest.request(_.extend({}, options, {config: mergeConfig(addAuthorizationHeader, options)}));
      });
    };

    postgrest.model = function(name){
      var addPaginationHeaders = function(page, pageSize){
        var toRange = function(){
          var from = (page - 1) * pageSize,
              to = from + pageSize - 1;
          return from + '-' + to;
        };

        return addHeaders({'Range-unit': 'items', 'Range': toRange()});
      },

      pageSize = m.prop(10),

      nameOptions = {url: '/' + name},

      getOptions = function(data, page, pageSize, options){
        return _.extend({}, options, nameOptions, {method: 'GET', data: data, config: mergeConfig(addPaginationHeaders(page, pageSize), options)});
      },

      querystring = function(filters, options){
        options.url += '?' + m.route.buildQueryString(filters);
        return options;
      },

      options = function(options){
        return m.postgrest.request(_.extend({}, options, nameOptions, {method: 'OPTIONS'}));
      },

      post = function(attributes, options){
        return _.extend(
          {}, 
          options, 
          nameOptions, 
          {method: 'POST', data: attributes, config: mergeConfig(addRepresentationHeader, options)}
        );
      },

      deleteOptions = function(filters, options){
        return querystring(filters, _.extend({}, options, nameOptions, {method: 'DELETE'}));
      },

      patch = function(filters, attributes, options){
        return querystring(
          filters, 
          _.extend(
            {}, 
            options, 
            nameOptions, 
            {method: 'PATCH', data: attributes, config: mergeConfig(addRepresentationHeader, options)})
        );
      },

      getPage = function(page, data, options){
        return getOptions(data, page, pageSize(), options);
      },

      getRow = function(data, options){
        return getOptions(data, 1, 1, options);
      };

      return {
        pageSize: pageSize,
        getPage:          _.compose(postgrest.request, getPage),
        getRow:           _.compose(postgrest.request, getRow),
        patch:            _.compose(postgrest.request, patch),
        post:             _.compose(postgrest.request, post),
        deleteRequest:    _.compose(postgrest.request, deleteOptions),
        getPageWithToken: _.compose(postgrest.requestWithToken, getPage), 
        getRowWithToken:  _.compose(postgrest.requestWithToken, getRow),
        patchWithToken:   _.compose(postgrest.requestWithToken, patch),
        deleteWithToken:  _.compose(postgrest.requestWithToken, deleteOptions),
        postWithToken:    _.compose(postgrest.requestWithToken, post),
        options: options
      };
    };

    return postgrest;
  };

  m.postgrest = postgrest;
}));
