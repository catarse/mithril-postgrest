(function(factory) {
  if (typeof exports === 'object') {
    // Node/CommonJS
    factory(require('mithril'), require('underscore'));
  } else {
    // Browser globals
    factory(window.m, window._);
  }
}(function(m, _) {
  var postgrest = {},

  token = m.prop(),

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

  postgrest.token = token;

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
    postgrest.request = function(options){
      return m.request(_.extend({}, options, {url: apiPrefix + options.url}));
    };

    postgrest.authenticate = function(){
      var deferred = m.deferred();
      if (token()){
        deferred.resolve({token: token()});
      }
      else {
        m.request(authenticationOptions).then(function(data){
          token(data.token);
          deferred.resolve({token: token()});
        }, function(data){ deferred.reject(data); });
      }
      return deferred.promise;
    };

    postgrest.requestWithToken = function(options){
      var addAuthorizationHeader = function(){
        return mergeConfig(addHeaders({'Authorization': 'Bearer ' + token()}), options);
      };
      return m.postgrest.authenticate().then(
        function(){
          return m.postgrest.request(_.extend({}, options, {config: addAuthorizationHeader()}));
        },
        function(){
          return m.postgrest.request(_.extend({}, options));
        }
      );
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
    var newVM = {},
    filter = function(){
      var prop = m.prop(''),
      filterProp = function(value){
        if (arguments.length > 0){
          prop(value);
          return newVM;
        }
        return prop();
      };
      // Just so we can have a default to_filter and avoid if _.isFunction calls
      filterProp.toFilter = function(){
        return _.isString(filterProp()) ? filterProp().trim() : filterProp();
      };
      return filterProp;
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

            if (_.isFunction(getter.toFilter) && (getter.toFilter() === undefined || getter.toFilter() === '')){ return memo; }

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

    return _.extend(newVM, getters, {parameters: parameters, parametersWithoutOrder: parametersWithoutOrder});
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1pdGhyaWwucG9zdGdyZXN0LmpzIiwidm1zL2ZpbHRlcnNWTS5qcyIsInZtcy9wYWdpbmF0aW9uVk0uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM5S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJtaXRocmlsLnBvc3RncmVzdC5qcyIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbihmYWN0b3J5KSB7XG4gIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcpIHtcbiAgICAvLyBOb2RlL0NvbW1vbkpTXG4gICAgZmFjdG9yeShyZXF1aXJlKCdtaXRocmlsJyksIHJlcXVpcmUoJ3VuZGVyc2NvcmUnKSk7XG4gIH0gZWxzZSB7XG4gICAgLy8gQnJvd3NlciBnbG9iYWxzXG4gICAgZmFjdG9yeSh3aW5kb3cubSwgd2luZG93Ll8pO1xuICB9XG59KGZ1bmN0aW9uKG0sIF8pIHtcbiAgdmFyIHBvc3RncmVzdCA9IHt9LFxuXG4gIHRva2VuID0gbS5wcm9wKCksXG5cbiAgbWVyZ2VDb25maWcgPSBmdW5jdGlvbihjb25maWcsIG9wdGlvbnMpe1xuICAgIHJldHVybiBvcHRpb25zICYmIF8uaXNGdW5jdGlvbihvcHRpb25zLmNvbmZpZykgPyBfLmNvbXBvc2Uob3B0aW9ucy5jb25maWcsIGNvbmZpZykgOiBjb25maWc7XG4gIH0sXG5cbiAgYWRkSGVhZGVycyA9IGZ1bmN0aW9uKGhlYWRlcnMpe1xuICAgIHJldHVybiBmdW5jdGlvbih4aHIpe1xuICAgICAgXy5lYWNoKGhlYWRlcnMsIGZ1bmN0aW9uKHZhbHVlLCBrZXkpe1xuICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihrZXksIHZhbHVlKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHhocjtcbiAgICB9O1xuICB9LFxuXG4gIGFkZFJlcHJlc2VudGF0aW9uSGVhZGVyID0gYWRkSGVhZGVycyh7J1ByZWZlcic6ICdyZXR1cm49cmVwcmVzZW50YXRpb24nfSk7XG5cbiAgcG9zdGdyZXN0LnRva2VuID0gdG9rZW47XG5cbiAgcG9zdGdyZXN0LmxvYWRlciA9IGZ1bmN0aW9uKG9wdGlvbnMsIHJlcXVlc3RGdW5jdGlvbiwgZGVmYXVsdFN0YXRlKXtcbiAgICB2YXIgZGVmYXVsdFN0YXRlID0gZGVmYXVsdFN0YXRlIHx8IGZhbHNlO1xuICAgIHZhciBsb2FkZXIgPSBtLnByb3AoZGVmYXVsdFN0YXRlKSwgZCA9IG0uZGVmZXJyZWQoKTtcbiAgICBsb2FkZXIubG9hZCA9IGZ1bmN0aW9uKCl7XG4gICAgICBsb2FkZXIodHJ1ZSk7XG4gICAgICBtLnJlZHJhdygpO1xuICAgICAgbS5zdGFydENvbXB1dGF0aW9uKCk7XG4gICAgICByZXF1ZXN0RnVuY3Rpb24oXy5leHRlbmQoe30sIG9wdGlvbnMsIHtiYWNrZ3JvdW5kOiB0cnVlfSkpLnRoZW4oZnVuY3Rpb24oZGF0YSl7XG4gICAgICAgIGxvYWRlcihmYWxzZSk7XG4gICAgICAgIGQucmVzb2x2ZShkYXRhKTtcbiAgICAgICAgbS5lbmRDb21wdXRhdGlvbigpO1xuICAgICAgfSwgZnVuY3Rpb24oZXJyb3Ipe1xuICAgICAgICBsb2FkZXIoZmFsc2UpO1xuICAgICAgICBkLnJlamVjdChlcnJvcik7XG4gICAgICAgIG0uZW5kQ29tcHV0YXRpb24oKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGQucHJvbWlzZTtcbiAgICB9O1xuICAgIHJldHVybiBsb2FkZXI7XG4gIH07XG5cbiAgcG9zdGdyZXN0LmxvYWRlcldpdGhUb2tlbiA9IGZ1bmN0aW9uKG9wdGlvbnMsIGRlZmF1bHRTdGF0ZSl7XG4gICAgcmV0dXJuIHBvc3RncmVzdC5sb2FkZXIob3B0aW9ucywgcG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIGRlZmF1bHRTdGF0ZSk7XG4gIH07XG5cbiAgcG9zdGdyZXN0LmluaXQgPSBmdW5jdGlvbihhcGlQcmVmaXgsIGF1dGhlbnRpY2F0aW9uT3B0aW9ucyl7XG4gICAgcG9zdGdyZXN0LnJlcXVlc3QgPSBmdW5jdGlvbihvcHRpb25zKXtcbiAgICAgIHJldHVybiBtLnJlcXVlc3QoXy5leHRlbmQoe30sIG9wdGlvbnMsIHt1cmw6IGFwaVByZWZpeCArIG9wdGlvbnMudXJsfSkpO1xuICAgIH07XG5cbiAgICBwb3N0Z3Jlc3QuYXV0aGVudGljYXRlID0gZnVuY3Rpb24oKXtcbiAgICAgIHZhciBkZWZlcnJlZCA9IG0uZGVmZXJyZWQoKTtcbiAgICAgIGlmICh0b2tlbigpKXtcbiAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSh7dG9rZW46IHRva2VuKCl9KTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBtLnJlcXVlc3QoYXV0aGVudGljYXRpb25PcHRpb25zKS50aGVuKGZ1bmN0aW9uKGRhdGEpe1xuICAgICAgICAgIHRva2VuKGRhdGEudG9rZW4pO1xuICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoe3Rva2VuOiB0b2tlbigpfSk7XG4gICAgICAgIH0sIGZ1bmN0aW9uKGRhdGEpeyBkZWZlcnJlZC5yZWplY3QoZGF0YSk7IH0pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfTtcblxuICAgIHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuID0gZnVuY3Rpb24ob3B0aW9ucyl7XG4gICAgICB2YXIgYWRkQXV0aG9yaXphdGlvbkhlYWRlciA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIHJldHVybiBtZXJnZUNvbmZpZyhhZGRIZWFkZXJzKHsnQXV0aG9yaXphdGlvbic6ICdCZWFyZXIgJyArIHRva2VuKCl9KSwgb3B0aW9ucyk7XG4gICAgICB9O1xuICAgICAgcmV0dXJuIG0ucG9zdGdyZXN0LmF1dGhlbnRpY2F0ZSgpLnRoZW4oXG4gICAgICAgIGZ1bmN0aW9uKCl7XG4gICAgICAgICAgcmV0dXJuIG0ucG9zdGdyZXN0LnJlcXVlc3QoXy5leHRlbmQoe30sIG9wdGlvbnMsIHtjb25maWc6IGFkZEF1dGhvcml6YXRpb25IZWFkZXIoKX0pKTtcbiAgICAgICAgfSxcbiAgICAgICAgZnVuY3Rpb24oKXtcbiAgICAgICAgICByZXR1cm4gbS5wb3N0Z3Jlc3QucmVxdWVzdChfLmV4dGVuZCh7fSwgb3B0aW9ucykpO1xuICAgICAgICB9XG4gICAgICApO1xuICAgIH07XG5cbiAgICBwb3N0Z3Jlc3QubW9kZWwgPSBmdW5jdGlvbihuYW1lKXtcbiAgICAgIHZhciBhZGRQYWdpbmF0aW9uSGVhZGVycyA9IGZ1bmN0aW9uKHBhZ2UsIHBhZ2VTaXplKXtcbiAgICAgICAgdmFyIHRvUmFuZ2UgPSBmdW5jdGlvbigpe1xuICAgICAgICAgIHZhciBmcm9tID0gKHBhZ2UgLSAxKSAqIHBhZ2VTaXplLFxuICAgICAgICAgICAgdG8gPSBmcm9tICsgcGFnZVNpemUgLSAxO1xuICAgICAgICAgIHJldHVybiBmcm9tICsgJy0nICsgdG87XG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIGFkZEhlYWRlcnMoeydSYW5nZS11bml0JzogJ2l0ZW1zJywgJ1JhbmdlJzogdG9SYW5nZSgpfSk7XG4gICAgICB9LFxuXG4gICAgICBwYWdlU2l6ZSA9IG0ucHJvcCgxMCksXG5cbiAgICAgICAgbmFtZU9wdGlvbnMgPSB7dXJsOiAnLycgKyBuYW1lfSxcblxuICAgICAgICBnZXRPcHRpb25zID0gZnVuY3Rpb24oZGF0YSwgcGFnZSwgcGFnZVNpemUsIG9wdGlvbnMpe1xuICAgICAgICByZXR1cm4gXy5leHRlbmQoe30sIG9wdGlvbnMsIG5hbWVPcHRpb25zLCB7bWV0aG9kOiAnR0VUJywgZGF0YTogZGF0YSwgY29uZmlnOiBtZXJnZUNvbmZpZyhhZGRQYWdpbmF0aW9uSGVhZGVycyhwYWdlLCBwYWdlU2l6ZSksIG9wdGlvbnMpfSk7XG4gICAgICB9LFxuXG4gICAgICBxdWVyeXN0cmluZyA9IGZ1bmN0aW9uKGZpbHRlcnMsIG9wdGlvbnMpe1xuICAgICAgICBvcHRpb25zLnVybCArPSAnPycgKyBtLnJvdXRlLmJ1aWxkUXVlcnlTdHJpbmcoZmlsdGVycyk7XG4gICAgICAgIHJldHVybiBvcHRpb25zO1xuICAgICAgfSxcblxuICAgICAgb3B0aW9ucyA9IGZ1bmN0aW9uKG9wdGlvbnMpe1xuICAgICAgICByZXR1cm4gbS5wb3N0Z3Jlc3QucmVxdWVzdChfLmV4dGVuZCh7fSwgb3B0aW9ucywgbmFtZU9wdGlvbnMsIHttZXRob2Q6ICdPUFRJT05TJ30pKTtcbiAgICAgIH0sXG5cbiAgICAgIHBvc3RPcHRpb25zID0gZnVuY3Rpb24oYXR0cmlidXRlcywgb3B0aW9ucyl7XG4gICAgICAgIHJldHVybiBfLmV4dGVuZChcbiAgICAgICAgICB7fSxcbiAgICAgICAgICBvcHRpb25zLFxuICAgICAgICAgIG5hbWVPcHRpb25zLFxuICAgICAgICAgIHttZXRob2Q6ICdQT1NUJywgZGF0YTogYXR0cmlidXRlcywgY29uZmlnOiBtZXJnZUNvbmZpZyhhZGRSZXByZXNlbnRhdGlvbkhlYWRlciwgb3B0aW9ucyl9XG4gICAgICAgICk7XG4gICAgICB9LFxuXG4gICAgICBkZWxldGVPcHRpb25zID0gZnVuY3Rpb24oZmlsdGVycywgb3B0aW9ucyl7XG4gICAgICAgIHJldHVybiBxdWVyeXN0cmluZyhmaWx0ZXJzLCBfLmV4dGVuZCh7fSwgb3B0aW9ucywgbmFtZU9wdGlvbnMsIHttZXRob2Q6ICdERUxFVEUnfSkpO1xuICAgICAgfSxcblxuICAgICAgcGF0Y2hPcHRpb25zID0gZnVuY3Rpb24oZmlsdGVycywgYXR0cmlidXRlcywgb3B0aW9ucyl7XG4gICAgICAgIHJldHVybiBxdWVyeXN0cmluZyhcbiAgICAgICAgICBmaWx0ZXJzLFxuICAgICAgICAgIF8uZXh0ZW5kKFxuICAgICAgICAgICAge30sXG4gICAgICAgICAgICBvcHRpb25zLFxuICAgICAgICAgICAgbmFtZU9wdGlvbnMsXG4gICAgICAgICAgICB7bWV0aG9kOiAnUEFUQ0gnLCBkYXRhOiBhdHRyaWJ1dGVzLCBjb25maWc6IG1lcmdlQ29uZmlnKGFkZFJlcHJlc2VudGF0aW9uSGVhZGVyLCBvcHRpb25zKX0pXG4gICAgICAgICk7XG4gICAgICB9LFxuXG4gICAgICBnZXRQYWdlT3B0aW9ucyA9IGZ1bmN0aW9uKGRhdGEsIHBhZ2UsIG9wdGlvbnMpe1xuICAgICAgICByZXR1cm4gZ2V0T3B0aW9ucyhkYXRhLCAocGFnZSB8fCAxKSwgcGFnZVNpemUoKSwgb3B0aW9ucyk7XG4gICAgICB9LFxuXG4gICAgICBnZXRSb3dPcHRpb25zID0gZnVuY3Rpb24oZGF0YSwgb3B0aW9ucyl7XG4gICAgICAgIHJldHVybiBnZXRPcHRpb25zKGRhdGEsIDEsIDEsIG9wdGlvbnMpO1xuICAgICAgfTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcGFnZVNpemU6IHBhZ2VTaXplLFxuICAgICAgICBnZXRQYWdlT3B0aW9uczogICBnZXRQYWdlT3B0aW9ucyxcbiAgICAgICAgZ2V0Um93T3B0aW9uczogICAgZ2V0Um93T3B0aW9ucyxcbiAgICAgICAgcGF0Y2hPcHRpb25zOiAgICAgcGF0Y2hPcHRpb25zLFxuICAgICAgICBwb3N0T3B0aW9uczogICAgICBwb3N0T3B0aW9ucyxcbiAgICAgICAgZGVsZXRlT3B0aW9uczogICAgZGVsZXRlT3B0aW9ucyxcbiAgICAgICAgZ2V0UGFnZTogICAgICAgICAgXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0LCBnZXRQYWdlT3B0aW9ucyksXG4gICAgICAgIGdldFJvdzogICAgICAgICAgIF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgZ2V0Um93T3B0aW9ucyksXG4gICAgICAgIHBhdGNoOiAgICAgICAgICAgIF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgcGF0Y2hPcHRpb25zKSxcbiAgICAgICAgcG9zdDogICAgICAgICAgICAgXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0LCBwb3N0T3B0aW9ucyksXG4gICAgICAgIGRlbGV0ZVJlcXVlc3Q6ICAgIF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgZGVsZXRlT3B0aW9ucyksXG4gICAgICAgIGdldFBhZ2VXaXRoVG9rZW46IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgZ2V0UGFnZU9wdGlvbnMpLFxuICAgICAgICBnZXRSb3dXaXRoVG9rZW46ICBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIGdldFJvd09wdGlvbnMpLFxuICAgICAgICBwYXRjaFdpdGhUb2tlbjogICBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIHBhdGNoT3B0aW9ucyksXG4gICAgICAgIHBvc3RXaXRoVG9rZW46ICAgIF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgcG9zdE9wdGlvbnMpLFxuICAgICAgICBkZWxldGVXaXRoVG9rZW46ICBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIGRlbGV0ZU9wdGlvbnMpLFxuICAgICAgICBvcHRpb25zOiBvcHRpb25zXG4gICAgICB9O1xuICAgIH07XG5cbiAgICByZXR1cm4gcG9zdGdyZXN0O1xuICB9O1xuXG4gIG0ucG9zdGdyZXN0ID0gcG9zdGdyZXN0O1xufSkpO1xuIiwiKGZ1bmN0aW9uKGZhY3RvcnkpIHtcbiAgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xuICAgIC8vIE5vZGUvQ29tbW9uSlNcbiAgICBmYWN0b3J5KHJlcXVpcmUoJ21pdGhyaWwnKSwgcmVxdWlyZSgndW5kZXJzY29yZScpKTtcbiAgfVxuICBlbHNlIHtcbiAgICAvLyBCcm93c2VyIGdsb2JhbHNcbiAgICBmYWN0b3J5KHdpbmRvdy5tLCB3aW5kb3cuXyk7XG4gIH1cbn0oZnVuY3Rpb24obSwgXykge1xuICBtLnBvc3RncmVzdC5maWx0ZXJzVk0gPSBmdW5jdGlvbihhdHRyaWJ1dGVzKXtcbiAgICB2YXIgbmV3Vk0gPSB7fSxcbiAgICBmaWx0ZXIgPSBmdW5jdGlvbigpe1xuICAgICAgdmFyIHByb3AgPSBtLnByb3AoJycpLFxuICAgICAgZmlsdGVyUHJvcCA9IGZ1bmN0aW9uKHZhbHVlKXtcbiAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAwKXtcbiAgICAgICAgICBwcm9wKHZhbHVlKTtcbiAgICAgICAgICByZXR1cm4gbmV3Vk07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHByb3AoKTtcbiAgICAgIH07XG4gICAgICAvLyBKdXN0IHNvIHdlIGNhbiBoYXZlIGEgZGVmYXVsdCB0b19maWx0ZXIgYW5kIGF2b2lkIGlmIF8uaXNGdW5jdGlvbiBjYWxsc1xuICAgICAgZmlsdGVyUHJvcC50b0ZpbHRlciA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIHJldHVybiBfLmlzU3RyaW5nKGZpbHRlclByb3AoKSkgPyBmaWx0ZXJQcm9wKCkudHJpbSgpIDogZmlsdGVyUHJvcCgpO1xuICAgICAgfTtcbiAgICAgIHJldHVybiBmaWx0ZXJQcm9wO1xuICAgIH0sXG5cbiAgICBnZXR0ZXJzID0gXy5yZWR1Y2UoXG4gICAgICBhdHRyaWJ1dGVzLFxuICAgICAgZnVuY3Rpb24obWVtbywgb3BlcmF0b3IsIGF0dHIpe1xuICAgICAgICAvLyBUaGUgb3BlcmF0b3IgYmV0d2VlbiBpcyBpbXBsZW1lbnRlZCB3aXRoIHR3byBwcm9wZXJ0aWVzLCBvbmUgZm9yIGdyZWF0ZXIgdGhhbiB2YWx1ZSBhbmQgYW5vdGhlciBmb3IgbGVzc2VyIHRoYW4gdmFsdWUuXG4gICAgICAgIC8vIEJvdGggcHJvcGVydGllcyBhcmUgc2VudCBpbiB0aGUgcXVldXJ5c3RyaW5nIHdpdGggdGhlIHNhbWUgbmFtZSxcbiAgICAgICAgLy8gdGhhdCdzIHdoeSB3ZSBuZWVkIHRoZSBzcGVjaWFsIGNhc2UgaGVyZSwgc28gd2UgY2FuIHVzZSBhIHNpbXBsZSBtYXAgYXMgYXJndW1lbnQgdG8gZmlsdGVyc1ZNLlxuICAgICAgICBpZiAob3BlcmF0b3IgPT09ICdiZXR3ZWVuJyl7XG4gICAgICAgICAgbWVtb1thdHRyXSA9IHtsdGU6IGZpbHRlcigpLCBndGU6IGZpbHRlcigpfTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBtZW1vW2F0dHJdID0gZmlsdGVyKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICB9LFxuICAgICAge29yZGVyOiBtLnByb3AoKX1cbiAgICApLFxuXG4gICAgcGFyYW1ldGVyc1dpdGhvdXRPcmRlciA9IGZ1bmN0aW9uKCl7XG4gICAgICByZXR1cm4gXy5yZWR1Y2UoXG4gICAgICAgIGdldHRlcnMsXG4gICAgICAgIGZ1bmN0aW9uKG1lbW8sIGdldHRlciwgYXR0cil7XG4gICAgICAgICAgaWYgKGF0dHIgIT09ICdvcmRlcicpe1xuICAgICAgICAgICAgdmFyIG9wZXJhdG9yID0gYXR0cmlidXRlc1thdHRyXTtcblxuICAgICAgICAgICAgaWYgKF8uaXNGdW5jdGlvbihnZXR0ZXIudG9GaWx0ZXIpICYmIChnZXR0ZXIudG9GaWx0ZXIoKSA9PT0gdW5kZWZpbmVkIHx8IGdldHRlci50b0ZpbHRlcigpID09PSAnJykpeyByZXR1cm4gbWVtbzsgfVxuXG4gICAgICAgICAgICAvLyBCZWxsb3cgd2UgdXNlIGRpZmZlcmVudCBmb3JtYXR0aW5nIHJ1bGVzIGZvciB0aGUgdmFsdWUgZGVwZW5kaW5nIG9uIHRoZSBvcGVyYXRvclxuICAgICAgICAgICAgLy8gVGhlc2UgcnVsZXMgYXJlIHVzZWQgcmVnYXJkbGVzcyBvZiB0aGUgdG9GaWx0ZXIgZnVuY3Rpb24sXG4gICAgICAgICAgICAvLyBzbyB0aGUgdXNlciBjYW4gdXNlIGEgY3VzdG9tIHRvRmlsdGVyIHdpdGhvdXQgaGF2aW5nIHRvIHdvcnJ5IHdpdGggYmFzaWMgZmlsdGVyIHN5bnRheFxuICAgICAgICAgICAgaWYgKG9wZXJhdG9yID09PSAnaWxpa2UnIHx8IG9wZXJhdG9yID09PSAnbGlrZScpe1xuICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gb3BlcmF0b3IgKyAnLionICsgZ2V0dGVyLnRvRmlsdGVyKCkgKyAnKic7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChvcGVyYXRvciA9PT0gJ0BAJykge1xuICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gb3BlcmF0b3IgKyAnLicgKyBnZXR0ZXIudG9GaWx0ZXIoKS5yZXBsYWNlKC9cXHMrL2csICcmJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChvcGVyYXRvciA9PT0gJ2JldHdlZW4nKSB7XG4gICAgICAgICAgICAgIGlmICghZ2V0dGVyLmx0ZS50b0ZpbHRlcigpICYmICFnZXR0ZXIuZ3RlLnRvRmlsdGVyKCkpeyByZXR1cm4gbWVtbzsgfVxuICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gW107XG4gICAgICAgICAgICAgIGlmIChnZXR0ZXIuZ3RlKCkpe1xuICAgICAgICAgICAgICAgIG1lbW9bYXR0cl0ucHVzaCgnZ3RlLicgKyBnZXR0ZXIuZ3RlLnRvRmlsdGVyKCkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChnZXR0ZXIubHRlKCkpe1xuICAgICAgICAgICAgICAgIG1lbW9bYXR0cl0ucHVzaCgnbHRlLicgKyBnZXR0ZXIubHRlLnRvRmlsdGVyKCkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IG9wZXJhdG9yICsgJy4nICsgZ2V0dGVyLnRvRmlsdGVyKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICB9LFxuICAgICAgICB7fVxuICAgICAgKTtcbiAgICB9LFxuXG4gICAgcGFyYW1ldGVycyA9IGZ1bmN0aW9uKCl7XG4gICAgICAvLyBUaGUgb3JkZXIgcGFyYW1ldGVycyBoYXZlIGEgc3BlY2lhbCBzeW50YXggKGp1c3QgbGlrZSBhbiBvcmRlciBieSBTUUwgY2xhdXNlKVxuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2JlZ3JpZmZzL3Bvc3RncmVzdC93aWtpL1JvdXRpbmcjZmlsdGVyaW5nLWFuZC1vcmRlcmluZ1xuICAgICAgdmFyIG9yZGVyID0gZnVuY3Rpb24oKXtcbiAgICAgICAgcmV0dXJuIGdldHRlcnMub3JkZXIoKSAmJiBfLnJlZHVjZShcbiAgICAgICAgICBnZXR0ZXJzLm9yZGVyKCksXG4gICAgICAgICAgZnVuY3Rpb24obWVtbywgZGlyZWN0aW9uLCBhdHRyKXtcbiAgICAgICAgICAgIG1lbW8ucHVzaChhdHRyICsgJy4nICsgZGlyZWN0aW9uKTtcbiAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgW11cbiAgICAgICAgKS5qb2luKCcsJyk7XG4gICAgICB9LFxuXG4gICAgICBvcmRlclBhcmFtZXRlciA9IG9yZGVyKCkgPyB7b3JkZXI6IG9yZGVyKCl9IDoge307XG5cbiAgICAgIHJldHVybiBfLmV4dGVuZCh7fSwgb3JkZXJQYXJhbWV0ZXIsIHBhcmFtZXRlcnNXaXRob3V0T3JkZXIoKSk7XG5cbiAgICB9O1xuXG4gICAgcmV0dXJuIF8uZXh0ZW5kKG5ld1ZNLCBnZXR0ZXJzLCB7cGFyYW1ldGVyczogcGFyYW1ldGVycywgcGFyYW1ldGVyc1dpdGhvdXRPcmRlcjogcGFyYW1ldGVyc1dpdGhvdXRPcmRlcn0pO1xuICB9O1xufSkpO1xuIiwiKGZ1bmN0aW9uKGZhY3RvcnkpIHtcbiAgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xuICAgIC8vIE5vZGUvQ29tbW9uSlNcbiAgICBmYWN0b3J5KHJlcXVpcmUoJ21pdGhyaWwnKSwgcmVxdWlyZSgndW5kZXJzY29yZScpKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBCcm93c2VyIGdsb2JhbHNcbiAgICBmYWN0b3J5KHdpbmRvdy5tLCB3aW5kb3cuXyk7XG4gIH1cbn0oZnVuY3Rpb24obSwgXykge1xuICBtLnBvc3RncmVzdC5wYWdpbmF0aW9uVk0gPSBmdW5jdGlvbihwYWdlUmVxdWVzdCwgb3JkZXIpe1xuICAgIHZhciBjb2xsZWN0aW9uID0gbS5wcm9wKFtdKSxcbiAgICAgIGRlZmF1bHRPcmRlciA9IG9yZGVyIHx8ICdpZC5kZXNjJyxcbiAgICAgIGZpbHRlcnMgPSBtLnByb3Aoe29yZGVyOiBkZWZhdWx0T3JkZXJ9KSxcbiAgICAgIGlzTG9hZGluZyA9IG0ucHJvcChmYWxzZSksXG4gICAgICBwYWdlID0gbS5wcm9wKDEpLFxuICAgICAgdG90YWwgPSBtLnByb3AoKSxcblxuICAgICAgZmV0Y2ggPSBmdW5jdGlvbigpe1xuICAgICAgdmFyIGQgPSBtLmRlZmVycmVkKCksXG4gICAgICAgIGdldFRvdGFsID0gZnVuY3Rpb24oeGhyKSB7XG4gICAgICAgIGlmICgheGhyIHx8IHhoci5zdGF0dXMgPT09IDApe1xuICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7aGludDogbnVsbCwgZGV0YWlsczogbnVsbCwgY29kZTogMCwgbWVzc2FnZTogJ0Nvbm5lY3Rpb24gZXJyb3InfSk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHJhbmdlSGVhZGVyID0geGhyLmdldFJlc3BvbnNlSGVhZGVyKCdDb250ZW50LVJhbmdlJyk7XG4gICAgICAgIGlmIChfLmlzU3RyaW5nKHJhbmdlSGVhZGVyKSAmJiByYW5nZUhlYWRlci5zcGxpdCgnLycpLmxlbmd0aCA+IDEpe1xuICAgICAgICAgIHRvdGFsKHBhcnNlSW50KHJhbmdlSGVhZGVyLnNwbGl0KCcvJylbMV0pKTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgIEpTT04ucGFyc2UoeGhyLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgcmV0dXJuIHhoci5yZXNwb25zZVRleHQ7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGV4KXtcbiAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe2hpbnQ6IG51bGwsIGRldGFpbHM6IG51bGwsIGNvZGU6IDAsIG1lc3NhZ2U6IHhoci5yZXNwb25zZVRleHR9KTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIGlzTG9hZGluZyh0cnVlKTtcbiAgICAgIHBhZ2VSZXF1ZXN0KGZpbHRlcnMoKSwgcGFnZSgpLCB7YmFja2dyb3VuZDogdHJ1ZSwgZXh0cmFjdDogZ2V0VG90YWx9KS50aGVuKGZ1bmN0aW9uKGRhdGEpe1xuICAgICAgICBjb2xsZWN0aW9uKF8udW5pb24oY29sbGVjdGlvbigpLCBkYXRhKSk7XG4gICAgICAgIGlzTG9hZGluZyhmYWxzZSk7XG4gICAgICAgIGQucmVzb2x2ZShjb2xsZWN0aW9uKCkpO1xuICAgICAgICBtLnJlZHJhdygpO1xuICAgICAgfSwgZnVuY3Rpb24oZXJyb3Ipe1xuICAgICAgICBpc0xvYWRpbmcoZmFsc2UpO1xuICAgICAgICB0b3RhbCgwKTtcbiAgICAgICAgZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICBtLnJlZHJhdygpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gZC5wcm9taXNlO1xuICAgIH0sXG5cbiAgICBmaXJzdFBhZ2UgPSBmdW5jdGlvbihwYXJhbWV0ZXJzKXtcbiAgICAgIGZpbHRlcnMoXy5leHRlbmQoe29yZGVyOiBkZWZhdWx0T3JkZXJ9LCBwYXJhbWV0ZXJzKSk7XG4gICAgICBjb2xsZWN0aW9uKFtdKTtcbiAgICAgIHBhZ2UoMSk7XG4gICAgICByZXR1cm4gZmV0Y2goKTtcbiAgICB9LFxuXG4gICAgbmV4dFBhZ2UgPSBmdW5jdGlvbigpe1xuICAgICAgcGFnZShwYWdlKCkgKyAxKTtcbiAgICAgIHJldHVybiBmZXRjaCgpO1xuICAgIH07XG5cbiAgICByZXR1cm4ge1xuICAgICAgY29sbGVjdGlvbjogY29sbGVjdGlvbixcbiAgICAgIGZpcnN0UGFnZTogZmlyc3RQYWdlLFxuICAgICAgaXNMb2FkaW5nOiBpc0xvYWRpbmcsXG4gICAgICBuZXh0UGFnZTogbmV4dFBhZ2UsXG4gICAgICB0b3RhbDogdG90YWxcbiAgICB9O1xuICB9O1xuXG59KSk7XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=