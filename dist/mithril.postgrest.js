(function(factory) {
  if (typeof exports === 'object') {
    // Node/CommonJS
    factory(require('mithril'), require('underscore'), require('node-localstorage'));
  } else {
    // Browser globals
    factory(window.m, window._, window.localStorage);
  }
}(function(m, _, localStorage) {
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

  postgrest.loader = function(options, requestFunction, defaultState){
    var defaultState = defaultState || false;
    var loader = m.prop(defaultState), d = m.deferred();
    loader.load = function(){
      loader(true);
      m.redraw();
      m.startComputation();
      requestFunction(_.extend({}, options, {background: true})).then(function(data){
        loader(false);
        d.resolve(data);
        m.endComputation();
      }, function(error){
        loader(false);
        d.reject(error);
        m.endComputation();
      });
      return d.promise;
    };
    return loader;
  };

  postgrest.loaderWithToken = function(options, defaultState){
    return postgrest.loader(options, postgrest.requestWithToken, defaultState);
  };

  postgrest.init = function(apiPrefix, authenticationOptions){
    postgrest.onAuthFailure = m.prop(function(){});

    postgrest.request = function(options){
      return m.request(_.extend({}, options, {url: apiPrefix + options.url}));
    };

    postgrest.authenticate = function(){
      var deferred = m.deferred();
      if (token()){
        deferred.resolve({token: token()});
      }
      else {
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

      postOptions = function(attributes, options){
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

      patchOptions = function(filters, attributes, options){
        return querystring(
          filters,
          _.extend(
            {},
            options,
            nameOptions,
            {method: 'PATCH', data: attributes, config: mergeConfig(addRepresentationHeader, options)})
        );
      },

      getPageOptions = function(data, page, options){
        return getOptions(data, (page || 1), pageSize(), options);
      },

      getRowOptions = function(data, options){
        return getOptions(data, 1, 1, options);
      };

      return {
        pageSize: pageSize,
        getPageOptions:   getPageOptions,
        getRowOptions:    getRowOptions,
        patchOptions:     patchOptions,
        postOptions:      postOptions,
        deleteOptions:    deleteOptions,
        getPage:          _.compose(postgrest.request, getPageOptions),
        getRow:           _.compose(postgrest.request, getRowOptions),
        patch:            _.compose(postgrest.request, patchOptions),
        post:             _.compose(postgrest.request, postOptions),
        deleteRequest:    _.compose(postgrest.request, deleteOptions),
        getPageWithToken: _.compose(postgrest.requestWithToken, getPageOptions),
        getRowWithToken:  _.compose(postgrest.requestWithToken, getRowOptions),
        patchWithToken:   _.compose(postgrest.requestWithToken, patchOptions),
        postWithToken:    _.compose(postgrest.requestWithToken, postOptions),
        deleteWithToken:  _.compose(postgrest.requestWithToken, deleteOptions),
        options: options
      };
    };

    return postgrest;
  };

  m.postgrest = postgrest;
}));

(function(factory) {
  if (typeof exports === 'object') {
    // Node/CommonJS
    factory(require('mithril'), require('underscore'));
  }
  else {
    // Browser globals
    factory(window.m, window._);
  }
}(function(m, _) {
  m.postgrest.filtersVM = function(attributes){
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
        if (operator === 'between'){
          memo[attr] = {lte: filter(), gte: filter()};
        }
        else {
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
          if (attr !== 'order'){
            var operator = attributes[attr];

            if (_.isFunction(getter.toFilter) && !getter.toFilter()){ return memo; }

            // Bellow we use different formatting rules for the value depending on the operator
            // These rules are used regardless of the toFilter function,
            // so the user can use a custom toFilter without having to worry with basic filter syntax
            if (operator === 'ilike' || operator === 'like'){
              memo[attr] = operator + '.*' + getter.toFilter() + '*';
            }
            else if (operator === '@@') {
              memo[attr] = operator + '.' + getter.toFilter().replace(/\s+/g, '&');
            }
            else if (operator === 'between') {
              if (!getter.lte.toFilter() && !getter.gte.toFilter()){ return memo; }
              memo[attr] = [];
              if (getter.gte()){
                memo[attr].push('gte.' + getter.gte.toFilter());
              }
              if (getter.lte()){
                memo[attr].push('lte.' + getter.lte.toFilter());
              }
            }
            else {
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
}));

(function(factory) {
  if (typeof exports === 'object') {
    // Node/CommonJS
    factory(require('mithril'), require('underscore'));
  } else {
    // Browser globals
    factory(window.m, window._);
  }
}(function(m, _) {
  m.postgrest.paginationVM = function(pageRequest, order){
    var collection = m.prop([]),
      defaultOrder = order || 'id.desc',
      filters = m.prop({order: defaultOrder}),
      isLoading = m.prop(false),
      page = m.prop(1),
      total = m.prop(),

      fetch = function(){
      var d = m.deferred(),
        getTotal = function(xhr) {
        if (!xhr || xhr.status === 0){
          return JSON.stringify({hint: null, details: null, code: 0, message: 'Connection error'});
        }
        var rangeHeader = xhr.getResponseHeader('Content-Range');
        if (_.isString(rangeHeader) && rangeHeader.split('/').length > 1){
          total(parseInt(rangeHeader.split('/')[1]));
        }
        try {
          JSON.parse(xhr.responseText);
          return xhr.responseText;
        }
        catch (ex){
          return JSON.stringify({hint: null, details: null, code: 0, message: xhr.responseText});
        }
      };
      isLoading(true);
      pageRequest(filters(), page(), {background: true, extract: getTotal}).then(function(data){
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
      page(page() + 1);
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

}));

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1pdGhyaWwucG9zdGdyZXN0LmpzIiwidm1zL2ZpbHRlcnNWTS5qcyIsInZtcy9wYWdpbmF0aW9uVk0uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzVLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2hHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJtaXRocmlsLnBvc3RncmVzdC5qcyIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbihmYWN0b3J5KSB7XG4gIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcpIHtcbiAgICAvLyBOb2RlL0NvbW1vbkpTXG4gICAgZmFjdG9yeShyZXF1aXJlKCdtaXRocmlsJyksIHJlcXVpcmUoJ3VuZGVyc2NvcmUnKSwgcmVxdWlyZSgnbm9kZS1sb2NhbHN0b3JhZ2UnKSk7XG4gIH0gZWxzZSB7XG4gICAgLy8gQnJvd3NlciBnbG9iYWxzXG4gICAgZmFjdG9yeSh3aW5kb3cubSwgd2luZG93Ll8sIHdpbmRvdy5sb2NhbFN0b3JhZ2UpO1xuICB9XG59KGZ1bmN0aW9uKG0sIF8sIGxvY2FsU3RvcmFnZSkge1xuICB2YXIgcG9zdGdyZXN0ID0ge30sXG5cbiAgICB0b2tlbiA9IGZ1bmN0aW9uKHRva2VuKXtcbiAgICByZXR1cm4gdG9rZW4gPyBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgncG9zdGdyZXN0LnRva2VuJywgdG9rZW4pIDogbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ3Bvc3RncmVzdC50b2tlbicpO1xuICB9LFxuXG4gIG1lcmdlQ29uZmlnID0gZnVuY3Rpb24oY29uZmlnLCBvcHRpb25zKXtcbiAgICByZXR1cm4gb3B0aW9ucyAmJiBfLmlzRnVuY3Rpb24ob3B0aW9ucy5jb25maWcpID8gXy5jb21wb3NlKG9wdGlvbnMuY29uZmlnLCBjb25maWcpIDogY29uZmlnO1xuICB9LFxuXG4gIGFkZEhlYWRlcnMgPSBmdW5jdGlvbihoZWFkZXJzKXtcbiAgICByZXR1cm4gZnVuY3Rpb24oeGhyKXtcbiAgICAgIF8uZWFjaChoZWFkZXJzLCBmdW5jdGlvbih2YWx1ZSwga2V5KXtcbiAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoa2V5LCB2YWx1ZSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiB4aHI7XG4gICAgfTtcbiAgfSxcblxuICBhZGRSZXByZXNlbnRhdGlvbkhlYWRlciA9IGFkZEhlYWRlcnMoeydQcmVmZXInOiAncmV0dXJuPXJlcHJlc2VudGF0aW9uJ30pO1xuXG4gIHBvc3RncmVzdC5yZXNldCA9IGZ1bmN0aW9uKCl7XG4gICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oJ3Bvc3RncmVzdC50b2tlbicpO1xuICB9O1xuXG4gIHBvc3RncmVzdC5sb2FkZXIgPSBmdW5jdGlvbihvcHRpb25zLCByZXF1ZXN0RnVuY3Rpb24sIGRlZmF1bHRTdGF0ZSl7XG4gICAgdmFyIGRlZmF1bHRTdGF0ZSA9IGRlZmF1bHRTdGF0ZSB8fCBmYWxzZTtcbiAgICB2YXIgbG9hZGVyID0gbS5wcm9wKGRlZmF1bHRTdGF0ZSksIGQgPSBtLmRlZmVycmVkKCk7XG4gICAgbG9hZGVyLmxvYWQgPSBmdW5jdGlvbigpe1xuICAgICAgbG9hZGVyKHRydWUpO1xuICAgICAgbS5yZWRyYXcoKTtcbiAgICAgIG0uc3RhcnRDb21wdXRhdGlvbigpO1xuICAgICAgcmVxdWVzdEZ1bmN0aW9uKF8uZXh0ZW5kKHt9LCBvcHRpb25zLCB7YmFja2dyb3VuZDogdHJ1ZX0pKS50aGVuKGZ1bmN0aW9uKGRhdGEpe1xuICAgICAgICBsb2FkZXIoZmFsc2UpO1xuICAgICAgICBkLnJlc29sdmUoZGF0YSk7XG4gICAgICAgIG0uZW5kQ29tcHV0YXRpb24oKTtcbiAgICAgIH0sIGZ1bmN0aW9uKGVycm9yKXtcbiAgICAgICAgbG9hZGVyKGZhbHNlKTtcbiAgICAgICAgZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICBtLmVuZENvbXB1dGF0aW9uKCk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBkLnByb21pc2U7XG4gICAgfTtcbiAgICByZXR1cm4gbG9hZGVyO1xuICB9O1xuXG4gIHBvc3RncmVzdC5sb2FkZXJXaXRoVG9rZW4gPSBmdW5jdGlvbihvcHRpb25zLCBkZWZhdWx0U3RhdGUpe1xuICAgIHJldHVybiBwb3N0Z3Jlc3QubG9hZGVyKG9wdGlvbnMsIHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBkZWZhdWx0U3RhdGUpO1xuICB9O1xuXG4gIHBvc3RncmVzdC5pbml0ID0gZnVuY3Rpb24oYXBpUHJlZml4LCBhdXRoZW50aWNhdGlvbk9wdGlvbnMpe1xuICAgIHBvc3RncmVzdC5vbkF1dGhGYWlsdXJlID0gbS5wcm9wKGZ1bmN0aW9uKCl7fSk7XG5cbiAgICBwb3N0Z3Jlc3QucmVxdWVzdCA9IGZ1bmN0aW9uKG9wdGlvbnMpe1xuICAgICAgcmV0dXJuIG0ucmVxdWVzdChfLmV4dGVuZCh7fSwgb3B0aW9ucywge3VybDogYXBpUHJlZml4ICsgb3B0aW9ucy51cmx9KSk7XG4gICAgfTtcblxuICAgIHBvc3RncmVzdC5hdXRoZW50aWNhdGUgPSBmdW5jdGlvbigpe1xuICAgICAgdmFyIGRlZmVycmVkID0gbS5kZWZlcnJlZCgpO1xuICAgICAgaWYgKHRva2VuKCkpe1xuICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHt0b2tlbjogdG9rZW4oKX0pO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHJldHVybiBtLnJlcXVlc3QoYXV0aGVudGljYXRpb25PcHRpb25zKS50aGVuKGZ1bmN0aW9uKGRhdGEpe1xuICAgICAgICAgIHRva2VuKGRhdGEudG9rZW4pO1xuICAgICAgICB9LCBwb3N0Z3Jlc3Qub25BdXRoRmFpbHVyZSgpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH07XG5cbiAgICBwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiA9IGZ1bmN0aW9uKG9wdGlvbnMpe1xuICAgICAgdmFyIGFkZEF1dGhvcml6YXRpb25IZWFkZXIgPSBhZGRIZWFkZXJzKHsnQXV0aG9yaXphdGlvbic6ICdCZWFyZXIgJyArIHRva2VuKCl9KTtcbiAgICAgIHJldHVybiBtLnBvc3RncmVzdC5hdXRoZW50aWNhdGUoKS50aGVuKGZ1bmN0aW9uKCl7XG4gICAgICAgIHJldHVybiBtLnBvc3RncmVzdC5yZXF1ZXN0KF8uZXh0ZW5kKHt9LCBvcHRpb25zLCB7Y29uZmlnOiBtZXJnZUNvbmZpZyhhZGRBdXRob3JpemF0aW9uSGVhZGVyLCBvcHRpb25zKX0pKTtcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICBwb3N0Z3Jlc3QubW9kZWwgPSBmdW5jdGlvbihuYW1lKXtcbiAgICAgIHZhciBhZGRQYWdpbmF0aW9uSGVhZGVycyA9IGZ1bmN0aW9uKHBhZ2UsIHBhZ2VTaXplKXtcbiAgICAgICAgdmFyIHRvUmFuZ2UgPSBmdW5jdGlvbigpe1xuICAgICAgICAgIHZhciBmcm9tID0gKHBhZ2UgLSAxKSAqIHBhZ2VTaXplLFxuICAgICAgICAgICAgdG8gPSBmcm9tICsgcGFnZVNpemUgLSAxO1xuICAgICAgICAgIHJldHVybiBmcm9tICsgJy0nICsgdG87XG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIGFkZEhlYWRlcnMoeydSYW5nZS11bml0JzogJ2l0ZW1zJywgJ1JhbmdlJzogdG9SYW5nZSgpfSk7XG4gICAgICB9LFxuXG4gICAgICBwYWdlU2l6ZSA9IG0ucHJvcCgxMCksXG5cbiAgICAgICAgbmFtZU9wdGlvbnMgPSB7dXJsOiAnLycgKyBuYW1lfSxcblxuICAgICAgICBnZXRPcHRpb25zID0gZnVuY3Rpb24oZGF0YSwgcGFnZSwgcGFnZVNpemUsIG9wdGlvbnMpe1xuICAgICAgICByZXR1cm4gXy5leHRlbmQoe30sIG9wdGlvbnMsIG5hbWVPcHRpb25zLCB7bWV0aG9kOiAnR0VUJywgZGF0YTogZGF0YSwgY29uZmlnOiBtZXJnZUNvbmZpZyhhZGRQYWdpbmF0aW9uSGVhZGVycyhwYWdlLCBwYWdlU2l6ZSksIG9wdGlvbnMpfSk7XG4gICAgICB9LFxuXG4gICAgICBxdWVyeXN0cmluZyA9IGZ1bmN0aW9uKGZpbHRlcnMsIG9wdGlvbnMpe1xuICAgICAgICBvcHRpb25zLnVybCArPSAnPycgKyBtLnJvdXRlLmJ1aWxkUXVlcnlTdHJpbmcoZmlsdGVycyk7XG4gICAgICAgIHJldHVybiBvcHRpb25zO1xuICAgICAgfSxcblxuICAgICAgb3B0aW9ucyA9IGZ1bmN0aW9uKG9wdGlvbnMpe1xuICAgICAgICByZXR1cm4gbS5wb3N0Z3Jlc3QucmVxdWVzdChfLmV4dGVuZCh7fSwgb3B0aW9ucywgbmFtZU9wdGlvbnMsIHttZXRob2Q6ICdPUFRJT05TJ30pKTtcbiAgICAgIH0sXG5cbiAgICAgIHBvc3RPcHRpb25zID0gZnVuY3Rpb24oYXR0cmlidXRlcywgb3B0aW9ucyl7XG4gICAgICAgIHJldHVybiBfLmV4dGVuZChcbiAgICAgICAgICB7fSxcbiAgICAgICAgICBvcHRpb25zLFxuICAgICAgICAgIG5hbWVPcHRpb25zLFxuICAgICAgICAgIHttZXRob2Q6ICdQT1NUJywgZGF0YTogYXR0cmlidXRlcywgY29uZmlnOiBtZXJnZUNvbmZpZyhhZGRSZXByZXNlbnRhdGlvbkhlYWRlciwgb3B0aW9ucyl9XG4gICAgICAgICk7XG4gICAgICB9LFxuXG4gICAgICBkZWxldGVPcHRpb25zID0gZnVuY3Rpb24oZmlsdGVycywgb3B0aW9ucyl7XG4gICAgICAgIHJldHVybiBxdWVyeXN0cmluZyhmaWx0ZXJzLCBfLmV4dGVuZCh7fSwgb3B0aW9ucywgbmFtZU9wdGlvbnMsIHttZXRob2Q6ICdERUxFVEUnfSkpO1xuICAgICAgfSxcblxuICAgICAgcGF0Y2hPcHRpb25zID0gZnVuY3Rpb24oZmlsdGVycywgYXR0cmlidXRlcywgb3B0aW9ucyl7XG4gICAgICAgIHJldHVybiBxdWVyeXN0cmluZyhcbiAgICAgICAgICBmaWx0ZXJzLFxuICAgICAgICAgIF8uZXh0ZW5kKFxuICAgICAgICAgICAge30sXG4gICAgICAgICAgICBvcHRpb25zLFxuICAgICAgICAgICAgbmFtZU9wdGlvbnMsXG4gICAgICAgICAgICB7bWV0aG9kOiAnUEFUQ0gnLCBkYXRhOiBhdHRyaWJ1dGVzLCBjb25maWc6IG1lcmdlQ29uZmlnKGFkZFJlcHJlc2VudGF0aW9uSGVhZGVyLCBvcHRpb25zKX0pXG4gICAgICAgICk7XG4gICAgICB9LFxuXG4gICAgICBnZXRQYWdlT3B0aW9ucyA9IGZ1bmN0aW9uKGRhdGEsIHBhZ2UsIG9wdGlvbnMpe1xuICAgICAgICByZXR1cm4gZ2V0T3B0aW9ucyhkYXRhLCAocGFnZSB8fCAxKSwgcGFnZVNpemUoKSwgb3B0aW9ucyk7XG4gICAgICB9LFxuXG4gICAgICBnZXRSb3dPcHRpb25zID0gZnVuY3Rpb24oZGF0YSwgb3B0aW9ucyl7XG4gICAgICAgIHJldHVybiBnZXRPcHRpb25zKGRhdGEsIDEsIDEsIG9wdGlvbnMpO1xuICAgICAgfTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcGFnZVNpemU6IHBhZ2VTaXplLFxuICAgICAgICBnZXRQYWdlT3B0aW9uczogICBnZXRQYWdlT3B0aW9ucyxcbiAgICAgICAgZ2V0Um93T3B0aW9uczogICAgZ2V0Um93T3B0aW9ucyxcbiAgICAgICAgcGF0Y2hPcHRpb25zOiAgICAgcGF0Y2hPcHRpb25zLFxuICAgICAgICBwb3N0T3B0aW9uczogICAgICBwb3N0T3B0aW9ucyxcbiAgICAgICAgZGVsZXRlT3B0aW9uczogICAgZGVsZXRlT3B0aW9ucyxcbiAgICAgICAgZ2V0UGFnZTogICAgICAgICAgXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0LCBnZXRQYWdlT3B0aW9ucyksXG4gICAgICAgIGdldFJvdzogICAgICAgICAgIF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgZ2V0Um93T3B0aW9ucyksXG4gICAgICAgIHBhdGNoOiAgICAgICAgICAgIF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgcGF0Y2hPcHRpb25zKSxcbiAgICAgICAgcG9zdDogICAgICAgICAgICAgXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0LCBwb3N0T3B0aW9ucyksXG4gICAgICAgIGRlbGV0ZVJlcXVlc3Q6ICAgIF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgZGVsZXRlT3B0aW9ucyksXG4gICAgICAgIGdldFBhZ2VXaXRoVG9rZW46IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgZ2V0UGFnZU9wdGlvbnMpLFxuICAgICAgICBnZXRSb3dXaXRoVG9rZW46ICBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIGdldFJvd09wdGlvbnMpLFxuICAgICAgICBwYXRjaFdpdGhUb2tlbjogICBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIHBhdGNoT3B0aW9ucyksXG4gICAgICAgIHBvc3RXaXRoVG9rZW46ICAgIF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgcG9zdE9wdGlvbnMpLFxuICAgICAgICBkZWxldGVXaXRoVG9rZW46ICBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIGRlbGV0ZU9wdGlvbnMpLFxuICAgICAgICBvcHRpb25zOiBvcHRpb25zXG4gICAgICB9O1xuICAgIH07XG5cbiAgICByZXR1cm4gcG9zdGdyZXN0O1xuICB9O1xuXG4gIG0ucG9zdGdyZXN0ID0gcG9zdGdyZXN0O1xufSkpO1xuIiwiKGZ1bmN0aW9uKGZhY3RvcnkpIHtcbiAgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xuICAgIC8vIE5vZGUvQ29tbW9uSlNcbiAgICBmYWN0b3J5KHJlcXVpcmUoJ21pdGhyaWwnKSwgcmVxdWlyZSgndW5kZXJzY29yZScpKTtcbiAgfVxuICBlbHNlIHtcbiAgICAvLyBCcm93c2VyIGdsb2JhbHNcbiAgICBmYWN0b3J5KHdpbmRvdy5tLCB3aW5kb3cuXyk7XG4gIH1cbn0oZnVuY3Rpb24obSwgXykge1xuICBtLnBvc3RncmVzdC5maWx0ZXJzVk0gPSBmdW5jdGlvbihhdHRyaWJ1dGVzKXtcbiAgICB2YXIgZmlsdGVyID0gZnVuY3Rpb24oKXtcbiAgICAgIHZhciBwcm9wID0gbS5wcm9wKCcnKTtcbiAgICAgIC8vIEp1c3Qgc28gd2UgY2FuIGhhdmUgYSBkZWZhdWx0IHRvX2ZpbHRlciBhbmQgYXZvaWQgaWYgXy5pc0Z1bmN0aW9uIGNhbGxzXG4gICAgICBwcm9wLnRvRmlsdGVyID0gZnVuY3Rpb24oKXsgcmV0dXJuIChwcm9wKCkgfHwgJycpLnRvU3RyaW5nKCkudHJpbSgpOyB9O1xuICAgICAgcmV0dXJuIHByb3A7XG4gICAgfSxcblxuICAgIGdldHRlcnMgPSBfLnJlZHVjZShcbiAgICAgIGF0dHJpYnV0ZXMsXG4gICAgICBmdW5jdGlvbihtZW1vLCBvcGVyYXRvciwgYXR0cil7XG4gICAgICAgIC8vIFRoZSBvcGVyYXRvciBiZXR3ZWVuIGlzIGltcGxlbWVudGVkIHdpdGggdHdvIHByb3BlcnRpZXMsIG9uZSBmb3IgZ3JlYXRlciB0aGFuIHZhbHVlIGFuZCBhbm90aGVyIGZvciBsZXNzZXIgdGhhbiB2YWx1ZS5cbiAgICAgICAgLy8gQm90aCBwcm9wZXJ0aWVzIGFyZSBzZW50IGluIHRoZSBxdWV1cnlzdHJpbmcgd2l0aCB0aGUgc2FtZSBuYW1lLFxuICAgICAgICAvLyB0aGF0J3Mgd2h5IHdlIG5lZWQgdGhlIHNwZWNpYWwgY2FzZSBoZXJlLCBzbyB3ZSBjYW4gdXNlIGEgc2ltcGxlIG1hcCBhcyBhcmd1bWVudCB0byBmaWx0ZXJzVk0uXG4gICAgICAgIGlmIChvcGVyYXRvciA9PT0gJ2JldHdlZW4nKXtcbiAgICAgICAgICBtZW1vW2F0dHJdID0ge2x0ZTogZmlsdGVyKCksIGd0ZTogZmlsdGVyKCl9O1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIG1lbW9bYXR0cl0gPSBmaWx0ZXIoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgIH0sXG4gICAgICB7b3JkZXI6IG0ucHJvcCgpfVxuICAgICksXG5cbiAgICBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyID0gZnVuY3Rpb24oKXtcbiAgICAgIHJldHVybiBfLnJlZHVjZShcbiAgICAgICAgZ2V0dGVycyxcbiAgICAgICAgZnVuY3Rpb24obWVtbywgZ2V0dGVyLCBhdHRyKXtcbiAgICAgICAgICBpZiAoYXR0ciAhPT0gJ29yZGVyJyl7XG4gICAgICAgICAgICB2YXIgb3BlcmF0b3IgPSBhdHRyaWJ1dGVzW2F0dHJdO1xuXG4gICAgICAgICAgICBpZiAoXy5pc0Z1bmN0aW9uKGdldHRlci50b0ZpbHRlcikgJiYgIWdldHRlci50b0ZpbHRlcigpKXsgcmV0dXJuIG1lbW87IH1cblxuICAgICAgICAgICAgLy8gQmVsbG93IHdlIHVzZSBkaWZmZXJlbnQgZm9ybWF0dGluZyBydWxlcyBmb3IgdGhlIHZhbHVlIGRlcGVuZGluZyBvbiB0aGUgb3BlcmF0b3JcbiAgICAgICAgICAgIC8vIFRoZXNlIHJ1bGVzIGFyZSB1c2VkIHJlZ2FyZGxlc3Mgb2YgdGhlIHRvRmlsdGVyIGZ1bmN0aW9uLFxuICAgICAgICAgICAgLy8gc28gdGhlIHVzZXIgY2FuIHVzZSBhIGN1c3RvbSB0b0ZpbHRlciB3aXRob3V0IGhhdmluZyB0byB3b3JyeSB3aXRoIGJhc2ljIGZpbHRlciBzeW50YXhcbiAgICAgICAgICAgIGlmIChvcGVyYXRvciA9PT0gJ2lsaWtlJyB8fCBvcGVyYXRvciA9PT0gJ2xpa2UnKXtcbiAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IG9wZXJhdG9yICsgJy4qJyArIGdldHRlci50b0ZpbHRlcigpICsgJyonO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAob3BlcmF0b3IgPT09ICdAQCcpIHtcbiAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IG9wZXJhdG9yICsgJy4nICsgZ2V0dGVyLnRvRmlsdGVyKCkucmVwbGFjZSgvXFxzKy9nLCAnJicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAob3BlcmF0b3IgPT09ICdiZXR3ZWVuJykge1xuICAgICAgICAgICAgICBpZiAoIWdldHRlci5sdGUudG9GaWx0ZXIoKSAmJiAhZ2V0dGVyLmd0ZS50b0ZpbHRlcigpKXsgcmV0dXJuIG1lbW87IH1cbiAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IFtdO1xuICAgICAgICAgICAgICBpZiAoZ2V0dGVyLmd0ZSgpKXtcbiAgICAgICAgICAgICAgICBtZW1vW2F0dHJdLnB1c2goJ2d0ZS4nICsgZ2V0dGVyLmd0ZS50b0ZpbHRlcigpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoZ2V0dGVyLmx0ZSgpKXtcbiAgICAgICAgICAgICAgICBtZW1vW2F0dHJdLnB1c2goJ2x0ZS4nICsgZ2V0dGVyLmx0ZS50b0ZpbHRlcigpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIG1lbW9bYXR0cl0gPSBvcGVyYXRvciArICcuJyArIGdldHRlci50b0ZpbHRlcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgfSxcbiAgICAgICAge31cbiAgICAgICk7XG4gICAgfSxcblxuICAgIHBhcmFtZXRlcnMgPSBmdW5jdGlvbigpe1xuICAgICAgLy8gVGhlIG9yZGVyIHBhcmFtZXRlcnMgaGF2ZSBhIHNwZWNpYWwgc3ludGF4IChqdXN0IGxpa2UgYW4gb3JkZXIgYnkgU1FMIGNsYXVzZSlcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9iZWdyaWZmcy9wb3N0Z3Jlc3Qvd2lraS9Sb3V0aW5nI2ZpbHRlcmluZy1hbmQtb3JkZXJpbmdcbiAgICAgIHZhciBvcmRlciA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIHJldHVybiBnZXR0ZXJzLm9yZGVyKCkgJiYgXy5yZWR1Y2UoXG4gICAgICAgICAgZ2V0dGVycy5vcmRlcigpLFxuICAgICAgICAgIGZ1bmN0aW9uKG1lbW8sIGRpcmVjdGlvbiwgYXR0cil7XG4gICAgICAgICAgICBtZW1vLnB1c2goYXR0ciArICcuJyArIGRpcmVjdGlvbik7XG4gICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgICB9LFxuICAgICAgICAgIFtdXG4gICAgICAgICkuam9pbignLCcpO1xuICAgICAgfSxcblxuICAgICAgb3JkZXJQYXJhbWV0ZXIgPSBvcmRlcigpID8ge29yZGVyOiBvcmRlcigpfSA6IHt9O1xuXG4gICAgICByZXR1cm4gXy5leHRlbmQoe30sIG9yZGVyUGFyYW1ldGVyLCBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyKCkpO1xuXG4gICAgfTtcblxuICAgIHJldHVybiBfLmV4dGVuZCh7fSwgZ2V0dGVycywge3BhcmFtZXRlcnM6IHBhcmFtZXRlcnMsIHBhcmFtZXRlcnNXaXRob3V0T3JkZXI6IHBhcmFtZXRlcnNXaXRob3V0T3JkZXJ9KTtcbiAgfTtcbn0pKTtcbiIsIihmdW5jdGlvbihmYWN0b3J5KSB7XG4gIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcpIHtcbiAgICAvLyBOb2RlL0NvbW1vbkpTXG4gICAgZmFjdG9yeShyZXF1aXJlKCdtaXRocmlsJyksIHJlcXVpcmUoJ3VuZGVyc2NvcmUnKSk7XG4gIH0gZWxzZSB7XG4gICAgLy8gQnJvd3NlciBnbG9iYWxzXG4gICAgZmFjdG9yeSh3aW5kb3cubSwgd2luZG93Ll8pO1xuICB9XG59KGZ1bmN0aW9uKG0sIF8pIHtcbiAgbS5wb3N0Z3Jlc3QucGFnaW5hdGlvblZNID0gZnVuY3Rpb24ocGFnZVJlcXVlc3QsIG9yZGVyKXtcbiAgICB2YXIgY29sbGVjdGlvbiA9IG0ucHJvcChbXSksXG4gICAgICBkZWZhdWx0T3JkZXIgPSBvcmRlciB8fCAnaWQuZGVzYycsXG4gICAgICBmaWx0ZXJzID0gbS5wcm9wKHtvcmRlcjogZGVmYXVsdE9yZGVyfSksXG4gICAgICBpc0xvYWRpbmcgPSBtLnByb3AoZmFsc2UpLFxuICAgICAgcGFnZSA9IG0ucHJvcCgxKSxcbiAgICAgIHRvdGFsID0gbS5wcm9wKCksXG5cbiAgICAgIGZldGNoID0gZnVuY3Rpb24oKXtcbiAgICAgIHZhciBkID0gbS5kZWZlcnJlZCgpLFxuICAgICAgICBnZXRUb3RhbCA9IGZ1bmN0aW9uKHhocikge1xuICAgICAgICBpZiAoIXhociB8fCB4aHIuc3RhdHVzID09PSAwKXtcbiAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe2hpbnQ6IG51bGwsIGRldGFpbHM6IG51bGwsIGNvZGU6IDAsIG1lc3NhZ2U6ICdDb25uZWN0aW9uIGVycm9yJ30pO1xuICAgICAgICB9XG4gICAgICAgIHZhciByYW5nZUhlYWRlciA9IHhoci5nZXRSZXNwb25zZUhlYWRlcignQ29udGVudC1SYW5nZScpO1xuICAgICAgICBpZiAoXy5pc1N0cmluZyhyYW5nZUhlYWRlcikgJiYgcmFuZ2VIZWFkZXIuc3BsaXQoJy8nKS5sZW5ndGggPiAxKXtcbiAgICAgICAgICB0b3RhbChwYXJzZUludChyYW5nZUhlYWRlci5zcGxpdCgnLycpWzFdKSk7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBKU09OLnBhcnNlKHhoci5yZXNwb25zZVRleHQpO1xuICAgICAgICAgIHJldHVybiB4aHIucmVzcG9uc2VUZXh0O1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChleCl7XG4gICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtoaW50OiBudWxsLCBkZXRhaWxzOiBudWxsLCBjb2RlOiAwLCBtZXNzYWdlOiB4aHIucmVzcG9uc2VUZXh0fSk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBpc0xvYWRpbmcodHJ1ZSk7XG4gICAgICBwYWdlUmVxdWVzdChmaWx0ZXJzKCksIHBhZ2UoKSwge2JhY2tncm91bmQ6IHRydWUsIGV4dHJhY3Q6IGdldFRvdGFsfSkudGhlbihmdW5jdGlvbihkYXRhKXtcbiAgICAgICAgY29sbGVjdGlvbihfLnVuaW9uKGNvbGxlY3Rpb24oKSwgZGF0YSkpO1xuICAgICAgICBpc0xvYWRpbmcoZmFsc2UpO1xuICAgICAgICBkLnJlc29sdmUoY29sbGVjdGlvbigpKTtcbiAgICAgICAgbS5yZWRyYXcoKTtcbiAgICAgIH0sIGZ1bmN0aW9uKGVycm9yKXtcbiAgICAgICAgaXNMb2FkaW5nKGZhbHNlKTtcbiAgICAgICAgdG90YWwoMCk7XG4gICAgICAgIGQucmVqZWN0KGVycm9yKTtcbiAgICAgICAgbS5yZWRyYXcoKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGQucHJvbWlzZTtcbiAgICB9LFxuXG4gICAgZmlyc3RQYWdlID0gZnVuY3Rpb24ocGFyYW1ldGVycyl7XG4gICAgICBmaWx0ZXJzKF8uZXh0ZW5kKHtvcmRlcjogZGVmYXVsdE9yZGVyfSwgcGFyYW1ldGVycykpO1xuICAgICAgY29sbGVjdGlvbihbXSk7XG4gICAgICBwYWdlKDEpO1xuICAgICAgcmV0dXJuIGZldGNoKCk7XG4gICAgfSxcblxuICAgIG5leHRQYWdlID0gZnVuY3Rpb24oKXtcbiAgICAgIHBhZ2UocGFnZSgpICsgMSk7XG4gICAgICByZXR1cm4gZmV0Y2goKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbGxlY3Rpb246IGNvbGxlY3Rpb24sXG4gICAgICBmaXJzdFBhZ2U6IGZpcnN0UGFnZSxcbiAgICAgIGlzTG9hZGluZzogaXNMb2FkaW5nLFxuICAgICAgbmV4dFBhZ2U6IG5leHRQYWdlLFxuICAgICAgdG90YWw6IHRvdGFsXG4gICAgfTtcbiAgfTtcblxufSkpO1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9