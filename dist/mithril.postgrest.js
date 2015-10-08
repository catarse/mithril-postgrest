'use strict';

(function (factory) {
  if (typeof exports === 'object') {
    // Node/CommonJS
    factory(require('mithril'), require('underscore'));
  } else {
    // Browser globals
    factory(window.m, window._);
  }
})(function (m, _) {
  var postgrest = {};

  var token = m.prop(),
      mergeConfig = function mergeConfig(config, options) {
    return options && _.isFunction(options.config) ? _.compose(options.config, config) : config;
  },
      addHeaders = function addHeaders(headers) {
    return function (xhr) {
      _.each(headers, function (value, key) {
        xhr.setRequestHeader(key, value);
      });
      return xhr;
    };
  },
      addConfigHeaders = function addConfigHeaders(headers, options) {
    return _.extend({}, options, { config: mergeConfig(addHeaders(headers), options) });
  },
      representationHeader = { 'Prefer': 'return=representation' };

  postgrest.token = token;

  postgrest.loader = function (options, requestFunction) {
    var defaultState = arguments.length <= 2 || arguments[2] === undefined ? false : arguments[2];

    var loader = m.prop(defaultState),
        d = m.deferred();
    loader.load = function () {
      loader(true);
      m.redraw();
      m.startComputation();
      requestFunction(_.extend({}, options, { background: true })).then(function (data) {
        loader(false);
        d.resolve(data);
        m.endComputation();
      }, function (error) {
        loader(false);
        d.reject(error);
        m.endComputation();
      });
      return d.promise;
    };
    return loader;
  };

  postgrest.loaderWithToken = function (options, defaultState) {
    return postgrest.loader(options, postgrest.requestWithToken, defaultState);
  };

  postgrest.init = function (apiPrefix, authenticationOptions) {
    postgrest.request = function (options) {
      return m.request(_.extend({}, options, { url: apiPrefix + options.url }));
    };

    postgrest.authenticate = function () {
      var deferred = m.deferred();
      if (token()) {
        deferred.resolve({ token: token() });
      } else {
        m.request(authenticationOptions).then(function (data) {
          token(data.token);
          deferred.resolve({ token: token() });
        }, function (data) {
          deferred.reject(data);
        });
      }
      return deferred.promise;
    };

    postgrest.requestWithToken = function (options) {
      return m.postgrest.authenticate().then(function () {
        return m.postgrest.request(addConfigHeaders({ 'Authorization': 'Bearer ' + token() }, options));
      }, function () {
        return m.postgrest.request(options);
      });
    };

    postgrest.model = function (name) {
      var paginationHeaders = function paginationHeaders(page, pageSize) {
        if (!pageSize) {
          return;
        }

        var toRange = function toRange() {
          var from = (page - 1) * pageSize,
              to = from + pageSize - 1;
          return from + '-' + to;
        };

        return { 'Range-unit': 'items', 'Range': toRange() };
      },
          pageSize = m.prop(10),
          nameOptions = { url: '/' + name },
          getOptions = function getOptions(data, page, pageSize, options) {
        var headers = arguments.length <= 4 || arguments[4] === undefined ? {} : arguments[4];

        var extraHeaders = _.extend({}, { 'Prefer': 'count=none' }, headers, paginationHeaders(page, pageSize));
        return addConfigHeaders(extraHeaders, _.extend({}, options, nameOptions, { method: 'GET', data: data }));
      },
          querystring = function querystring(filters, options) {
        options.url += '?' + m.route.buildQueryString(filters);
        return options;
      },
          options = function options(_options) {
        return m.postgrest.request(_.extend({}, _options, nameOptions, { method: 'OPTIONS' }));
      },
          postOptions = function postOptions(attributes, options) {
        var headers = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

        var extraHeaders = _.extend({}, representationHeader, headers);
        return addConfigHeaders(extraHeaders, _.extend({}, options, nameOptions, { method: 'POST', data: attributes }));
      },
          deleteOptions = function deleteOptions(filters, options) {
        var headers = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

        var extraHeaders = addHeaders(_.extend({}, headers));
        return querystring(filters, addConfigHeaders(extraHeaders, _.extend({}, options, nameOptions, { method: 'DELETE' })));
      },
          patchOptions = function patchOptions(filters, attributes, options) {
        var headers = arguments.length <= 3 || arguments[3] === undefined ? {} : arguments[3];

        var extraHeaders = _.extend({}, representationHeader, headers);
        return querystring(filters, addConfigHeaders(extraHeaders, _.extend({}, options, nameOptions, { method: 'PATCH', data: attributes })));
      },
          getPageOptions = function getPageOptions(data, page, options) {
        var headers = arguments.length <= 3 || arguments[3] === undefined ? {} : arguments[3];

        return getOptions(data, page || 1, pageSize(), options, headers);
      },
          getRowOptions = function getRowOptions(data, options) {
        var headers = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

        return getOptions(data, 1, 1, options, headers);
      };

      return {
        pageSize: pageSize,
        getPageOptions: getPageOptions,
        getRowOptions: getRowOptions,
        patchOptions: patchOptions,
        postOptions: postOptions,
        deleteOptions: deleteOptions,
        getPage: _.compose(postgrest.request, getPageOptions),
        getRow: _.compose(postgrest.request, getRowOptions),
        patch: _.compose(postgrest.request, patchOptions),
        post: _.compose(postgrest.request, postOptions),
        deleteRequest: _.compose(postgrest.request, deleteOptions),
        getPageWithToken: _.compose(postgrest.requestWithToken, getPageOptions),
        getRowWithToken: _.compose(postgrest.requestWithToken, getRowOptions),
        patchWithToken: _.compose(postgrest.requestWithToken, patchOptions),
        postWithToken: _.compose(postgrest.requestWithToken, postOptions),
        deleteWithToken: _.compose(postgrest.requestWithToken, deleteOptions),
        options: options
      };
    };

    return postgrest;
  };

  m.postgrest = postgrest;
});
'use strict';

(function (factory) {
  if (typeof exports === 'object') {
    // Node/CommonJS
    factory(require('mithril'), require('underscore'));
  } else {
    // Browser globals
    factory(window.m, window._);
  }
})(function (m, _) {
  m.postgrest.filtersVM = function (attributes) {
    var newVM = {},
        filter = function filter() {
      var prop = m.prop(''),
          filterProp = function filterProp(value) {
        if (arguments.length > 0) {
          prop(value);
          return newVM;
        }
        return prop();
      };
      // Just so we can have a default to_filter and avoid if _.isFunction calls
      filterProp.toFilter = function () {
        return _.isString(filterProp()) ? filterProp().trim() : filterProp();
      };
      return filterProp;
    },
        getters = _.reduce(attributes, function (memo, operator, attr) {
      // The operator between is implemented with two properties, one for greater than value and another for lesser than value.
      // Both properties are sent in the queurystring with the same name,
      // that's why we need the special case here, so we can use a simple map as argument to filtersVM.
      if (operator === 'between') {
        memo[attr] = { lte: filter(), gte: filter() };
      } else {
        memo[attr] = filter();
      }
      return memo;
    }, { order: m.prop() }),
        parametersWithoutOrder = function parametersWithoutOrder() {
      return _.reduce(getters, function (memo, getter, attr) {
        if (attr !== 'order') {
          var operator = attributes[attr];

          if (_.isFunction(getter.toFilter) && (getter.toFilter() === undefined || getter.toFilter() === '')) {
            return memo;
          }

          // Bellow we use different formatting rules for the value depending on the operator
          // These rules are used regardless of the toFilter function,
          // so the user can use a custom toFilter without having to worry with basic filter syntax
          if (operator === 'ilike' || operator === 'like') {
            memo[attr] = operator + '.*' + getter.toFilter() + '*';
          } else if (operator === '@@') {
            memo[attr] = operator + '.' + getter.toFilter().replace(/\s+/g, '&');
          } else if (operator === 'between') {
            if (!getter.lte.toFilter() && !getter.gte.toFilter()) {
              return memo;
            }
            memo[attr] = [];
            if (getter.gte()) {
              memo[attr].push('gte.' + getter.gte.toFilter());
            }
            if (getter.lte()) {
              memo[attr].push('lte.' + getter.lte.toFilter());
            }
          } else {
            memo[attr] = operator + '.' + getter.toFilter();
          }
        }
        return memo;
      }, {});
    },
        parameters = function parameters() {
      // The order parameters have a special syntax (just like an order by SQL clause)
      // https://github.com/begriffs/postgrest/wiki/Routing#filtering-and-ordering
      var order = function order() {
        return getters.order() && _.reduce(getters.order(), function (memo, direction, attr) {
          memo.push(attr + '.' + direction);
          return memo;
        }, []).join(',');
      },
          orderParameter = order() ? { order: order() } : {};

      return _.extend({}, orderParameter, parametersWithoutOrder());
    };

    return _.extend(newVM, getters, { parameters: parameters, parametersWithoutOrder: parametersWithoutOrder });
  };
});
'use strict';

var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

(function (factory) {
  if (typeof exports === 'object') {
    // Node/CommonJS
    factory(require('mithril'), require('underscore'));
  } else {
    // Browser globals
    factory(window.m, window._);
  }
})(function (m, _) {
  m.postgrest.paginationVM = function (model, order) {
    var authenticate = arguments.length <= 2 || arguments[2] === undefined ? true : arguments[2];

    var collection = m.prop([]),
        defaultOrder = order || 'id.desc',
        filters = m.prop({ order: defaultOrder }),
        isLoading = m.prop(false),
        page = m.prop(1),
        resultsCount = m.prop(),
        pageRequest = authenticate ? model.getPageWithToken : model.getPage,
        total = m.prop();

    var fetch = function fetch() {
      var d = m.deferred();
      var getTotal = function getTotal(xhr) {
        if (!xhr || xhr.status === 0) {
          return JSON.stringify({ hint: null, details: null, code: 0, message: 'Connection error' });
        }
        var rangeHeader = xhr.getResponseHeader('Content-Range');
        if (_.isString(rangeHeader)) {
          var _rangeHeader$split = rangeHeader.split('/');

          var _rangeHeader$split2 = _slicedToArray(_rangeHeader$split, 2);

          var size = _rangeHeader$split2[0];
          var count = _rangeHeader$split2[1];

          var _size$split = size.split('-');

          var _size$split2 = _slicedToArray(_size$split, 2);

          var from = _size$split2[0];
          var to = _size$split2[1];

          total(parseInt(count));
          resultsCount(parseInt(to) - parseInt(from) + 1);
        }
        try {
          JSON.parse(xhr.responseText);
          return xhr.responseText;
        } catch (ex) {
          return JSON.stringify({ hint: null, details: null, code: 0, message: xhr.responseText });
        }
      };
      isLoading(true);
      pageRequest(filters(), page(), { background: true, extract: getTotal }, { 'Prefer': 'count=exact' }).then(function (data) {
        collection(_.union(collection(), data));
        isLoading(false);
        d.resolve(collection());
        m.redraw();
      }, function (error) {
        isLoading(false);
        total(0);
        d.reject(error);
        m.redraw();
      });
      return d.promise;
    },
        firstPage = function firstPage(parameters) {
      filters(_.extend({ order: defaultOrder }, parameters));
      collection([]);
      page(1);
      return fetch();
    },
        isLastPage = function isLastPage() {
      return page() * model.pageSize() >= total();
    },
        nextPage = function nextPage() {
      page(page() + 1);
      return fetch();
    };

    return {
      collection: collection,
      firstPage: firstPage,
      isLoading: isLoading,
      nextPage: nextPage,
      isLastPage: isLastPage,
      total: total,
      resultsCount: resultsCount
    };
  };
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1pdGhyaWwucG9zdGdyZXN0LmpzIiwidm1zL2ZpbHRlcnNWTS5qcyIsInZtcy9wYWdpbmF0aW9uVk0uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxBQUFDLENBQUEsVUFBUyxPQUFPLEVBQUU7QUFDakIsTUFBSSxPQUFPLE9BQU8sS0FBSyxRQUFRLEVBQUU7O0FBRS9CLFdBQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEVBQUUsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7R0FDcEQsTUFBTTs7QUFFTCxXQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7R0FDN0I7Q0FDRixDQUFBLENBQUMsVUFBQyxDQUFDLEVBQUUsQ0FBQyxFQUFLO0FBQ1YsTUFBSSxTQUFTLEdBQUcsRUFBRSxDQUFDOztBQUVuQixNQUFNLEtBQUssR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFO01BRXRCLFdBQVcsR0FBRyxTQUFkLFdBQVcsQ0FBSSxNQUFNLEVBQUUsT0FBTyxFQUFLO0FBQ2pDLFdBQU8sT0FBTyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUM7R0FDN0Y7TUFFRCxVQUFVLEdBQUcsU0FBYixVQUFVLENBQUksT0FBTyxFQUFLO0FBQ3hCLFdBQU8sVUFBQyxHQUFHLEVBQUs7QUFDZCxPQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxVQUFDLEtBQUssRUFBRSxHQUFHLEVBQUs7QUFDOUIsV0FBRyxDQUFDLGdCQUFnQixDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQztPQUNsQyxDQUFDLENBQUM7QUFDSCxhQUFPLEdBQUcsQ0FBQztLQUNaLENBQUM7R0FDSDtNQUVELGdCQUFnQixHQUFHLFNBQW5CLGdCQUFnQixDQUFJLE9BQU8s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QyxPQUFPLENBQUM7S0FDbEI7UUFFRCxTQUFTLEdBQUcsU0FBWixTQUFTLENBQUksVUFBVSxFQUFLO0FBQzFCLGFBQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUMsS0FBSyxFQUFFLFlBQVksRUFBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7QUFDckQsZ0JBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUNmLFVBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNSLGFBQU8sS0FBSyxFQUFFLENBQUM7S0FDaEI7UUFFRCxVQUFVLEdBQUcsU0FBYixVQUFVLEdBQVM7QUFDakIsYUFBUSxJQUFJLEVBQUUsR0FBRyxLQUFLLENBQUMsUUFBUSxFQUFFLElBQUksS0FBSyxFQUFFLENBQUU7S0FDL0M7UUFFRCxRQUFRLEdBQUcsU0FBWCxRQUFRLEdBQVM7QUFDZixVQUFJLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDakIsYUFBTyxLQUFLLEVBQUUsQ0FBQztLQUNoQixDQUFDOztBQUVGLFdBQU87QUFDTCxnQkFBVSxFQUFFLFVBQVU7QUFDdEIsZUFBUyxFQUFFLFNBQVM7QUFDcEIsZUFBUyxFQUFFLFNBQVM7QUFDcEIsY0FBUSxFQUFFLFFBQVE7QUFDbEIsZ0JBQVUsRUFBRSxVQUFVO0FBQ3RCLFdBQUssRUFBRSxLQUFLO0FBQ1osa0JBQVksRUFBRSxZQUFZO0tBQzNCLENBQUM7R0FDSCxDQUFDO0NBRUgsQ0FBQyxDQUFFIiwiZmlsZSI6Im1pdGhyaWwucG9zdGdyZXN0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKGZhY3RvcnkpIHtcbiAgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xuICAgIC8vIE5vZGUvQ29tbW9uSlNcbiAgICBmYWN0b3J5KHJlcXVpcmUoJ21pdGhyaWwnKSwgcmVxdWlyZSgndW5kZXJzY29yZScpKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBCcm93c2VyIGdsb2JhbHNcbiAgICBmYWN0b3J5KHdpbmRvdy5tLCB3aW5kb3cuXyk7XG4gIH1cbn0oKG0sIF8pID0+IHtcbiAgbGV0IHBvc3RncmVzdCA9IHt9O1xuXG4gIGNvbnN0IHRva2VuID0gbS5wcm9wKCksXG5cbiAgbWVyZ2VDb25maWcgPSAoY29uZmlnLCBvcHRpb25zKSA9PiB7XG4gICAgcmV0dXJuIG9wdGlvbnMgJiYgXy5pc0Z1bmN0aW9uKG9wdGlvbnMuY29uZmlnKSA/IF8uY29tcG9zZShvcHRpb25zLmNvbmZpZywgY29uZmlnKSA6IGNvbmZpZztcbiAgfSxcblxuICBhZGRIZWFkZXJzID0gKGhlYWRlcnMpID0+IHtcbiAgICByZXR1cm4gKHhocikgPT4ge1xuICAgICAgXy5lYWNoKGhlYWRlcnMsICh2YWx1ZSwga2V5KSA9PiB7XG4gICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKGtleSwgdmFsdWUpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4geGhyO1xuICAgIH07XG4gIH0sXG5cbiAgYWRkQ29uZmlnSGVhZGVycyA9IChoZWFkZXJzLCBvcHRpb25zKSA9PiB7XG4gICAgcmV0dXJuIF8uZXh0ZW5kKHt9LCBvcHRpb25zLCB7Y29uZmlnOiBtZXJnZUNvbmZpZyhhZGRIZWFkZXJzKGhlYWRlcnMpLCBvcHRpb25zKX0pO1xuICB9LFxuXG4gIHJlcHJlc2VudGF0aW9uSGVhZGVyID0geydQcmVmZXInOiAncmV0dXJuPXJlcHJlc2VudGF0aW9uJ307XG5cbiAgcG9zdGdyZXN0LnRva2VuID0gdG9rZW47XG5cbiAgcG9zdGdyZXN0LmxvYWRlciA9IChvcHRpb25zLCByZXF1ZXN0RnVuY3Rpb24sIGRlZmF1bHRTdGF0ZSA9IGZhbHNlKSA9PiB7XG4gICAgY29uc3QgbG9hZGVyID0gbS5wcm9wKGRlZmF1bHRTdGF0ZSksIGQgPSBtLmRlZmVycmVkKCk7XG4gICAgbG9hZGVyLmxvYWQgPSAoKSA9PiB7XG4gICAgICBsb2FkZXIodHJ1ZSk7XG4gICAgICBtLnJlZHJhdygpO1xuICAgICAgbS5zdGFydENvbXB1dGF0aW9uKCk7XG4gICAgICByZXF1ZXN0RnVuY3Rpb24oXy5leHRlbmQoe30sIG9wdGlvbnMsIHtiYWNrZ3JvdW5kOiB0cnVlfSkpLnRoZW4oKGRhdGEpID0+IHtcbiAgICAgICAgbG9hZGVyKGZhbHNlKTtcbiAgICAgICAgZC5yZXNvbHZlKGRhdGEpO1xuICAgICAgICBtLmVuZENvbXB1dGF0aW9uKCk7XG4gICAgICB9LCAoZXJyb3IpID0+IHtcbiAgICAgICAgbG9hZGVyKGZhbHNlKTtcbiAgICAgICAgZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICBtLmVuZENvbXB1dGF0aW9uKCk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBkLnByb21pc2U7XG4gICAgfTtcbiAgICByZXR1cm4gbG9hZGVyO1xuICB9O1xuXG4gIHBvc3RncmVzdC5sb2FkZXJXaXRoVG9rZW4gPSAob3B0aW9ucywgZGVmYXVsdFN0YXRlKSA9PiB7XG4gICAgcmV0dXJuIHBvc3RncmVzdC5sb2FkZXIob3B0aW9ucywgcG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIGRlZmF1bHRTdGF0ZSk7XG4gIH07XG5cbiAgcG9zdGdyZXN0LmluaXQgPSAoYXBpUHJlZml4LCBhdXRoZW50aWNhdGlvbk9wdGlvbnMpID0+IHtcbiAgICBwb3N0Z3Jlc3QucmVxdWVzdCA9IChvcHRpb25zKSA9PiB7XG4gICAgICByZXR1cm4gbS5yZXF1ZXN0KF8uZXh0ZW5kKHt9LCBvcHRpb25zLCB7dXJsOiBhcGlQcmVmaXggKyBvcHRpb25zLnVybH0pKTtcbiAgICB9O1xuXG4gICAgcG9zdGdyZXN0LmF1dGhlbnRpY2F0ZSA9ICgpID0+IHtcbiAgICAgIGNvbnN0IGRlZmVycmVkID0gbS5kZWZlcnJlZCgpO1xuICAgICAgaWYgKHRva2VuKCkpe1xuICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHt0b2tlbjogdG9rZW4oKX0pO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIG0ucmVxdWVzdChhdXRoZW50aWNhdGlvbk9wdGlvbnMpLnRoZW4oKGRhdGEpID0+IHtcbiAgICAgICAgICB0b2tlbihkYXRhLnRva2VuKTtcbiAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHt0b2tlbjogdG9rZW4oKX0pO1xuICAgICAgICB9LCAoZGF0YSkgPT4geyBkZWZlcnJlZC5yZWplY3QoZGF0YSk7IH0pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfTtcblxuICAgIHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuID0gKG9wdGlvbnMpID0+IHtcbiAgICAgIHJldHVybiBtLnBvc3RncmVzdC5hdXRoZW50aWNhdGUoKS50aGVuKFxuICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIG0ucG9zdGdyZXN0LnJlcXVlc3QoYWRkQ29uZmlnSGVhZGVycyh7J0F1dGhvcml6YXRpb24nOiAnQmVhcmVyICcgKyB0b2tlbigpfSwgb3B0aW9ucykpO1xuICAgICAgICB9LFxuICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIG0ucG9zdGdyZXN0LnJlcXVlc3Qob3B0aW9ucyk7XG4gICAgICAgIH1cbiAgICAgICk7XG4gICAgfTtcblxuICAgIHBvc3RncmVzdC5tb2RlbCA9IChuYW1lKSA9PiB7XG4gICAgICBjb25zdCBwYWdpbmF0aW9uSGVhZGVycyA9IChwYWdlLCBwYWdlU2l6ZSkgPT4ge1xuICAgICAgICBpZiAoIXBhZ2VTaXplKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdG9SYW5nZSA9ICgpID0+IHtcbiAgICAgICAgICBjb25zdCBmcm9tID0gKHBhZ2UgLSAxKSAqIHBhZ2VTaXplLFxuICAgICAgICAgICAgdG8gPSBmcm9tICsgcGFnZVNpemUgLSAxO1xuICAgICAgICAgIHJldHVybiBmcm9tICsgJy0nICsgdG87XG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIHsnUmFuZ2UtdW5pdCc6ICdpdGVtcycsICdSYW5nZSc6IHRvUmFuZ2UoKX07XG4gICAgICB9LFxuXG4gICAgICBwYWdlU2l6ZSA9IG0ucHJvcCgxMCksXG5cbiAgICAgIG5hbWVPcHRpb25zID0ge3VybDogJy8nICsgbmFtZX0sXG5cbiAgICAgIGdldE9wdGlvbnMgPSAoZGF0YSwgcGFnZSwgcGFnZVNpemUsIG9wdGlvbnMsIGhlYWRlcnMgPSB7fSkgPT4ge1xuICAgICAgICBjb25zdCBleHRyYUhlYWRlcnMgPSBfLmV4dGVuZCh7fSwgeydQcmVmZXInOiAnY291bnQ9bm9uZSd9LCBoZWFkZXJzLCBwYWdpbmF0aW9uSGVhZGVycyhwYWdlLCBwYWdlU2l6ZSkpO1xuICAgICAgICByZXR1cm4gYWRkQ29uZmlnSGVhZGVycyhleHRyYUhlYWRlcnMsIF8uZXh0ZW5kKHt9LCBvcHRpb25zLCBuYW1lT3B0aW9ucywge21ldGhvZDogJ0dFVCcsIGRhdGE6IGRhdGF9KSk7XG4gICAgICB9LFxuXG4gICAgICBxdWVyeXN0cmluZyA9IChmaWx0ZXJzLCBvcHRpb25zKSA9PiB7XG4gICAgICAgIG9wdGlvbnMudXJsICs9ICc/JyArIG0ucm91dGUuYnVpbGRRdWVyeVN0cmluZyhmaWx0ZXJzKTtcbiAgICAgICAgcmV0dXJuIG9wdGlvbnM7XG4gICAgICB9LFxuXG4gICAgICBvcHRpb25zID0gKG9wdGlvbnMpID0+IHtcbiAgICAgICAgcmV0dXJuIG0ucG9zdGdyZXN0LnJlcXVlc3QoXy5leHRlbmQoe30sIG9wdGlvbnMsIG5hbWVPcHRpb25zLCB7bWV0aG9kOiAnT1BUSU9OUyd9KSk7XG4gICAgICB9LFxuXG4gICAgICBwb3N0T3B0aW9ucyA9IChhdHRyaWJ1dGVzLCBvcHRpb25zLCBoZWFkZXJzID0ge30pID0+IHtcbiAgICAgICAgY29uc3QgZXh0cmFIZWFkZXJzID0gXy5leHRlbmQoe30sIHJlcHJlc2VudGF0aW9uSGVhZGVyLCBoZWFkZXJzKTtcbiAgICAgICAgcmV0dXJuIGFkZENvbmZpZ0hlYWRlcnMoXG4gICAgICAgICAgZXh0cmFIZWFkZXJzLFxuICAgICAgICAgIF8uZXh0ZW5kKFxuICAgICAgICAgICAge30sXG4gICAgICAgICAgICBvcHRpb25zLFxuICAgICAgICAgICAgbmFtZU9wdGlvbnMsXG4gICAgICAgICAgICB7bWV0aG9kOiAnUE9TVCcsIGRhdGE6IGF0dHJpYnV0ZXN9XG4gICAgICAgICAgKVxuICAgICAgICApO1xuICAgICAgfSxcblxuICAgICAgZGVsZXRlT3B0aW9ucyA9IChmaWx0ZXJzLCBvcHRpb25zLCBoZWFkZXJzID0ge30pID0+IHtcbiAgICAgICAgY29uc3QgZXh0cmFIZWFkZXJzID0gYWRkSGVhZGVycyhfLmV4dGVuZCh7fSwgaGVhZGVycykpO1xuICAgICAgICByZXR1cm4gcXVlcnlzdHJpbmcoZmlsdGVycywgYWRkQ29uZmlnSGVhZGVycyhleHRyYUhlYWRlcnMsIF8uZXh0ZW5kKHt9LCBvcHRpb25zLCBuYW1lT3B0aW9ucywge21ldGhvZDogJ0RFTEVURSd9KSkpO1xuICAgICAgfSxcblxuICAgICAgcGF0Y2hPcHRpb25zID0gKGZpbHRlcnMsIGF0dHJpYnV0ZXMsIG9wdGlvbnMsIGhlYWRlcnMgPSB7fSkgPT4ge1xuICAgICAgICBjb25zdCBleHRyYUhlYWRlcnMgPSBfLmV4dGVuZCh7fSwgcmVwcmVzZW50YXRpb25IZWFkZXIsIGhlYWRlcnMpO1xuICAgICAgICByZXR1cm4gcXVlcnlzdHJpbmcoXG4gICAgICAgICAgZmlsdGVycyxcbiAgICAgICAgICBhZGRDb25maWdIZWFkZXJzKFxuICAgICAgICAgICAgZXh0cmFIZWFkZXJzLFxuICAgICAgICAgICAgXy5leHRlbmQoXG4gICAgICAgICAgICAgIHt9LFxuICAgICAgICAgICAgICBvcHRpb25zLFxuICAgICAgICAgICAgICBuYW1lT3B0aW9ucyxcbiAgICAgICAgICAgICAge21ldGhvZDogJ1BBVENIJywgZGF0YTogYXR0cmlidXRlc31cbiAgICAgICAgICAgIClcbiAgICAgICAgICApXG4gICAgICAgICk7XG4gICAgICB9LFxuXG4gICAgICBnZXRQYWdlT3B0aW9ucyA9IChkYXRhLCBwYWdlLCBvcHRpb25zLCBoZWFkZXJzID0ge30pID0+IHtcbiAgICAgICAgcmV0dXJuIGdldE9wdGlvbnMoZGF0YSwgKHBhZ2UgfHwgMSksIHBhZ2VTaXplKCksIG9wdGlvbnMsIGhlYWRlcnMpO1xuICAgICAgfSxcblxuICAgICAgZ2V0Um93T3B0aW9ucyA9IChkYXRhLCBvcHRpb25zLCBoZWFkZXJzID0ge30pID0+IHtcbiAgICAgICAgcmV0dXJuIGdldE9wdGlvbnMoZGF0YSwgMSwgMSwgb3B0aW9ucywgaGVhZGVycyk7XG4gICAgICB9O1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBwYWdlU2l6ZTogcGFnZVNpemUsXG4gICAgICAgIGdldFBhZ2VPcHRpb25zOiAgIGdldFBhZ2VPcHRpb25zLFxuICAgICAgICBnZXRSb3dPcHRpb25zOiAgICBnZXRSb3dPcHRpb25zLFxuICAgICAgICBwYXRjaE9wdGlvbnM6ICAgICBwYXRjaE9wdGlvbnMsXG4gICAgICAgIHBvc3RPcHRpb25zOiAgICAgIHBvc3RPcHRpb25zLFxuICAgICAgICBkZWxldGVPcHRpb25zOiAgICBkZWxldGVPcHRpb25zLFxuICAgICAgICBnZXRQYWdlOiAgICAgICAgICBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIGdldFBhZ2VPcHRpb25zKSxcbiAgICAgICAgZ2V0Um93OiAgICAgICAgICAgXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0LCBnZXRSb3dPcHRpb25zKSxcbiAgICAgICAgcGF0Y2g6ICAgICAgICAgICAgXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0LCBwYXRjaE9wdGlvbnMpLFxuICAgICAgICBwb3N0OiAgICAgICAgICAgICBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIHBvc3RPcHRpb25zKSxcbiAgICAgICAgZGVsZXRlUmVxdWVzdDogICAgXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0LCBkZWxldGVPcHRpb25zKSxcbiAgICAgICAgZ2V0UGFnZVdpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBnZXRQYWdlT3B0aW9ucyksXG4gICAgICAgIGdldFJvd1dpdGhUb2tlbjogIF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgZ2V0Um93T3B0aW9ucyksXG4gICAgICAgIHBhdGNoV2l0aFRva2VuOiAgIF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgcGF0Y2hPcHRpb25zKSxcbiAgICAgICAgcG9zdFdpdGhUb2tlbjogICAgXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBwb3N0T3B0aW9ucyksXG4gICAgICAgIGRlbGV0ZVdpdGhUb2tlbjogIF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgZGVsZXRlT3B0aW9ucyksXG4gICAgICAgIG9wdGlvbnM6IG9wdGlvbnNcbiAgICAgIH07XG4gICAgfTtcblxuICAgIHJldHVybiBwb3N0Z3Jlc3Q7XG4gIH07XG5cbiAgbS5wb3N0Z3Jlc3QgPSBwb3N0Z3Jlc3Q7XG59KSk7XG4iLCIoZnVuY3Rpb24oZmFjdG9yeSkge1xuICBpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG4gICAgLy8gTm9kZS9Db21tb25KU1xuICAgIGZhY3RvcnkocmVxdWlyZSgnbWl0aHJpbCcpLCByZXF1aXJlKCd1bmRlcnNjb3JlJykpO1xuICB9XG4gIGVsc2Uge1xuICAgIC8vIEJyb3dzZXIgZ2xvYmFsc1xuICAgIGZhY3Rvcnkod2luZG93Lm0sIHdpbmRvdy5fKTtcbiAgfVxufSgobSwgXykgPT4ge1xuICBtLnBvc3RncmVzdC5maWx0ZXJzVk0gPSAoYXR0cmlidXRlcykgPT4ge1xuICAgIHZhciBuZXdWTSA9IHt9LFxuICAgIGZpbHRlciA9ICgpID0+IHtcbiAgICAgIHZhciBwcm9wID0gbS5wcm9wKCcnKSxcbiAgICAgIGZpbHRlclByb3AgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDApe1xuICAgICAgICAgIHByb3AodmFsdWUpO1xuICAgICAgICAgIHJldHVybiBuZXdWTTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcHJvcCgpO1xuICAgICAgfTtcbiAgICAgIC8vIEp1c3Qgc28gd2UgY2FuIGhhdmUgYSBkZWZhdWx0IHRvX2ZpbHRlciBhbmQgYXZvaWQgaWYgXy5pc0Z1bmN0aW9uIGNhbGxzXG4gICAgICBmaWx0ZXJQcm9wLnRvRmlsdGVyID0gKCkgPT4ge1xuICAgICAgICByZXR1cm4gXy5pc1N0cmluZyhmaWx0ZXJQcm9wKCkpID8gZmlsdGVyUHJvcCgpLnRyaW0oKSA6IGZpbHRlclByb3AoKTtcbiAgICAgIH07XG4gICAgICByZXR1cm4gZmlsdGVyUHJvcDtcbiAgICB9LFxuXG4gICAgZ2V0dGVycyA9IF8ucmVkdWNlKFxuICAgICAgYXR0cmlidXRlcyxcbiAgICAgIChtZW1vLCBvcGVyYXRvciwgYXR0cikgPT4ge1xuICAgICAgICAvLyBUaGUgb3BlcmF0b3IgYmV0d2VlbiBpcyBpbXBsZW1lbnRlZCB3aXRoIHR3byBwcm9wZXJ0aWVzLCBvbmUgZm9yIGdyZWF0ZXIgdGhhbiB2YWx1ZSBhbmQgYW5vdGhlciBmb3IgbGVzc2VyIHRoYW4gdmFsdWUuXG4gICAgICAgIC8vIEJvdGggcHJvcGVydGllcyBhcmUgc2VudCBpbiB0aGUgcXVldXJ5c3RyaW5nIHdpdGggdGhlIHNhbWUgbmFtZSxcbiAgICAgICAgLy8gdGhhdCdzIHdoeSB3ZSBuZWVkIHRoZSBzcGVjaWFsIGNhc2UgaGVyZSwgc28gd2UgY2FuIHVzZSBhIHNpbXBsZSBtYXAgYXMgYXJndW1lbnQgdG8gZmlsdGVyc1ZNLlxuICAgICAgICBpZiAob3BlcmF0b3IgPT09ICdiZXR3ZWVuJyl7XG4gICAgICAgICAgbWVtb1thdHRyXSA9IHtsdGU6IGZpbHRlcigpLCBndGU6IGZpbHRlcigpfTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBtZW1vW2F0dHJdID0gZmlsdGVyKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICB9LFxuICAgICAge29yZGVyOiBtLnByb3AoKX1cbiAgICApLFxuXG4gICAgcGFyYW1ldGVyc1dpdGhvdXRPcmRlciA9ICgpID0+IHtcbiAgICAgIHJldHVybiBfLnJlZHVjZShcbiAgICAgICAgZ2V0dGVycyxcbiAgICAgICAgKG1lbW8sIGdldHRlciwgYXR0cikgPT4ge1xuICAgICAgICAgIGlmIChhdHRyICE9PSAnb3JkZXInKXtcbiAgICAgICAgICAgIHZhciBvcGVyYXRvciA9IGF0dHJpYnV0ZXNbYXR0cl07XG5cbiAgICAgICAgICAgIGlmIChfLmlzRnVuY3Rpb24oZ2V0dGVyLnRvRmlsdGVyKSAmJiAoZ2V0dGVyLnRvRmlsdGVyKCkgPT09IHVuZGVmaW5lZCB8fCBnZXR0ZXIudG9GaWx0ZXIoKSA9PT0gJycpKXsgcmV0dXJuIG1lbW87IH1cblxuICAgICAgICAgICAgLy8gQmVsbG93IHdlIHVzZSBkaWZmZXJlbnQgZm9ybWF0dGluZyBydWxlcyBmb3IgdGhlIHZhbHVlIGRlcGVuZGluZyBvbiB0aGUgb3BlcmF0b3JcbiAgICAgICAgICAgIC8vIFRoZXNlIHJ1bGVzIGFyZSB1c2VkIHJlZ2FyZGxlc3Mgb2YgdGhlIHRvRmlsdGVyIGZ1bmN0aW9uLFxuICAgICAgICAgICAgLy8gc28gdGhlIHVzZXIgY2FuIHVzZSBhIGN1c3RvbSB0b0ZpbHRlciB3aXRob3V0IGhhdmluZyB0byB3b3JyeSB3aXRoIGJhc2ljIGZpbHRlciBzeW50YXhcbiAgICAgICAgICAgIGlmIChvcGVyYXRvciA9PT0gJ2lsaWtlJyB8fCBvcGVyYXRvciA9PT0gJ2xpa2UnKXtcbiAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IG9wZXJhdG9yICsgJy4qJyArIGdldHRlci50b0ZpbHRlcigpICsgJyonO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAob3BlcmF0b3IgPT09ICdAQCcpIHtcbiAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IG9wZXJhdG9yICsgJy4nICsgZ2V0dGVyLnRvRmlsdGVyKCkucmVwbGFjZSgvXFxzKy9nLCAnJicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAob3BlcmF0b3IgPT09ICdiZXR3ZWVuJykge1xuICAgICAgICAgICAgICBpZiAoIWdldHRlci5sdGUudG9GaWx0ZXIoKSAmJiAhZ2V0dGVyLmd0ZS50b0ZpbHRlcigpKXsgcmV0dXJuIG1lbW87IH1cbiAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IFtdO1xuICAgICAgICAgICAgICBpZiAoZ2V0dGVyLmd0ZSgpKXtcbiAgICAgICAgICAgICAgICBtZW1vW2F0dHJdLnB1c2goJ2d0ZS4nICsgZ2V0dGVyLmd0ZS50b0ZpbHRlcigpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoZ2V0dGVyLmx0ZSgpKXtcbiAgICAgICAgICAgICAgICBtZW1vW2F0dHJdLnB1c2goJ2x0ZS4nICsgZ2V0dGVyLmx0ZS50b0ZpbHRlcigpKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIG1lbW9bYXR0cl0gPSBvcGVyYXRvciArICcuJyArIGdldHRlci50b0ZpbHRlcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgfSxcbiAgICAgICAge31cbiAgICAgICk7XG4gICAgfSxcblxuICAgIHBhcmFtZXRlcnMgPSAoKSA9PiB7XG4gICAgICAvLyBUaGUgb3JkZXIgcGFyYW1ldGVycyBoYXZlIGEgc3BlY2lhbCBzeW50YXggKGp1c3QgbGlrZSBhbiBvcmRlciBieSBTUUwgY2xhdXNlKVxuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2JlZ3JpZmZzL3Bvc3RncmVzdC93aWtpL1JvdXRpbmcjZmlsdGVyaW5nLWFuZC1vcmRlcmluZ1xuICAgICAgdmFyIG9yZGVyID0gKCkgPT4ge1xuICAgICAgICByZXR1cm4gZ2V0dGVycy5vcmRlcigpICYmIF8ucmVkdWNlKFxuICAgICAgICAgIGdldHRlcnMub3JkZXIoKSxcbiAgICAgICAgICAobWVtbywgZGlyZWN0aW9uLCBhdHRyKSA9PiB7XG4gICAgICAgICAgICBtZW1vLnB1c2goYXR0ciArICcuJyArIGRpcmVjdGlvbik7XG4gICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgICB9LFxuICAgICAgICAgIFtdXG4gICAgICAgICkuam9pbignLCcpO1xuICAgICAgfSxcblxuICAgICAgb3JkZXJQYXJhbWV0ZXIgPSBvcmRlcigpID8ge29yZGVyOiBvcmRlcigpfSA6IHt9O1xuXG4gICAgICByZXR1cm4gXy5leHRlbmQoe30sIG9yZGVyUGFyYW1ldGVyLCBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyKCkpO1xuXG4gICAgfTtcblxuICAgIHJldHVybiBfLmV4dGVuZChuZXdWTSwgZ2V0dGVycywge3BhcmFtZXRlcnM6IHBhcmFtZXRlcnMsIHBhcmFtZXRlcnNXaXRob3V0T3JkZXI6IHBhcmFtZXRlcnNXaXRob3V0T3JkZXJ9KTtcbiAgfTtcbn0pKTtcbiIsIihmdW5jdGlvbihmYWN0b3J5KSB7XG4gIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcpIHtcbiAgICAvLyBOb2RlL0NvbW1vbkpTXG4gICAgZmFjdG9yeShyZXF1aXJlKCdtaXRocmlsJyksIHJlcXVpcmUoJ3VuZGVyc2NvcmUnKSk7XG4gIH0gZWxzZSB7XG4gICAgLy8gQnJvd3NlciBnbG9iYWxzXG4gICAgZmFjdG9yeSh3aW5kb3cubSwgd2luZG93Ll8pO1xuICB9XG59KGZ1bmN0aW9uKG0sIF8pIHtcbiAgbS5wb3N0Z3Jlc3QucGFnaW5hdGlvblZNID0gKG1vZGVsLCBvcmRlciwgYXV0aGVudGljYXRlID0gdHJ1ZSkgPT4ge1xuICAgIGxldCBjb2xsZWN0aW9uID0gbS5wcm9wKFtdKSxcbiAgICAgIGRlZmF1bHRPcmRlciA9IG9yZGVyIHx8ICdpZC5kZXNjJyxcbiAgICAgIGZpbHRlcnMgPSBtLnByb3Aoe29yZGVyOiBkZWZhdWx0T3JkZXJ9KSxcbiAgICAgIGlzTG9hZGluZyA9IG0ucHJvcChmYWxzZSksXG4gICAgICBwYWdlID0gbS5wcm9wKDEpLFxuICAgICAgcmVzdWx0c0NvdW50ID0gbS5wcm9wKCksXG4gICAgICBwYWdlUmVxdWVzdCA9IGF1dGhlbnRpY2F0ZSA/IG1vZGVsLmdldFBhZ2VXaXRoVG9rZW4gOiBtb2RlbC5nZXRQYWdlLFxuICAgICAgdG90YWwgPSBtLnByb3AoKTtcblxuICAgIGNvbnN0IGZldGNoID0gKCkgPT4ge1xuICAgICAgbGV0IGQgPSBtLmRlZmVycmVkKCk7XG4gICAgICBjb25zdCBnZXRUb3RhbCA9ICh4aHIpID0+IHtcbiAgICAgICAgaWYgKCF4aHIgfHwgeGhyLnN0YXR1cyA9PT0gMCl7XG4gICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtoaW50OiBudWxsLCBkZXRhaWxzOiBudWxsLCBjb2RlOiAwLCBtZXNzYWdlOiAnQ29ubmVjdGlvbiBlcnJvcid9KTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgcmFuZ2VIZWFkZXIgPSB4aHIuZ2V0UmVzcG9uc2VIZWFkZXIoJ0NvbnRlbnQtUmFuZ2UnKTtcbiAgICAgICAgaWYgKF8uaXNTdHJpbmcocmFuZ2VIZWFkZXIpKXtcbiAgICAgICAgICBsZXQgW3NpemUsIGNvdW50XSA9IHJhbmdlSGVhZGVyLnNwbGl0KCcvJyksXG4gICAgICAgICAgICAgIFtmcm9tLCB0b10gPSBzaXplLnNwbGl0KCctJyk7XG5cbiAgICAgICAgICB0b3RhbChwYXJzZUludChjb3VudCkpO1xuICAgICAgICAgIHJlc3VsdHNDb3VudCgocGFyc2VJbnQodG8pIC0gcGFyc2VJbnQoZnJvbSkgKyAxKSk7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBKU09OLnBhcnNlKHhoci5yZXNwb25zZVRleHQpO1xuICAgICAgICAgIHJldHVybiB4aHIucmVzcG9uc2VUZXh0O1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChleCl7XG4gICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtoaW50OiBudWxsLCBkZXRhaWxzOiBudWxsLCBjb2RlOiAwLCBtZXNzYWdlOiB4aHIucmVzcG9uc2VUZXh0fSk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBpc0xvYWRpbmcodHJ1ZSk7XG4gICAgICBwYWdlUmVxdWVzdChmaWx0ZXJzKCksIHBhZ2UoKSwge2JhY2tncm91bmQ6IHRydWUsIGV4dHJhY3Q6IGdldFRvdGFsfSwgeydQcmVmZXInOiAnY291bnQ9ZXhhY3QnfSkudGhlbigoZGF0YSkgPT4ge1xuICAgICAgICBjb2xsZWN0aW9uKF8udW5pb24oY29sbGVjdGlvbigpLCBkYXRhKSk7XG4gICAgICAgIGlzTG9hZGluZyhmYWxzZSk7XG4gICAgICAgIGQucmVzb2x2ZShjb2xsZWN0aW9uKCkpO1xuICAgICAgICBtLnJlZHJhdygpO1xuICAgICAgfSxcbiAgICAgIChlcnJvcikgPT4ge1xuICAgICAgICBpc0xvYWRpbmcoZmFsc2UpO1xuICAgICAgICB0b3RhbCgwKTtcbiAgICAgICAgZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICBtLnJlZHJhdygpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gZC5wcm9taXNlO1xuICAgIH0sXG5cbiAgICBmaXJzdFBhZ2UgPSAocGFyYW1ldGVycykgPT4ge1xuICAgICAgZmlsdGVycyhfLmV4dGVuZCh7b3JkZXI6IGRlZmF1bHRPcmRlcn0sIHBhcmFtZXRlcnMpKTtcbiAgICAgIGNvbGxlY3Rpb24oW10pO1xuICAgICAgcGFnZSgxKTtcbiAgICAgIHJldHVybiBmZXRjaCgpO1xuICAgIH0sXG5cbiAgICBpc0xhc3RQYWdlID0gKCkgPT4ge1xuICAgICAgcmV0dXJuIChwYWdlKCkgKiBtb2RlbC5wYWdlU2l6ZSgpID49IHRvdGFsKCkpO1xuICAgIH0sXG5cbiAgICBuZXh0UGFnZSA9ICgpID0+IHtcbiAgICAgIHBhZ2UocGFnZSgpICsgMSk7XG4gICAgICByZXR1cm4gZmV0Y2goKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbGxlY3Rpb246IGNvbGxlY3Rpb24sXG4gICAgICBmaXJzdFBhZ2U6IGZpcnN0UGFnZSxcbiAgICAgIGlzTG9hZGluZzogaXNMb2FkaW5nLFxuICAgICAgbmV4dFBhZ2U6IG5leHRQYWdlLFxuICAgICAgaXNMYXN0UGFnZTogaXNMYXN0UGFnZSxcbiAgICAgIHRvdGFsOiB0b3RhbCxcbiAgICAgIHJlc3VsdHNDb3VudDogcmVzdWx0c0NvdW50XG4gICAgfTtcbiAgfTtcblxufSkpO1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9