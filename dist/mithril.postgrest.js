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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1pdGhyaWwucG9zdGdyZXN0LmpzIiwidm1zL2ZpbHRlcnNWTS5qcyIsInZtcy9wYWdpbmF0aW9uVk0uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM5S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDeEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6Im1pdGhyaWwucG9zdGdyZXN0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKGZhY3RvcnkpIHtcbiAgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xuICAgIC8vIE5vZGUvQ29tbW9uSlNcbiAgICBmYWN0b3J5KHJlcXVpcmUoJ21pdGhyaWwnKSwgcmVxdWlyZSgndW5kZXJzY29yZScpKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBCcm93c2VyIGdsb2JhbHNcbiAgICBmYWN0b3J5KHdpbmRvdy5tLCB3aW5kb3cuXyk7XG4gIH1cbn0oZnVuY3Rpb24obSwgXykge1xuICB2YXIgcG9zdGdyZXN0ID0ge30sXG5cbiAgdG9rZW4gPSBtLnByb3AoKSxcblxuICBtZXJnZUNvbmZpZyA9IGZ1bmN0aW9uKGNvbmZpZywgb3B0aW9ucyl7XG4gICAgcmV0dXJuIG9wdGlvbnMgJiYgXy5pc0Z1bmN0aW9uKG9wdGlvbnMuY29uZmlnKSA/IF8uY29tcG9zZShvcHRpb25zLmNvbmZpZywgY29uZmlnKSA6IGNvbmZpZztcbiAgfSxcblxuICBhZGRIZWFkZXJzID0gZnVuY3Rpb24oaGVhZGVycyl7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKHhocil7XG4gICAgICBfLmVhY2goaGVhZGVycywgZnVuY3Rpb24odmFsdWUsIGtleSl7XG4gICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKGtleSwgdmFsdWUpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4geGhyO1xuICAgIH07XG4gIH0sXG5cbiAgYWRkUmVwcmVzZW50YXRpb25IZWFkZXIgPSBhZGRIZWFkZXJzKHsnUHJlZmVyJzogJ3JldHVybj1yZXByZXNlbnRhdGlvbid9KTtcblxuICBwb3N0Z3Jlc3QudG9rZW4gPSB0b2tlbjtcblxuICBwb3N0Z3Jlc3QubG9hZGVyID0gZnVuY3Rpb24ob3B0aW9ucywgcmVxdWVzdEZ1bmN0aW9uLCBkZWZhdWx0U3RhdGUpe1xuICAgIHZhciBkZWZhdWx0U3RhdGUgPSBkZWZhdWx0U3RhdGUgfHwgZmFsc2U7XG4gICAgdmFyIGxvYWRlciA9IG0ucHJvcChkZWZhdWx0U3RhdGUpLCBkID0gbS5kZWZlcnJlZCgpO1xuICAgIGxvYWRlci5sb2FkID0gZnVuY3Rpb24oKXtcbiAgICAgIGxvYWRlcih0cnVlKTtcbiAgICAgIG0ucmVkcmF3KCk7XG4gICAgICBtLnN0YXJ0Q29tcHV0YXRpb24oKTtcbiAgICAgIHJlcXVlc3RGdW5jdGlvbihfLmV4dGVuZCh7fSwgb3B0aW9ucywge2JhY2tncm91bmQ6IHRydWV9KSkudGhlbihmdW5jdGlvbihkYXRhKXtcbiAgICAgICAgbG9hZGVyKGZhbHNlKTtcbiAgICAgICAgZC5yZXNvbHZlKGRhdGEpO1xuICAgICAgICBtLmVuZENvbXB1dGF0aW9uKCk7XG4gICAgICB9LCBmdW5jdGlvbihlcnJvcil7XG4gICAgICAgIGxvYWRlcihmYWxzZSk7XG4gICAgICAgIGQucmVqZWN0KGVycm9yKTtcbiAgICAgICAgbS5lbmRDb21wdXRhdGlvbigpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gZC5wcm9taXNlO1xuICAgIH07XG4gICAgcmV0dXJuIGxvYWRlcjtcbiAgfTtcblxuICBwb3N0Z3Jlc3QubG9hZGVyV2l0aFRva2VuID0gZnVuY3Rpb24ob3B0aW9ucywgZGVmYXVsdFN0YXRlKXtcbiAgICByZXR1cm4gcG9zdGdyZXN0LmxvYWRlcihvcHRpb25zLCBwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgZGVmYXVsdFN0YXRlKTtcbiAgfTtcblxuICBwb3N0Z3Jlc3QuaW5pdCA9IGZ1bmN0aW9uKGFwaVByZWZpeCwgYXV0aGVudGljYXRpb25PcHRpb25zKXtcbiAgICBwb3N0Z3Jlc3QucmVxdWVzdCA9IGZ1bmN0aW9uKG9wdGlvbnMpe1xuICAgICAgcmV0dXJuIG0ucmVxdWVzdChfLmV4dGVuZCh7fSwgb3B0aW9ucywge3VybDogYXBpUHJlZml4ICsgb3B0aW9ucy51cmx9KSk7XG4gICAgfTtcblxuICAgIHBvc3RncmVzdC5hdXRoZW50aWNhdGUgPSBmdW5jdGlvbigpe1xuICAgICAgdmFyIGRlZmVycmVkID0gbS5kZWZlcnJlZCgpO1xuICAgICAgaWYgKHRva2VuKCkpe1xuICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHt0b2tlbjogdG9rZW4oKX0pO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIG0ucmVxdWVzdChhdXRoZW50aWNhdGlvbk9wdGlvbnMpLnRoZW4oZnVuY3Rpb24oZGF0YSl7XG4gICAgICAgICAgdG9rZW4oZGF0YS50b2tlbik7XG4gICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSh7dG9rZW46IHRva2VuKCl9KTtcbiAgICAgICAgfSwgZnVuY3Rpb24oZGF0YSl7IGRlZmVycmVkLnJlamVjdChkYXRhKTsgfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9O1xuXG4gICAgcG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4gPSBmdW5jdGlvbihvcHRpb25zKXtcbiAgICAgIHZhciBhZGRBdXRob3JpemF0aW9uSGVhZGVyID0gZnVuY3Rpb24oKXtcbiAgICAgICAgcmV0dXJuIG1lcmdlQ29uZmlnKGFkZEhlYWRlcnMoeydBdXRob3JpemF0aW9uJzogJ0JlYXJlciAnICsgdG9rZW4oKX0pLCBvcHRpb25zKTtcbiAgICAgIH07XG4gICAgICByZXR1cm4gbS5wb3N0Z3Jlc3QuYXV0aGVudGljYXRlKCkudGhlbihcbiAgICAgICAgZnVuY3Rpb24oKXtcbiAgICAgICAgICByZXR1cm4gbS5wb3N0Z3Jlc3QucmVxdWVzdChfLmV4dGVuZCh7fSwgb3B0aW9ucywge2NvbmZpZzogYWRkQXV0aG9yaXphdGlvbkhlYWRlcigpfSkpO1xuICAgICAgICB9LFxuICAgICAgICBmdW5jdGlvbigpe1xuICAgICAgICAgIHJldHVybiBtLnBvc3RncmVzdC5yZXF1ZXN0KF8uZXh0ZW5kKHt9LCBvcHRpb25zKSk7XG4gICAgICAgIH1cbiAgICAgICk7XG4gICAgfTtcblxuICAgIHBvc3RncmVzdC5tb2RlbCA9IGZ1bmN0aW9uKG5hbWUpe1xuICAgICAgdmFyIGFkZFBhZ2luYXRpb25IZWFkZXJzID0gZnVuY3Rpb24ocGFnZSwgcGFnZVNpemUpe1xuICAgICAgICB2YXIgdG9SYW5nZSA9IGZ1bmN0aW9uKCl7XG4gICAgICAgICAgdmFyIGZyb20gPSAocGFnZSAtIDEpICogcGFnZVNpemUsXG4gICAgICAgICAgICB0byA9IGZyb20gKyBwYWdlU2l6ZSAtIDE7XG4gICAgICAgICAgcmV0dXJuIGZyb20gKyAnLScgKyB0bztcbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gYWRkSGVhZGVycyh7J1JhbmdlLXVuaXQnOiAnaXRlbXMnLCAnUmFuZ2UnOiB0b1JhbmdlKCl9KTtcbiAgICAgIH0sXG5cbiAgICAgIHBhZ2VTaXplID0gbS5wcm9wKDEwKSxcblxuICAgICAgICBuYW1lT3B0aW9ucyA9IHt1cmw6ICcvJyArIG5hbWV9LFxuXG4gICAgICAgIGdldE9wdGlvbnMgPSBmdW5jdGlvbihkYXRhLCBwYWdlLCBwYWdlU2l6ZSwgb3B0aW9ucyl7XG4gICAgICAgIHJldHVybiBfLmV4dGVuZCh7fSwgb3B0aW9ucywgbmFtZU9wdGlvbnMsIHttZXRob2Q6ICdHRVQnLCBkYXRhOiBkYXRhLCBjb25maWc6IG1lcmdlQ29uZmlnKGFkZFBhZ2luYXRpb25IZWFkZXJzKHBhZ2UsIHBhZ2VTaXplKSwgb3B0aW9ucyl9KTtcbiAgICAgIH0sXG5cbiAgICAgIHF1ZXJ5c3RyaW5nID0gZnVuY3Rpb24oZmlsdGVycywgb3B0aW9ucyl7XG4gICAgICAgIG9wdGlvbnMudXJsICs9ICc/JyArIG0ucm91dGUuYnVpbGRRdWVyeVN0cmluZyhmaWx0ZXJzKTtcbiAgICAgICAgcmV0dXJuIG9wdGlvbnM7XG4gICAgICB9LFxuXG4gICAgICBvcHRpb25zID0gZnVuY3Rpb24ob3B0aW9ucyl7XG4gICAgICAgIHJldHVybiBtLnBvc3RncmVzdC5yZXF1ZXN0KF8uZXh0ZW5kKHt9LCBvcHRpb25zLCBuYW1lT3B0aW9ucywge21ldGhvZDogJ09QVElPTlMnfSkpO1xuICAgICAgfSxcblxuICAgICAgcG9zdE9wdGlvbnMgPSBmdW5jdGlvbihhdHRyaWJ1dGVzLCBvcHRpb25zKXtcbiAgICAgICAgcmV0dXJuIF8uZXh0ZW5kKFxuICAgICAgICAgIHt9LFxuICAgICAgICAgIG9wdGlvbnMsXG4gICAgICAgICAgbmFtZU9wdGlvbnMsXG4gICAgICAgICAge21ldGhvZDogJ1BPU1QnLCBkYXRhOiBhdHRyaWJ1dGVzLCBjb25maWc6IG1lcmdlQ29uZmlnKGFkZFJlcHJlc2VudGF0aW9uSGVhZGVyLCBvcHRpb25zKX1cbiAgICAgICAgKTtcbiAgICAgIH0sXG5cbiAgICAgIGRlbGV0ZU9wdGlvbnMgPSBmdW5jdGlvbihmaWx0ZXJzLCBvcHRpb25zKXtcbiAgICAgICAgcmV0dXJuIHF1ZXJ5c3RyaW5nKGZpbHRlcnMsIF8uZXh0ZW5kKHt9LCBvcHRpb25zLCBuYW1lT3B0aW9ucywge21ldGhvZDogJ0RFTEVURSd9KSk7XG4gICAgICB9LFxuXG4gICAgICBwYXRjaE9wdGlvbnMgPSBmdW5jdGlvbihmaWx0ZXJzLCBhdHRyaWJ1dGVzLCBvcHRpb25zKXtcbiAgICAgICAgcmV0dXJuIHF1ZXJ5c3RyaW5nKFxuICAgICAgICAgIGZpbHRlcnMsXG4gICAgICAgICAgXy5leHRlbmQoXG4gICAgICAgICAgICB7fSxcbiAgICAgICAgICAgIG9wdGlvbnMsXG4gICAgICAgICAgICBuYW1lT3B0aW9ucyxcbiAgICAgICAgICAgIHttZXRob2Q6ICdQQVRDSCcsIGRhdGE6IGF0dHJpYnV0ZXMsIGNvbmZpZzogbWVyZ2VDb25maWcoYWRkUmVwcmVzZW50YXRpb25IZWFkZXIsIG9wdGlvbnMpfSlcbiAgICAgICAgKTtcbiAgICAgIH0sXG5cbiAgICAgIGdldFBhZ2VPcHRpb25zID0gZnVuY3Rpb24oZGF0YSwgcGFnZSwgb3B0aW9ucyl7XG4gICAgICAgIHJldHVybiBnZXRPcHRpb25zKGRhdGEsIChwYWdlIHx8IDEpLCBwYWdlU2l6ZSgpLCBvcHRpb25zKTtcbiAgICAgIH0sXG5cbiAgICAgIGdldFJvd09wdGlvbnMgPSBmdW5jdGlvbihkYXRhLCBvcHRpb25zKXtcbiAgICAgICAgcmV0dXJuIGdldE9wdGlvbnMoZGF0YSwgMSwgMSwgb3B0aW9ucyk7XG4gICAgICB9O1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBwYWdlU2l6ZTogcGFnZVNpemUsXG4gICAgICAgIGdldFBhZ2VPcHRpb25zOiAgIGdldFBhZ2VPcHRpb25zLFxuICAgICAgICBnZXRSb3dPcHRpb25zOiAgICBnZXRSb3dPcHRpb25zLFxuICAgICAgICBwYXRjaE9wdGlvbnM6ICAgICBwYXRjaE9wdGlvbnMsXG4gICAgICAgIHBvc3RPcHRpb25zOiAgICAgIHBvc3RPcHRpb25zLFxuICAgICAgICBkZWxldGVPcHRpb25zOiAgICBkZWxldGVPcHRpb25zLFxuICAgICAgICBnZXRQYWdlOiAgICAgICAgICBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIGdldFBhZ2VPcHRpb25zKSxcbiAgICAgICAgZ2V0Um93OiAgICAgICAgICAgXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0LCBnZXRSb3dPcHRpb25zKSxcbiAgICAgICAgcGF0Y2g6ICAgICAgICAgICAgXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0LCBwYXRjaE9wdGlvbnMpLFxuICAgICAgICBwb3N0OiAgICAgICAgICAgICBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIHBvc3RPcHRpb25zKSxcbiAgICAgICAgZGVsZXRlUmVxdWVzdDogICAgXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0LCBkZWxldGVPcHRpb25zKSxcbiAgICAgICAgZ2V0UGFnZVdpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBnZXRQYWdlT3B0aW9ucyksXG4gICAgICAgIGdldFJvd1dpdGhUb2tlbjogIF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgZ2V0Um93T3B0aW9ucyksXG4gICAgICAgIHBhdGNoV2l0aFRva2VuOiAgIF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgcGF0Y2hPcHRpb25zKSxcbiAgICAgICAgcG9zdFdpdGhUb2tlbjogICAgXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBwb3N0T3B0aW9ucyksXG4gICAgICAgIGRlbGV0ZVdpdGhUb2tlbjogIF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgZGVsZXRlT3B0aW9ucyksXG4gICAgICAgIG9wdGlvbnM6IG9wdGlvbnNcbiAgICAgIH07XG4gICAgfTtcblxuICAgIHJldHVybiBwb3N0Z3Jlc3Q7XG4gIH07XG5cbiAgbS5wb3N0Z3Jlc3QgPSBwb3N0Z3Jlc3Q7XG59KSk7XG4iLCIoZnVuY3Rpb24oZmFjdG9yeSkge1xuICBpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG4gICAgLy8gTm9kZS9Db21tb25KU1xuICAgIGZhY3RvcnkocmVxdWlyZSgnbWl0aHJpbCcpLCByZXF1aXJlKCd1bmRlcnNjb3JlJykpO1xuICB9XG4gIGVsc2Uge1xuICAgIC8vIEJyb3dzZXIgZ2xvYmFsc1xuICAgIGZhY3Rvcnkod2luZG93Lm0sIHdpbmRvdy5fKTtcbiAgfVxufShmdW5jdGlvbihtLCBfKSB7XG4gIG0ucG9zdGdyZXN0LmZpbHRlcnNWTSA9IGZ1bmN0aW9uKGF0dHJpYnV0ZXMpe1xuICAgIHZhciBuZXdWTSA9IHt9LFxuICAgIGZpbHRlciA9IGZ1bmN0aW9uKCl7XG4gICAgICB2YXIgcHJvcCA9IG0ucHJvcCgnJyksXG4gICAgICBmaWx0ZXJQcm9wID0gZnVuY3Rpb24odmFsdWUpe1xuICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDApe1xuICAgICAgICAgIHByb3AodmFsdWUpO1xuICAgICAgICAgIHJldHVybiBuZXdWTTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcHJvcCgpO1xuICAgICAgfTtcbiAgICAgIC8vIEp1c3Qgc28gd2UgY2FuIGhhdmUgYSBkZWZhdWx0IHRvX2ZpbHRlciBhbmQgYXZvaWQgaWYgXy5pc0Z1bmN0aW9uIGNhbGxzXG4gICAgICBmaWx0ZXJQcm9wLnRvRmlsdGVyID0gZnVuY3Rpb24oKXsgcmV0dXJuIChmaWx0ZXJQcm9wKCkgfHwgJycpLnRvU3RyaW5nKCkudHJpbSgpOyB9O1xuICAgICAgcmV0dXJuIGZpbHRlclByb3A7XG4gICAgfSxcblxuICAgIGdldHRlcnMgPSBfLnJlZHVjZShcbiAgICAgIGF0dHJpYnV0ZXMsXG4gICAgICBmdW5jdGlvbihtZW1vLCBvcGVyYXRvciwgYXR0cil7XG4gICAgICAgIC8vIFRoZSBvcGVyYXRvciBiZXR3ZWVuIGlzIGltcGxlbWVudGVkIHdpdGggdHdvIHByb3BlcnRpZXMsIG9uZSBmb3IgZ3JlYXRlciB0aGFuIHZhbHVlIGFuZCBhbm90aGVyIGZvciBsZXNzZXIgdGhhbiB2YWx1ZS5cbiAgICAgICAgLy8gQm90aCBwcm9wZXJ0aWVzIGFyZSBzZW50IGluIHRoZSBxdWV1cnlzdHJpbmcgd2l0aCB0aGUgc2FtZSBuYW1lLFxuICAgICAgICAvLyB0aGF0J3Mgd2h5IHdlIG5lZWQgdGhlIHNwZWNpYWwgY2FzZSBoZXJlLCBzbyB3ZSBjYW4gdXNlIGEgc2ltcGxlIG1hcCBhcyBhcmd1bWVudCB0byBmaWx0ZXJzVk0uXG4gICAgICAgIGlmIChvcGVyYXRvciA9PT0gJ2JldHdlZW4nKXtcbiAgICAgICAgICBtZW1vW2F0dHJdID0ge2x0ZTogZmlsdGVyKCksIGd0ZTogZmlsdGVyKCl9O1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIG1lbW9bYXR0cl0gPSBmaWx0ZXIoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgIH0sXG4gICAgICB7b3JkZXI6IG0ucHJvcCgpfVxuICAgICksXG5cbiAgICBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyID0gZnVuY3Rpb24oKXtcbiAgICAgIHJldHVybiBfLnJlZHVjZShcbiAgICAgICAgZ2V0dGVycyxcbiAgICAgICAgZnVuY3Rpb24obWVtbywgZ2V0dGVyLCBhdHRyKXtcbiAgICAgICAgICBpZiAoYXR0ciAhPT0gJ29yZGVyJyl7XG4gICAgICAgICAgICB2YXIgb3BlcmF0b3IgPSBhdHRyaWJ1dGVzW2F0dHJdO1xuXG4gICAgICAgICAgICBpZiAoXy5pc0Z1bmN0aW9uKGdldHRlci50b0ZpbHRlcikgJiYgIWdldHRlci50b0ZpbHRlcigpKXsgcmV0dXJuIG1lbW87IH1cblxuICAgICAgICAgICAgLy8gQmVsbG93IHdlIHVzZSBkaWZmZXJlbnQgZm9ybWF0dGluZyBydWxlcyBmb3IgdGhlIHZhbHVlIGRlcGVuZGluZyBvbiB0aGUgb3BlcmF0b3JcbiAgICAgICAgICAgIC8vIFRoZXNlIHJ1bGVzIGFyZSB1c2VkIHJlZ2FyZGxlc3Mgb2YgdGhlIHRvRmlsdGVyIGZ1bmN0aW9uLFxuICAgICAgICAgICAgLy8gc28gdGhlIHVzZXIgY2FuIHVzZSBhIGN1c3RvbSB0b0ZpbHRlciB3aXRob3V0IGhhdmluZyB0byB3b3JyeSB3aXRoIGJhc2ljIGZpbHRlciBzeW50YXhcbiAgICAgICAgICAgIGlmIChvcGVyYXRvciA9PT0gJ2lsaWtlJyB8fCBvcGVyYXRvciA9PT0gJ2xpa2UnKXtcbiAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IG9wZXJhdG9yICsgJy4qJyArIGdldHRlci50b0ZpbHRlcigpICsgJyonO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAob3BlcmF0b3IgPT09ICdAQCcpIHtcbiAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IG9wZXJhdG9yICsgJy4nICsgZ2V0dGVyLnRvRmlsdGVyKCkucmVwbGFjZSgvXFxzKy9nLCAnJicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAob3BlcmF0b3IgPT09ICdiZXR3ZWVuJykge1xuICAgICAgICAgICAgICBpZiAoIWdldHRlci5sdGUudG9GaWx0ZXIoKSAmJiAhZ2V0dGVyLmd0ZS50b0ZpbHRlcigpKXsgcmV0dXJuIG1lbW87IH1cbiAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IFtdO1xuICAgICAgICAgICAgICBpZiAoZ2V0dGVyLmd0ZSgpKXtcbiAgICAgICAgICAgICAgICBtZW1vW2F0dHJdLnB1c2goJ2d0ZS4nICsgZ2V0dGVyLmd0ZS50b0ZpbHRlcigpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoZ2V0dGVyLmx0ZSgpKXtcbiAgICAgICAgICAgICAgICBtZW1vW2F0dHJdLnB1c2goJ2x0ZS4nICsgZ2V0dGVyLmx0ZS50b0ZpbHRlcigpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIG1lbW9bYXR0cl0gPSBvcGVyYXRvciArICcuJyArIGdldHRlci50b0ZpbHRlcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgfSxcbiAgICAgICAge31cbiAgICAgICk7XG4gICAgfSxcblxuICAgIHBhcmFtZXRlcnMgPSBmdW5jdGlvbigpe1xuICAgICAgLy8gVGhlIG9yZGVyIHBhcmFtZXRlcnMgaGF2ZSBhIHNwZWNpYWwgc3ludGF4IChqdXN0IGxpa2UgYW4gb3JkZXIgYnkgU1FMIGNsYXVzZSlcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9iZWdyaWZmcy9wb3N0Z3Jlc3Qvd2lraS9Sb3V0aW5nI2ZpbHRlcmluZy1hbmQtb3JkZXJpbmdcbiAgICAgIHZhciBvcmRlciA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIHJldHVybiBnZXR0ZXJzLm9yZGVyKCkgJiYgXy5yZWR1Y2UoXG4gICAgICAgICAgZ2V0dGVycy5vcmRlcigpLFxuICAgICAgICAgIGZ1bmN0aW9uKG1lbW8sIGRpcmVjdGlvbiwgYXR0cil7XG4gICAgICAgICAgICBtZW1vLnB1c2goYXR0ciArICcuJyArIGRpcmVjdGlvbik7XG4gICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgICB9LFxuICAgICAgICAgIFtdXG4gICAgICAgICkuam9pbignLCcpO1xuICAgICAgfSxcblxuICAgICAgb3JkZXJQYXJhbWV0ZXIgPSBvcmRlcigpID8ge29yZGVyOiBvcmRlcigpfSA6IHt9O1xuXG4gICAgICByZXR1cm4gXy5leHRlbmQoe30sIG9yZGVyUGFyYW1ldGVyLCBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyKCkpO1xuXG4gICAgfTtcblxuICAgIHJldHVybiBfLmV4dGVuZChuZXdWTSwgZ2V0dGVycywge3BhcmFtZXRlcnM6IHBhcmFtZXRlcnMsIHBhcmFtZXRlcnNXaXRob3V0T3JkZXI6IHBhcmFtZXRlcnNXaXRob3V0T3JkZXJ9KTtcbiAgfTtcbn0pKTtcbiIsIihmdW5jdGlvbihmYWN0b3J5KSB7XG4gIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcpIHtcbiAgICAvLyBOb2RlL0NvbW1vbkpTXG4gICAgZmFjdG9yeShyZXF1aXJlKCdtaXRocmlsJyksIHJlcXVpcmUoJ3VuZGVyc2NvcmUnKSk7XG4gIH0gZWxzZSB7XG4gICAgLy8gQnJvd3NlciBnbG9iYWxzXG4gICAgZmFjdG9yeSh3aW5kb3cubSwgd2luZG93Ll8pO1xuICB9XG59KGZ1bmN0aW9uKG0sIF8pIHtcbiAgbS5wb3N0Z3Jlc3QucGFnaW5hdGlvblZNID0gZnVuY3Rpb24ocGFnZVJlcXVlc3QsIG9yZGVyKXtcbiAgICB2YXIgY29sbGVjdGlvbiA9IG0ucHJvcChbXSksXG4gICAgICBkZWZhdWx0T3JkZXIgPSBvcmRlciB8fCAnaWQuZGVzYycsXG4gICAgICBmaWx0ZXJzID0gbS5wcm9wKHtvcmRlcjogZGVmYXVsdE9yZGVyfSksXG4gICAgICBpc0xvYWRpbmcgPSBtLnByb3AoZmFsc2UpLFxuICAgICAgcGFnZSA9IG0ucHJvcCgxKSxcbiAgICAgIHRvdGFsID0gbS5wcm9wKCksXG5cbiAgICAgIGZldGNoID0gZnVuY3Rpb24oKXtcbiAgICAgIHZhciBkID0gbS5kZWZlcnJlZCgpLFxuICAgICAgICBnZXRUb3RhbCA9IGZ1bmN0aW9uKHhocikge1xuICAgICAgICBpZiAoIXhociB8fCB4aHIuc3RhdHVzID09PSAwKXtcbiAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe2hpbnQ6IG51bGwsIGRldGFpbHM6IG51bGwsIGNvZGU6IDAsIG1lc3NhZ2U6ICdDb25uZWN0aW9uIGVycm9yJ30pO1xuICAgICAgICB9XG4gICAgICAgIHZhciByYW5nZUhlYWRlciA9IHhoci5nZXRSZXNwb25zZUhlYWRlcignQ29udGVudC1SYW5nZScpO1xuICAgICAgICBpZiAoXy5pc1N0cmluZyhyYW5nZUhlYWRlcikgJiYgcmFuZ2VIZWFkZXIuc3BsaXQoJy8nKS5sZW5ndGggPiAxKXtcbiAgICAgICAgICB0b3RhbChwYXJzZUludChyYW5nZUhlYWRlci5zcGxpdCgnLycpWzFdKSk7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBKU09OLnBhcnNlKHhoci5yZXNwb25zZVRleHQpO1xuICAgICAgICAgIHJldHVybiB4aHIucmVzcG9uc2VUZXh0O1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChleCl7XG4gICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtoaW50OiBudWxsLCBkZXRhaWxzOiBudWxsLCBjb2RlOiAwLCBtZXNzYWdlOiB4aHIucmVzcG9uc2VUZXh0fSk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBpc0xvYWRpbmcodHJ1ZSk7XG4gICAgICBwYWdlUmVxdWVzdChmaWx0ZXJzKCksIHBhZ2UoKSwge2JhY2tncm91bmQ6IHRydWUsIGV4dHJhY3Q6IGdldFRvdGFsfSkudGhlbihmdW5jdGlvbihkYXRhKXtcbiAgICAgICAgY29sbGVjdGlvbihfLnVuaW9uKGNvbGxlY3Rpb24oKSwgZGF0YSkpO1xuICAgICAgICBpc0xvYWRpbmcoZmFsc2UpO1xuICAgICAgICBkLnJlc29sdmUoY29sbGVjdGlvbigpKTtcbiAgICAgICAgbS5yZWRyYXcoKTtcbiAgICAgIH0sIGZ1bmN0aW9uKGVycm9yKXtcbiAgICAgICAgaXNMb2FkaW5nKGZhbHNlKTtcbiAgICAgICAgdG90YWwoMCk7XG4gICAgICAgIGQucmVqZWN0KGVycm9yKTtcbiAgICAgICAgbS5yZWRyYXcoKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGQucHJvbWlzZTtcbiAgICB9LFxuXG4gICAgZmlyc3RQYWdlID0gZnVuY3Rpb24ocGFyYW1ldGVycyl7XG4gICAgICBmaWx0ZXJzKF8uZXh0ZW5kKHtvcmRlcjogZGVmYXVsdE9yZGVyfSwgcGFyYW1ldGVycykpO1xuICAgICAgY29sbGVjdGlvbihbXSk7XG4gICAgICBwYWdlKDEpO1xuICAgICAgcmV0dXJuIGZldGNoKCk7XG4gICAgfSxcblxuICAgIG5leHRQYWdlID0gZnVuY3Rpb24oKXtcbiAgICAgIHBhZ2UocGFnZSgpICsgMSk7XG4gICAgICByZXR1cm4gZmV0Y2goKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbGxlY3Rpb246IGNvbGxlY3Rpb24sXG4gICAgICBmaXJzdFBhZ2U6IGZpcnN0UGFnZSxcbiAgICAgIGlzTG9hZGluZzogaXNMb2FkaW5nLFxuICAgICAgbmV4dFBhZ2U6IG5leHRQYWdlLFxuICAgICAgdG90YWw6IHRvdGFsXG4gICAgfTtcbiAgfTtcblxufSkpO1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9