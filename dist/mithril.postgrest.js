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
      var addAuthorizationHeader = addHeaders({'Authorization': 'Bearer ' + token()}),
      requestWithDefaultOptions = function(aditionalOptions){
        return _.compose(m.postgrest.request, function(){ return _.extend({}, options, aditionalOptions); });
      };
      return m.postgrest.authenticate().then(
        requestWithDefaultOptions({config: mergeConfig(addAuthorizationHeader, options)}),
        requestWithDefaultOptions()
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
      filterProp.toFilter = function(){ return (filterProp() || '').toString().trim(); };
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1pdGhyaWwucG9zdGdyZXN0LmpzIiwidm1zL2ZpbHRlcnNWTS5qcyIsInZtcy9wYWdpbmF0aW9uVk0uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMzS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDeEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6Im1pdGhyaWwucG9zdGdyZXN0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKGZhY3RvcnkpIHtcbiAgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xuICAgIC8vIE5vZGUvQ29tbW9uSlNcbiAgICBmYWN0b3J5KHJlcXVpcmUoJ21pdGhyaWwnKSwgcmVxdWlyZSgndW5kZXJzY29yZScpKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBCcm93c2VyIGdsb2JhbHNcbiAgICBmYWN0b3J5KHdpbmRvdy5tLCB3aW5kb3cuXyk7XG4gIH1cbn0oZnVuY3Rpb24obSwgXykge1xuICB2YXIgcG9zdGdyZXN0ID0ge30sXG5cbiAgdG9rZW4gPSBtLnByb3AoKSxcblxuICBtZXJnZUNvbmZpZyA9IGZ1bmN0aW9uKGNvbmZpZywgb3B0aW9ucyl7XG4gICAgcmV0dXJuIG9wdGlvbnMgJiYgXy5pc0Z1bmN0aW9uKG9wdGlvbnMuY29uZmlnKSA/IF8uY29tcG9zZShvcHRpb25zLmNvbmZpZywgY29uZmlnKSA6IGNvbmZpZztcbiAgfSxcblxuICBhZGRIZWFkZXJzID0gZnVuY3Rpb24oaGVhZGVycyl7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKHhocil7XG4gICAgICBfLmVhY2goaGVhZGVycywgZnVuY3Rpb24odmFsdWUsIGtleSl7XG4gICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKGtleSwgdmFsdWUpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4geGhyO1xuICAgIH07XG4gIH0sXG5cbiAgYWRkUmVwcmVzZW50YXRpb25IZWFkZXIgPSBhZGRIZWFkZXJzKHsnUHJlZmVyJzogJ3JldHVybj1yZXByZXNlbnRhdGlvbid9KTtcblxuICBwb3N0Z3Jlc3QudG9rZW4gPSB0b2tlbjtcblxuICBwb3N0Z3Jlc3QubG9hZGVyID0gZnVuY3Rpb24ob3B0aW9ucywgcmVxdWVzdEZ1bmN0aW9uLCBkZWZhdWx0U3RhdGUpe1xuICAgIHZhciBkZWZhdWx0U3RhdGUgPSBkZWZhdWx0U3RhdGUgfHwgZmFsc2U7XG4gICAgdmFyIGxvYWRlciA9IG0ucHJvcChkZWZhdWx0U3RhdGUpLCBkID0gbS5kZWZlcnJlZCgpO1xuICAgIGxvYWRlci5sb2FkID0gZnVuY3Rpb24oKXtcbiAgICAgIGxvYWRlcih0cnVlKTtcbiAgICAgIG0ucmVkcmF3KCk7XG4gICAgICBtLnN0YXJ0Q29tcHV0YXRpb24oKTtcbiAgICAgIHJlcXVlc3RGdW5jdGlvbihfLmV4dGVuZCh7fSwgb3B0aW9ucywge2JhY2tncm91bmQ6IHRydWV9KSkudGhlbihmdW5jdGlvbihkYXRhKXtcbiAgICAgICAgbG9hZGVyKGZhbHNlKTtcbiAgICAgICAgZC5yZXNvbHZlKGRhdGEpO1xuICAgICAgICBtLmVuZENvbXB1dGF0aW9uKCk7XG4gICAgICB9LCBmdW5jdGlvbihlcnJvcil7XG4gICAgICAgIGxvYWRlcihmYWxzZSk7XG4gICAgICAgIGQucmVqZWN0KGVycm9yKTtcbiAgICAgICAgbS5lbmRDb21wdXRhdGlvbigpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gZC5wcm9taXNlO1xuICAgIH07XG4gICAgcmV0dXJuIGxvYWRlcjtcbiAgfTtcblxuICBwb3N0Z3Jlc3QubG9hZGVyV2l0aFRva2VuID0gZnVuY3Rpb24ob3B0aW9ucywgZGVmYXVsdFN0YXRlKXtcbiAgICByZXR1cm4gcG9zdGdyZXN0LmxvYWRlcihvcHRpb25zLCBwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgZGVmYXVsdFN0YXRlKTtcbiAgfTtcblxuICBwb3N0Z3Jlc3QuaW5pdCA9IGZ1bmN0aW9uKGFwaVByZWZpeCwgYXV0aGVudGljYXRpb25PcHRpb25zKXtcbiAgICBwb3N0Z3Jlc3QucmVxdWVzdCA9IGZ1bmN0aW9uKG9wdGlvbnMpe1xuICAgICAgcmV0dXJuIG0ucmVxdWVzdChfLmV4dGVuZCh7fSwgb3B0aW9ucywge3VybDogYXBpUHJlZml4ICsgb3B0aW9ucy51cmx9KSk7XG4gICAgfTtcblxuICAgIHBvc3RncmVzdC5hdXRoZW50aWNhdGUgPSBmdW5jdGlvbigpe1xuICAgICAgdmFyIGRlZmVycmVkID0gbS5kZWZlcnJlZCgpO1xuICAgICAgaWYgKHRva2VuKCkpe1xuICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHt0b2tlbjogdG9rZW4oKX0pO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIG0ucmVxdWVzdChhdXRoZW50aWNhdGlvbk9wdGlvbnMpLnRoZW4oZnVuY3Rpb24oZGF0YSl7XG4gICAgICAgICAgdG9rZW4oZGF0YS50b2tlbik7XG4gICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSh7dG9rZW46IHRva2VuKCl9KTtcbiAgICAgICAgfSwgZnVuY3Rpb24oZGF0YSl7IGRlZmVycmVkLnJlamVjdChkYXRhKTsgfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9O1xuXG4gICAgcG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4gPSBmdW5jdGlvbihvcHRpb25zKXtcbiAgICAgIHZhciBhZGRBdXRob3JpemF0aW9uSGVhZGVyID0gYWRkSGVhZGVycyh7J0F1dGhvcml6YXRpb24nOiAnQmVhcmVyICcgKyB0b2tlbigpfSksXG4gICAgICByZXF1ZXN0V2l0aERlZmF1bHRPcHRpb25zID0gZnVuY3Rpb24oYWRpdGlvbmFsT3B0aW9ucyl7XG4gICAgICAgIHJldHVybiBfLmNvbXBvc2UobS5wb3N0Z3Jlc3QucmVxdWVzdCwgZnVuY3Rpb24oKXsgcmV0dXJuIF8uZXh0ZW5kKHt9LCBvcHRpb25zLCBhZGl0aW9uYWxPcHRpb25zKTsgfSk7XG4gICAgICB9O1xuICAgICAgcmV0dXJuIG0ucG9zdGdyZXN0LmF1dGhlbnRpY2F0ZSgpLnRoZW4oXG4gICAgICAgIHJlcXVlc3RXaXRoRGVmYXVsdE9wdGlvbnMoe2NvbmZpZzogbWVyZ2VDb25maWcoYWRkQXV0aG9yaXphdGlvbkhlYWRlciwgb3B0aW9ucyl9KSxcbiAgICAgICAgcmVxdWVzdFdpdGhEZWZhdWx0T3B0aW9ucygpXG4gICAgICApO1xuICAgIH07XG5cbiAgICBwb3N0Z3Jlc3QubW9kZWwgPSBmdW5jdGlvbihuYW1lKXtcbiAgICAgIHZhciBhZGRQYWdpbmF0aW9uSGVhZGVycyA9IGZ1bmN0aW9uKHBhZ2UsIHBhZ2VTaXplKXtcbiAgICAgICAgdmFyIHRvUmFuZ2UgPSBmdW5jdGlvbigpe1xuICAgICAgICAgIHZhciBmcm9tID0gKHBhZ2UgLSAxKSAqIHBhZ2VTaXplLFxuICAgICAgICAgICAgdG8gPSBmcm9tICsgcGFnZVNpemUgLSAxO1xuICAgICAgICAgIHJldHVybiBmcm9tICsgJy0nICsgdG87XG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIGFkZEhlYWRlcnMoeydSYW5nZS11bml0JzogJ2l0ZW1zJywgJ1JhbmdlJzogdG9SYW5nZSgpfSk7XG4gICAgICB9LFxuXG4gICAgICBwYWdlU2l6ZSA9IG0ucHJvcCgxMCksXG5cbiAgICAgICAgbmFtZU9wdGlvbnMgPSB7dXJsOiAnLycgKyBuYW1lfSxcblxuICAgICAgICBnZXRPcHRpb25zID0gZnVuY3Rpb24oZGF0YSwgcGFnZSwgcGFnZVNpemUsIG9wdGlvbnMpe1xuICAgICAgICByZXR1cm4gXy5leHRlbmQoe30sIG9wdGlvbnMsIG5hbWVPcHRpb25zLCB7bWV0aG9kOiAnR0VUJywgZGF0YTogZGF0YSwgY29uZmlnOiBtZXJnZUNvbmZpZyhhZGRQYWdpbmF0aW9uSGVhZGVycyhwYWdlLCBwYWdlU2l6ZSksIG9wdGlvbnMpfSk7XG4gICAgICB9LFxuXG4gICAgICBxdWVyeXN0cmluZyA9IGZ1bmN0aW9uKGZpbHRlcnMsIG9wdGlvbnMpe1xuICAgICAgICBvcHRpb25zLnVybCArPSAnPycgKyBtLnJvdXRlLmJ1aWxkUXVlcnlTdHJpbmcoZmlsdGVycyk7XG4gICAgICAgIHJldHVybiBvcHRpb25zO1xuICAgICAgfSxcblxuICAgICAgb3B0aW9ucyA9IGZ1bmN0aW9uKG9wdGlvbnMpe1xuICAgICAgICByZXR1cm4gbS5wb3N0Z3Jlc3QucmVxdWVzdChfLmV4dGVuZCh7fSwgb3B0aW9ucywgbmFtZU9wdGlvbnMsIHttZXRob2Q6ICdPUFRJT05TJ30pKTtcbiAgICAgIH0sXG5cbiAgICAgIHBvc3RPcHRpb25zID0gZnVuY3Rpb24oYXR0cmlidXRlcywgb3B0aW9ucyl7XG4gICAgICAgIHJldHVybiBfLmV4dGVuZChcbiAgICAgICAgICB7fSxcbiAgICAgICAgICBvcHRpb25zLFxuICAgICAgICAgIG5hbWVPcHRpb25zLFxuICAgICAgICAgIHttZXRob2Q6ICdQT1NUJywgZGF0YTogYXR0cmlidXRlcywgY29uZmlnOiBtZXJnZUNvbmZpZyhhZGRSZXByZXNlbnRhdGlvbkhlYWRlciwgb3B0aW9ucyl9XG4gICAgICAgICk7XG4gICAgICB9LFxuXG4gICAgICBkZWxldGVPcHRpb25zID0gZnVuY3Rpb24oZmlsdGVycywgb3B0aW9ucyl7XG4gICAgICAgIHJldHVybiBxdWVyeXN0cmluZyhmaWx0ZXJzLCBfLmV4dGVuZCh7fSwgb3B0aW9ucywgbmFtZU9wdGlvbnMsIHttZXRob2Q6ICdERUxFVEUnfSkpO1xuICAgICAgfSxcblxuICAgICAgcGF0Y2hPcHRpb25zID0gZnVuY3Rpb24oZmlsdGVycywgYXR0cmlidXRlcywgb3B0aW9ucyl7XG4gICAgICAgIHJldHVybiBxdWVyeXN0cmluZyhcbiAgICAgICAgICBmaWx0ZXJzLFxuICAgICAgICAgIF8uZXh0ZW5kKFxuICAgICAgICAgICAge30sXG4gICAgICAgICAgICBvcHRpb25zLFxuICAgICAgICAgICAgbmFtZU9wdGlvbnMsXG4gICAgICAgICAgICB7bWV0aG9kOiAnUEFUQ0gnLCBkYXRhOiBhdHRyaWJ1dGVzLCBjb25maWc6IG1lcmdlQ29uZmlnKGFkZFJlcHJlc2VudGF0aW9uSGVhZGVyLCBvcHRpb25zKX0pXG4gICAgICAgICk7XG4gICAgICB9LFxuXG4gICAgICBnZXRQYWdlT3B0aW9ucyA9IGZ1bmN0aW9uKGRhdGEsIHBhZ2UsIG9wdGlvbnMpe1xuICAgICAgICByZXR1cm4gZ2V0T3B0aW9ucyhkYXRhLCAocGFnZSB8fCAxKSwgcGFnZVNpemUoKSwgb3B0aW9ucyk7XG4gICAgICB9LFxuXG4gICAgICBnZXRSb3dPcHRpb25zID0gZnVuY3Rpb24oZGF0YSwgb3B0aW9ucyl7XG4gICAgICAgIHJldHVybiBnZXRPcHRpb25zKGRhdGEsIDEsIDEsIG9wdGlvbnMpO1xuICAgICAgfTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcGFnZVNpemU6IHBhZ2VTaXplLFxuICAgICAgICBnZXRQYWdlT3B0aW9uczogICBnZXRQYWdlT3B0aW9ucyxcbiAgICAgICAgZ2V0Um93T3B0aW9uczogICAgZ2V0Um93T3B0aW9ucyxcbiAgICAgICAgcGF0Y2hPcHRpb25zOiAgICAgcGF0Y2hPcHRpb25zLFxuICAgICAgICBwb3N0T3B0aW9uczogICAgICBwb3N0T3B0aW9ucyxcbiAgICAgICAgZGVsZXRlT3B0aW9uczogICAgZGVsZXRlT3B0aW9ucyxcbiAgICAgICAgZ2V0UGFnZTogICAgICAgICAgXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0LCBnZXRQYWdlT3B0aW9ucyksXG4gICAgICAgIGdldFJvdzogICAgICAgICAgIF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgZ2V0Um93T3B0aW9ucyksXG4gICAgICAgIHBhdGNoOiAgICAgICAgICAgIF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgcGF0Y2hPcHRpb25zKSxcbiAgICAgICAgcG9zdDogICAgICAgICAgICAgXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0LCBwb3N0T3B0aW9ucyksXG4gICAgICAgIGRlbGV0ZVJlcXVlc3Q6ICAgIF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgZGVsZXRlT3B0aW9ucyksXG4gICAgICAgIGdldFBhZ2VXaXRoVG9rZW46IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgZ2V0UGFnZU9wdGlvbnMpLFxuICAgICAgICBnZXRSb3dXaXRoVG9rZW46ICBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIGdldFJvd09wdGlvbnMpLFxuICAgICAgICBwYXRjaFdpdGhUb2tlbjogICBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIHBhdGNoT3B0aW9ucyksXG4gICAgICAgIHBvc3RXaXRoVG9rZW46ICAgIF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgcG9zdE9wdGlvbnMpLFxuICAgICAgICBkZWxldGVXaXRoVG9rZW46ICBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIGRlbGV0ZU9wdGlvbnMpLFxuICAgICAgICBvcHRpb25zOiBvcHRpb25zXG4gICAgICB9O1xuICAgIH07XG5cbiAgICByZXR1cm4gcG9zdGdyZXN0O1xuICB9O1xuXG4gIG0ucG9zdGdyZXN0ID0gcG9zdGdyZXN0O1xufSkpO1xuIiwiKGZ1bmN0aW9uKGZhY3RvcnkpIHtcbiAgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xuICAgIC8vIE5vZGUvQ29tbW9uSlNcbiAgICBmYWN0b3J5KHJlcXVpcmUoJ21pdGhyaWwnKSwgcmVxdWlyZSgndW5kZXJzY29yZScpKTtcbiAgfVxuICBlbHNlIHtcbiAgICAvLyBCcm93c2VyIGdsb2JhbHNcbiAgICBmYWN0b3J5KHdpbmRvdy5tLCB3aW5kb3cuXyk7XG4gIH1cbn0oZnVuY3Rpb24obSwgXykge1xuICBtLnBvc3RncmVzdC5maWx0ZXJzVk0gPSBmdW5jdGlvbihhdHRyaWJ1dGVzKXtcbiAgICB2YXIgbmV3Vk0gPSB7fSxcbiAgICBmaWx0ZXIgPSBmdW5jdGlvbigpe1xuICAgICAgdmFyIHByb3AgPSBtLnByb3AoJycpLFxuICAgICAgZmlsdGVyUHJvcCA9IGZ1bmN0aW9uKHZhbHVlKXtcbiAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAwKXtcbiAgICAgICAgICBwcm9wKHZhbHVlKTtcbiAgICAgICAgICByZXR1cm4gbmV3Vk07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHByb3AoKTtcbiAgICAgIH07XG4gICAgICAvLyBKdXN0IHNvIHdlIGNhbiBoYXZlIGEgZGVmYXVsdCB0b19maWx0ZXIgYW5kIGF2b2lkIGlmIF8uaXNGdW5jdGlvbiBjYWxsc1xuICAgICAgZmlsdGVyUHJvcC50b0ZpbHRlciA9IGZ1bmN0aW9uKCl7IHJldHVybiAoZmlsdGVyUHJvcCgpIHx8ICcnKS50b1N0cmluZygpLnRyaW0oKTsgfTtcbiAgICAgIHJldHVybiBmaWx0ZXJQcm9wO1xuICAgIH0sXG5cbiAgICBnZXR0ZXJzID0gXy5yZWR1Y2UoXG4gICAgICBhdHRyaWJ1dGVzLFxuICAgICAgZnVuY3Rpb24obWVtbywgb3BlcmF0b3IsIGF0dHIpe1xuICAgICAgICAvLyBUaGUgb3BlcmF0b3IgYmV0d2VlbiBpcyBpbXBsZW1lbnRlZCB3aXRoIHR3byBwcm9wZXJ0aWVzLCBvbmUgZm9yIGdyZWF0ZXIgdGhhbiB2YWx1ZSBhbmQgYW5vdGhlciBmb3IgbGVzc2VyIHRoYW4gdmFsdWUuXG4gICAgICAgIC8vIEJvdGggcHJvcGVydGllcyBhcmUgc2VudCBpbiB0aGUgcXVldXJ5c3RyaW5nIHdpdGggdGhlIHNhbWUgbmFtZSxcbiAgICAgICAgLy8gdGhhdCdzIHdoeSB3ZSBuZWVkIHRoZSBzcGVjaWFsIGNhc2UgaGVyZSwgc28gd2UgY2FuIHVzZSBhIHNpbXBsZSBtYXAgYXMgYXJndW1lbnQgdG8gZmlsdGVyc1ZNLlxuICAgICAgICBpZiAob3BlcmF0b3IgPT09ICdiZXR3ZWVuJyl7XG4gICAgICAgICAgbWVtb1thdHRyXSA9IHtsdGU6IGZpbHRlcigpLCBndGU6IGZpbHRlcigpfTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBtZW1vW2F0dHJdID0gZmlsdGVyKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICB9LFxuICAgICAge29yZGVyOiBtLnByb3AoKX1cbiAgICApLFxuXG4gICAgcGFyYW1ldGVyc1dpdGhvdXRPcmRlciA9IGZ1bmN0aW9uKCl7XG4gICAgICByZXR1cm4gXy5yZWR1Y2UoXG4gICAgICAgIGdldHRlcnMsXG4gICAgICAgIGZ1bmN0aW9uKG1lbW8sIGdldHRlciwgYXR0cil7XG4gICAgICAgICAgaWYgKGF0dHIgIT09ICdvcmRlcicpe1xuICAgICAgICAgICAgdmFyIG9wZXJhdG9yID0gYXR0cmlidXRlc1thdHRyXTtcblxuICAgICAgICAgICAgaWYgKF8uaXNGdW5jdGlvbihnZXR0ZXIudG9GaWx0ZXIpICYmICFnZXR0ZXIudG9GaWx0ZXIoKSl7IHJldHVybiBtZW1vOyB9XG5cbiAgICAgICAgICAgIC8vIEJlbGxvdyB3ZSB1c2UgZGlmZmVyZW50IGZvcm1hdHRpbmcgcnVsZXMgZm9yIHRoZSB2YWx1ZSBkZXBlbmRpbmcgb24gdGhlIG9wZXJhdG9yXG4gICAgICAgICAgICAvLyBUaGVzZSBydWxlcyBhcmUgdXNlZCByZWdhcmRsZXNzIG9mIHRoZSB0b0ZpbHRlciBmdW5jdGlvbixcbiAgICAgICAgICAgIC8vIHNvIHRoZSB1c2VyIGNhbiB1c2UgYSBjdXN0b20gdG9GaWx0ZXIgd2l0aG91dCBoYXZpbmcgdG8gd29ycnkgd2l0aCBiYXNpYyBmaWx0ZXIgc3ludGF4XG4gICAgICAgICAgICBpZiAob3BlcmF0b3IgPT09ICdpbGlrZScgfHwgb3BlcmF0b3IgPT09ICdsaWtlJyl7XG4gICAgICAgICAgICAgIG1lbW9bYXR0cl0gPSBvcGVyYXRvciArICcuKicgKyBnZXR0ZXIudG9GaWx0ZXIoKSArICcqJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKG9wZXJhdG9yID09PSAnQEAnKSB7XG4gICAgICAgICAgICAgIG1lbW9bYXR0cl0gPSBvcGVyYXRvciArICcuJyArIGdldHRlci50b0ZpbHRlcigpLnJlcGxhY2UoL1xccysvZywgJyYnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKG9wZXJhdG9yID09PSAnYmV0d2VlbicpIHtcbiAgICAgICAgICAgICAgaWYgKCFnZXR0ZXIubHRlLnRvRmlsdGVyKCkgJiYgIWdldHRlci5ndGUudG9GaWx0ZXIoKSl7IHJldHVybiBtZW1vOyB9XG4gICAgICAgICAgICAgIG1lbW9bYXR0cl0gPSBbXTtcbiAgICAgICAgICAgICAgaWYgKGdldHRlci5ndGUoKSl7XG4gICAgICAgICAgICAgICAgbWVtb1thdHRyXS5wdXNoKCdndGUuJyArIGdldHRlci5ndGUudG9GaWx0ZXIoKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKGdldHRlci5sdGUoKSl7XG4gICAgICAgICAgICAgICAgbWVtb1thdHRyXS5wdXNoKCdsdGUuJyArIGdldHRlci5sdGUudG9GaWx0ZXIoKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gb3BlcmF0b3IgKyAnLicgKyBnZXR0ZXIudG9GaWx0ZXIoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgIH0sXG4gICAgICAgIHt9XG4gICAgICApO1xuICAgIH0sXG5cbiAgICBwYXJhbWV0ZXJzID0gZnVuY3Rpb24oKXtcbiAgICAgIC8vIFRoZSBvcmRlciBwYXJhbWV0ZXJzIGhhdmUgYSBzcGVjaWFsIHN5bnRheCAoanVzdCBsaWtlIGFuIG9yZGVyIGJ5IFNRTCBjbGF1c2UpXG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vYmVncmlmZnMvcG9zdGdyZXN0L3dpa2kvUm91dGluZyNmaWx0ZXJpbmctYW5kLW9yZGVyaW5nXG4gICAgICB2YXIgb3JkZXIgPSBmdW5jdGlvbigpe1xuICAgICAgICByZXR1cm4gZ2V0dGVycy5vcmRlcigpICYmIF8ucmVkdWNlKFxuICAgICAgICAgIGdldHRlcnMub3JkZXIoKSxcbiAgICAgICAgICBmdW5jdGlvbihtZW1vLCBkaXJlY3Rpb24sIGF0dHIpe1xuICAgICAgICAgICAgbWVtby5wdXNoKGF0dHIgKyAnLicgKyBkaXJlY3Rpb24pO1xuICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgICAgfSxcbiAgICAgICAgICBbXVxuICAgICAgICApLmpvaW4oJywnKTtcbiAgICAgIH0sXG5cbiAgICAgIG9yZGVyUGFyYW1ldGVyID0gb3JkZXIoKSA/IHtvcmRlcjogb3JkZXIoKX0gOiB7fTtcblxuICAgICAgcmV0dXJuIF8uZXh0ZW5kKHt9LCBvcmRlclBhcmFtZXRlciwgcGFyYW1ldGVyc1dpdGhvdXRPcmRlcigpKTtcblxuICAgIH07XG5cbiAgICByZXR1cm4gXy5leHRlbmQobmV3Vk0sIGdldHRlcnMsIHtwYXJhbWV0ZXJzOiBwYXJhbWV0ZXJzLCBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyOiBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyfSk7XG4gIH07XG59KSk7XG4iLCIoZnVuY3Rpb24oZmFjdG9yeSkge1xuICBpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG4gICAgLy8gTm9kZS9Db21tb25KU1xuICAgIGZhY3RvcnkocmVxdWlyZSgnbWl0aHJpbCcpLCByZXF1aXJlKCd1bmRlcnNjb3JlJykpO1xuICB9IGVsc2Uge1xuICAgIC8vIEJyb3dzZXIgZ2xvYmFsc1xuICAgIGZhY3Rvcnkod2luZG93Lm0sIHdpbmRvdy5fKTtcbiAgfVxufShmdW5jdGlvbihtLCBfKSB7XG4gIG0ucG9zdGdyZXN0LnBhZ2luYXRpb25WTSA9IGZ1bmN0aW9uKHBhZ2VSZXF1ZXN0LCBvcmRlcil7XG4gICAgdmFyIGNvbGxlY3Rpb24gPSBtLnByb3AoW10pLFxuICAgICAgZGVmYXVsdE9yZGVyID0gb3JkZXIgfHwgJ2lkLmRlc2MnLFxuICAgICAgZmlsdGVycyA9IG0ucHJvcCh7b3JkZXI6IGRlZmF1bHRPcmRlcn0pLFxuICAgICAgaXNMb2FkaW5nID0gbS5wcm9wKGZhbHNlKSxcbiAgICAgIHBhZ2UgPSBtLnByb3AoMSksXG4gICAgICB0b3RhbCA9IG0ucHJvcCgpLFxuXG4gICAgICBmZXRjaCA9IGZ1bmN0aW9uKCl7XG4gICAgICB2YXIgZCA9IG0uZGVmZXJyZWQoKSxcbiAgICAgICAgZ2V0VG90YWwgPSBmdW5jdGlvbih4aHIpIHtcbiAgICAgICAgaWYgKCF4aHIgfHwgeGhyLnN0YXR1cyA9PT0gMCl7XG4gICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtoaW50OiBudWxsLCBkZXRhaWxzOiBudWxsLCBjb2RlOiAwLCBtZXNzYWdlOiAnQ29ubmVjdGlvbiBlcnJvcid9KTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgcmFuZ2VIZWFkZXIgPSB4aHIuZ2V0UmVzcG9uc2VIZWFkZXIoJ0NvbnRlbnQtUmFuZ2UnKTtcbiAgICAgICAgaWYgKF8uaXNTdHJpbmcocmFuZ2VIZWFkZXIpICYmIHJhbmdlSGVhZGVyLnNwbGl0KCcvJykubGVuZ3RoID4gMSl7XG4gICAgICAgICAgdG90YWwocGFyc2VJbnQocmFuZ2VIZWFkZXIuc3BsaXQoJy8nKVsxXSkpO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgSlNPTi5wYXJzZSh4aHIucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICByZXR1cm4geGhyLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXgpe1xuICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7aGludDogbnVsbCwgZGV0YWlsczogbnVsbCwgY29kZTogMCwgbWVzc2FnZTogeGhyLnJlc3BvbnNlVGV4dH0pO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgaXNMb2FkaW5nKHRydWUpO1xuICAgICAgcGFnZVJlcXVlc3QoZmlsdGVycygpLCBwYWdlKCksIHtiYWNrZ3JvdW5kOiB0cnVlLCBleHRyYWN0OiBnZXRUb3RhbH0pLnRoZW4oZnVuY3Rpb24oZGF0YSl7XG4gICAgICAgIGNvbGxlY3Rpb24oXy51bmlvbihjb2xsZWN0aW9uKCksIGRhdGEpKTtcbiAgICAgICAgaXNMb2FkaW5nKGZhbHNlKTtcbiAgICAgICAgZC5yZXNvbHZlKGNvbGxlY3Rpb24oKSk7XG4gICAgICAgIG0ucmVkcmF3KCk7XG4gICAgICB9LCBmdW5jdGlvbihlcnJvcil7XG4gICAgICAgIGlzTG9hZGluZyhmYWxzZSk7XG4gICAgICAgIHRvdGFsKDApO1xuICAgICAgICBkLnJlamVjdChlcnJvcik7XG4gICAgICAgIG0ucmVkcmF3KCk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBkLnByb21pc2U7XG4gICAgfSxcblxuICAgIGZpcnN0UGFnZSA9IGZ1bmN0aW9uKHBhcmFtZXRlcnMpe1xuICAgICAgZmlsdGVycyhfLmV4dGVuZCh7b3JkZXI6IGRlZmF1bHRPcmRlcn0sIHBhcmFtZXRlcnMpKTtcbiAgICAgIGNvbGxlY3Rpb24oW10pO1xuICAgICAgcGFnZSgxKTtcbiAgICAgIHJldHVybiBmZXRjaCgpO1xuICAgIH0sXG5cbiAgICBuZXh0UGFnZSA9IGZ1bmN0aW9uKCl7XG4gICAgICBwYWdlKHBhZ2UoKSArIDEpO1xuICAgICAgcmV0dXJuIGZldGNoKCk7XG4gICAgfTtcblxuICAgIHJldHVybiB7XG4gICAgICBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uLFxuICAgICAgZmlyc3RQYWdlOiBmaXJzdFBhZ2UsXG4gICAgICBpc0xvYWRpbmc6IGlzTG9hZGluZyxcbiAgICAgIG5leHRQYWdlOiBuZXh0UGFnZSxcbiAgICAgIHRvdGFsOiB0b3RhbFxuICAgIH07XG4gIH07XG5cbn0pKTtcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==