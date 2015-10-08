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
        resultsCount = m.prop(10),
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
          resultsCount(parseInt(from) - parseInt(to));
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
      total: total
    };
  };
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1pdGhyaWwucG9zdGdyZXN0LmpzIiwidm1zL2ZpbHRlcnNWTS5qcyIsInZtcy9wYWdpbmF0aW9uVk0uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxBQUFDLENBQUEsVUFBUyxPQUFPLEVBQUU7QUFDakIsTUFBSSxPQUFPLE9BQU8sS0FBSyxRQUFRLEVBQUU7O0FBRS9CLFdBQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEVBQUUsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7R0FDcEQsTUFBTTs7QUFFTCxXQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7R0FDN0I7Q0FDRixDQUFBLENBQUMsVUFBQyxDQUFDLEVBQUUsQ0FBQyxFQUFLO0FBQ1YsTUFBSSxTQUFTLEdBQUcsRUFBRSxDQUFDOztBQUVuQixNQUFNLEtBQUssR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFO01BRXRCLFdBQVcsR0FBRyxTQUFkLFdBQVcsQ0FBSSxNQUFNLEVBQUUsT0FBTyxFQUFLO0FBQ2pDLFdBQU8sT0FBTyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUM7R0FDN0Y7TUFFRCxVQUFVLEdBQUcsU0FBYixVQUFVLENBQUksT0FBTyxFQUFLO0FBQ3hCLFdBQU8sVUFBQyxHQUFHLEVBQUs7QUFDZCxPQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxVQUFDLEtBQUssRUFBRSxHQUFHLEVBQUs7QUFDOUIsV0FBRyxDQUFDLGdCQUFnQixDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQztPQUNsQyxDQUFDLENBQUM7QUFDSCxhQUFPLEdBQUcsQ0FBQztLQUNaLENBQUM7R0FDSDtNQUVELGdCQUFnQixHQUFHLFNBQW5CLGdCQUFnQixDQUFJLE9BQU8s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QyxPQUFPLENBQUM7S0FDbEI7UUFFRCxTQUFTLEdBQUcsU0FBWixTQUFTLENBQUksVUFBVSxFQUFLO0FBQzFCLGFBQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUMsS0FBSyxFQUFFLFlBQVksRUFBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7QUFDckQsZ0JBQVUsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUNmLFVBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNSLGFBQU8sS0FBSyxFQUFFLENBQUM7S0FDaEI7UUFFRCxVQUFVLEdBQUcsU0FBYixVQUFVLEdBQVM7QUFDakIsYUFBUSxJQUFJLEVBQUUsR0FBRyxLQUFLLENBQUMsUUFBUSxFQUFFLElBQUksS0FBSyxFQUFFLENBQUU7S0FDL0M7UUFFRCxRQUFRLEdBQUcsU0FBWCxRQUFRLEdBQVM7QUFDZixVQUFJLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDakIsYUFBTyxLQUFLLEVBQUUsQ0FBQztLQUNoQixDQUFDOztBQUVGLFdBQU87QUFDTCxnQkFBVSxFQUFFLFVBQVU7QUFDdEIsZUFBUyxFQUFFLFNBQVM7QUFDcEIsZUFBUyxFQUFFLFNBQVM7QUFDcEIsY0FBUSxFQUFFLFFBQVE7QUFDbEIsZ0JBQVUsRUFBRSxVQUFVO0FBQ3RCLFdBQUssRUFBRSxLQUFLO0tBQ2IsQ0FBQztHQUNILENBQUM7Q0FFSCxDQUFDLENBQUUiLCJmaWxlIjoibWl0aHJpbC5wb3N0Z3Jlc3QuanMiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oZmFjdG9yeSkge1xuICBpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG4gICAgLy8gTm9kZS9Db21tb25KU1xuICAgIGZhY3RvcnkocmVxdWlyZSgnbWl0aHJpbCcpLCByZXF1aXJlKCd1bmRlcnNjb3JlJykpO1xuICB9IGVsc2Uge1xuICAgIC8vIEJyb3dzZXIgZ2xvYmFsc1xuICAgIGZhY3Rvcnkod2luZG93Lm0sIHdpbmRvdy5fKTtcbiAgfVxufSgobSwgXykgPT4ge1xuICBsZXQgcG9zdGdyZXN0ID0ge307XG5cbiAgY29uc3QgdG9rZW4gPSBtLnByb3AoKSxcblxuICBtZXJnZUNvbmZpZyA9IChjb25maWcsIG9wdGlvbnMpID0+IHtcbiAgICByZXR1cm4gb3B0aW9ucyAmJiBfLmlzRnVuY3Rpb24ob3B0aW9ucy5jb25maWcpID8gXy5jb21wb3NlKG9wdGlvbnMuY29uZmlnLCBjb25maWcpIDogY29uZmlnO1xuICB9LFxuXG4gIGFkZEhlYWRlcnMgPSAoaGVhZGVycykgPT4ge1xuICAgIHJldHVybiAoeGhyKSA9PiB7XG4gICAgICBfLmVhY2goaGVhZGVycywgKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoa2V5LCB2YWx1ZSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiB4aHI7XG4gICAgfTtcbiAgfSxcblxuICBhZGRDb25maWdIZWFkZXJzID0gKGhlYWRlcnMsIG9wdGlvbnMpID0+IHtcbiAgICByZXR1cm4gXy5leHRlbmQoe30sIG9wdGlvbnMsIHtjb25maWc6IG1lcmdlQ29uZmlnKGFkZEhlYWRlcnMoaGVhZGVycyksIG9wdGlvbnMpfSk7XG4gIH0sXG5cbiAgcmVwcmVzZW50YXRpb25IZWFkZXIgPSB7J1ByZWZlcic6ICdyZXR1cm49cmVwcmVzZW50YXRpb24nfTtcblxuICBwb3N0Z3Jlc3QudG9rZW4gPSB0b2tlbjtcblxuICBwb3N0Z3Jlc3QubG9hZGVyID0gKG9wdGlvbnMsIHJlcXVlc3RGdW5jdGlvbiwgZGVmYXVsdFN0YXRlID0gZmFsc2UpID0+IHtcbiAgICBjb25zdCBsb2FkZXIgPSBtLnByb3AoZGVmYXVsdFN0YXRlKSwgZCA9IG0uZGVmZXJyZWQoKTtcbiAgICBsb2FkZXIubG9hZCA9ICgpID0+IHtcbiAgICAgIGxvYWRlcih0cnVlKTtcbiAgICAgIG0ucmVkcmF3KCk7XG4gICAgICBtLnN0YXJ0Q29tcHV0YXRpb24oKTtcbiAgICAgIHJlcXVlc3RGdW5jdGlvbihfLmV4dGVuZCh7fSwgb3B0aW9ucywge2JhY2tncm91bmQ6IHRydWV9KSkudGhlbigoZGF0YSkgPT4ge1xuICAgICAgICBsb2FkZXIoZmFsc2UpO1xuICAgICAgICBkLnJlc29sdmUoZGF0YSk7XG4gICAgICAgIG0uZW5kQ29tcHV0YXRpb24oKTtcbiAgICAgIH0sIChlcnJvcikgPT4ge1xuICAgICAgICBsb2FkZXIoZmFsc2UpO1xuICAgICAgICBkLnJlamVjdChlcnJvcik7XG4gICAgICAgIG0uZW5kQ29tcHV0YXRpb24oKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGQucHJvbWlzZTtcbiAgICB9O1xuICAgIHJldHVybiBsb2FkZXI7XG4gIH07XG5cbiAgcG9zdGdyZXN0LmxvYWRlcldpdGhUb2tlbiA9IChvcHRpb25zLCBkZWZhdWx0U3RhdGUpID0+IHtcbiAgICByZXR1cm4gcG9zdGdyZXN0LmxvYWRlcihvcHRpb25zLCBwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgZGVmYXVsdFN0YXRlKTtcbiAgfTtcblxuICBwb3N0Z3Jlc3QuaW5pdCA9IChhcGlQcmVmaXgsIGF1dGhlbnRpY2F0aW9uT3B0aW9ucykgPT4ge1xuICAgIHBvc3RncmVzdC5yZXF1ZXN0ID0gKG9wdGlvbnMpID0+IHtcbiAgICAgIHJldHVybiBtLnJlcXVlc3QoXy5leHRlbmQoe30sIG9wdGlvbnMsIHt1cmw6IGFwaVByZWZpeCArIG9wdGlvbnMudXJsfSkpO1xuICAgIH07XG5cbiAgICBwb3N0Z3Jlc3QuYXV0aGVudGljYXRlID0gKCkgPT4ge1xuICAgICAgY29uc3QgZGVmZXJyZWQgPSBtLmRlZmVycmVkKCk7XG4gICAgICBpZiAodG9rZW4oKSl7XG4gICAgICAgIGRlZmVycmVkLnJlc29sdmUoe3Rva2VuOiB0b2tlbigpfSk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgbS5yZXF1ZXN0KGF1dGhlbnRpY2F0aW9uT3B0aW9ucykudGhlbigoZGF0YSkgPT4ge1xuICAgICAgICAgIHRva2VuKGRhdGEudG9rZW4pO1xuICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUoe3Rva2VuOiB0b2tlbigpfSk7XG4gICAgICAgIH0sIChkYXRhKSA9PiB7IGRlZmVycmVkLnJlamVjdChkYXRhKTsgfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9O1xuXG4gICAgcG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4gPSAob3B0aW9ucykgPT4ge1xuICAgICAgcmV0dXJuIG0ucG9zdGdyZXN0LmF1dGhlbnRpY2F0ZSgpLnRoZW4oXG4gICAgICAgICgpID0+IHtcbiAgICAgICAgICByZXR1cm4gbS5wb3N0Z3Jlc3QucmVxdWVzdChhZGRDb25maWdIZWFkZXJzKHsnQXV0aG9yaXphdGlvbic6ICdCZWFyZXIgJyArIHRva2VuKCl9LCBvcHRpb25zKSk7XG4gICAgICAgIH0sXG4gICAgICAgICgpID0+IHtcbiAgICAgICAgICByZXR1cm4gbS5wb3N0Z3Jlc3QucmVxdWVzdChvcHRpb25zKTtcbiAgICAgICAgfVxuICAgICAgKTtcbiAgICB9O1xuXG4gICAgcG9zdGdyZXN0Lm1vZGVsID0gKG5hbWUpID0+IHtcbiAgICAgIGNvbnN0IHBhZ2luYXRpb25IZWFkZXJzID0gKHBhZ2UsIHBhZ2VTaXplKSA9PiB7XG4gICAgICAgIGlmICghcGFnZVNpemUpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB0b1JhbmdlID0gKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGZyb20gPSAocGFnZSAtIDEpICogcGFnZVNpemUsXG4gICAgICAgICAgICB0byA9IGZyb20gKyBwYWdlU2l6ZSAtIDE7XG4gICAgICAgICAgcmV0dXJuIGZyb20gKyAnLScgKyB0bztcbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4geydSYW5nZS11bml0JzogJ2l0ZW1zJywgJ1JhbmdlJzogdG9SYW5nZSgpfTtcbiAgICAgIH0sXG5cbiAgICAgIHBhZ2VTaXplID0gbS5wcm9wKDEwKSxcblxuICAgICAgbmFtZU9wdGlvbnMgPSB7dXJsOiAnLycgKyBuYW1lfSxcblxuICAgICAgZ2V0T3B0aW9ucyA9IChkYXRhLCBwYWdlLCBwYWdlU2l6ZSwgb3B0aW9ucywgaGVhZGVycyA9IHt9KSA9PiB7XG4gICAgICAgIGNvbnN0IGV4dHJhSGVhZGVycyA9IF8uZXh0ZW5kKHt9LCB7J1ByZWZlcic6ICdjb3VudD1ub25lJ30sIGhlYWRlcnMsIHBhZ2luYXRpb25IZWFkZXJzKHBhZ2UsIHBhZ2VTaXplKSk7XG4gICAgICAgIHJldHVybiBhZGRDb25maWdIZWFkZXJzKGV4dHJhSGVhZGVycywgXy5leHRlbmQoe30sIG9wdGlvbnMsIG5hbWVPcHRpb25zLCB7bWV0aG9kOiAnR0VUJywgZGF0YTogZGF0YX0pKTtcbiAgICAgIH0sXG5cbiAgICAgIHF1ZXJ5c3RyaW5nID0gKGZpbHRlcnMsIG9wdGlvbnMpID0+IHtcbiAgICAgICAgb3B0aW9ucy51cmwgKz0gJz8nICsgbS5yb3V0ZS5idWlsZFF1ZXJ5U3RyaW5nKGZpbHRlcnMpO1xuICAgICAgICByZXR1cm4gb3B0aW9ucztcbiAgICAgIH0sXG5cbiAgICAgIG9wdGlvbnMgPSAob3B0aW9ucykgPT4ge1xuICAgICAgICByZXR1cm4gbS5wb3N0Z3Jlc3QucmVxdWVzdChfLmV4dGVuZCh7fSwgb3B0aW9ucywgbmFtZU9wdGlvbnMsIHttZXRob2Q6ICdPUFRJT05TJ30pKTtcbiAgICAgIH0sXG5cbiAgICAgIHBvc3RPcHRpb25zID0gKGF0dHJpYnV0ZXMsIG9wdGlvbnMsIGhlYWRlcnMgPSB7fSkgPT4ge1xuICAgICAgICBjb25zdCBleHRyYUhlYWRlcnMgPSBfLmV4dGVuZCh7fSwgcmVwcmVzZW50YXRpb25IZWFkZXIsIGhlYWRlcnMpO1xuICAgICAgICByZXR1cm4gYWRkQ29uZmlnSGVhZGVycyhcbiAgICAgICAgICBleHRyYUhlYWRlcnMsXG4gICAgICAgICAgXy5leHRlbmQoXG4gICAgICAgICAgICB7fSxcbiAgICAgICAgICAgIG9wdGlvbnMsXG4gICAgICAgICAgICBuYW1lT3B0aW9ucyxcbiAgICAgICAgICAgIHttZXRob2Q6ICdQT1NUJywgZGF0YTogYXR0cmlidXRlc31cbiAgICAgICAgICApXG4gICAgICAgICk7XG4gICAgICB9LFxuXG4gICAgICBkZWxldGVPcHRpb25zID0gKGZpbHRlcnMsIG9wdGlvbnMsIGhlYWRlcnMgPSB7fSkgPT4ge1xuICAgICAgICBjb25zdCBleHRyYUhlYWRlcnMgPSBhZGRIZWFkZXJzKF8uZXh0ZW5kKHt9LCBoZWFkZXJzKSk7XG4gICAgICAgIHJldHVybiBxdWVyeXN0cmluZyhmaWx0ZXJzLCBhZGRDb25maWdIZWFkZXJzKGV4dHJhSGVhZGVycywgXy5leHRlbmQoe30sIG9wdGlvbnMsIG5hbWVPcHRpb25zLCB7bWV0aG9kOiAnREVMRVRFJ30pKSk7XG4gICAgICB9LFxuXG4gICAgICBwYXRjaE9wdGlvbnMgPSAoZmlsdGVycywgYXR0cmlidXRlcywgb3B0aW9ucywgaGVhZGVycyA9IHt9KSA9PiB7XG4gICAgICAgIGNvbnN0IGV4dHJhSGVhZGVycyA9IF8uZXh0ZW5kKHt9LCByZXByZXNlbnRhdGlvbkhlYWRlciwgaGVhZGVycyk7XG4gICAgICAgIHJldHVybiBxdWVyeXN0cmluZyhcbiAgICAgICAgICBmaWx0ZXJzLFxuICAgICAgICAgIGFkZENvbmZpZ0hlYWRlcnMoXG4gICAgICAgICAgICBleHRyYUhlYWRlcnMsXG4gICAgICAgICAgICBfLmV4dGVuZChcbiAgICAgICAgICAgICAge30sXG4gICAgICAgICAgICAgIG9wdGlvbnMsXG4gICAgICAgICAgICAgIG5hbWVPcHRpb25zLFxuICAgICAgICAgICAgICB7bWV0aG9kOiAnUEFUQ0gnLCBkYXRhOiBhdHRyaWJ1dGVzfVxuICAgICAgICAgICAgKVxuICAgICAgICAgIClcbiAgICAgICAgKTtcbiAgICAgIH0sXG5cbiAgICAgIGdldFBhZ2VPcHRpb25zID0gKGRhdGEsIHBhZ2UsIG9wdGlvbnMsIGhlYWRlcnMgPSB7fSkgPT4ge1xuICAgICAgICByZXR1cm4gZ2V0T3B0aW9ucyhkYXRhLCAocGFnZSB8fCAxKSwgcGFnZVNpemUoKSwgb3B0aW9ucywgaGVhZGVycyk7XG4gICAgICB9LFxuXG4gICAgICBnZXRSb3dPcHRpb25zID0gKGRhdGEsIG9wdGlvbnMsIGhlYWRlcnMgPSB7fSkgPT4ge1xuICAgICAgICByZXR1cm4gZ2V0T3B0aW9ucyhkYXRhLCAxLCAxLCBvcHRpb25zLCBoZWFkZXJzKTtcbiAgICAgIH07XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHBhZ2VTaXplOiBwYWdlU2l6ZSxcbiAgICAgICAgZ2V0UGFnZU9wdGlvbnM6ICAgZ2V0UGFnZU9wdGlvbnMsXG4gICAgICAgIGdldFJvd09wdGlvbnM6ICAgIGdldFJvd09wdGlvbnMsXG4gICAgICAgIHBhdGNoT3B0aW9uczogICAgIHBhdGNoT3B0aW9ucyxcbiAgICAgICAgcG9zdE9wdGlvbnM6ICAgICAgcG9zdE9wdGlvbnMsXG4gICAgICAgIGRlbGV0ZU9wdGlvbnM6ICAgIGRlbGV0ZU9wdGlvbnMsXG4gICAgICAgIGdldFBhZ2U6ICAgICAgICAgIF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgZ2V0UGFnZU9wdGlvbnMpLFxuICAgICAgICBnZXRSb3c6ICAgICAgICAgICBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIGdldFJvd09wdGlvbnMpLFxuICAgICAgICBwYXRjaDogICAgICAgICAgICBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIHBhdGNoT3B0aW9ucyksXG4gICAgICAgIHBvc3Q6ICAgICAgICAgICAgIF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgcG9zdE9wdGlvbnMpLFxuICAgICAgICBkZWxldGVSZXF1ZXN0OiAgICBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIGRlbGV0ZU9wdGlvbnMpLFxuICAgICAgICBnZXRQYWdlV2l0aFRva2VuOiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIGdldFBhZ2VPcHRpb25zKSxcbiAgICAgICAgZ2V0Um93V2l0aFRva2VuOiAgXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBnZXRSb3dPcHRpb25zKSxcbiAgICAgICAgcGF0Y2hXaXRoVG9rZW46ICAgXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBwYXRjaE9wdGlvbnMpLFxuICAgICAgICBwb3N0V2l0aFRva2VuOiAgICBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIHBvc3RPcHRpb25zKSxcbiAgICAgICAgZGVsZXRlV2l0aFRva2VuOiAgXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBkZWxldGVPcHRpb25zKSxcbiAgICAgICAgb3B0aW9uczogb3B0aW9uc1xuICAgICAgfTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIHBvc3RncmVzdDtcbiAgfTtcblxuICBtLnBvc3RncmVzdCA9IHBvc3RncmVzdDtcbn0pKTtcbiIsIihmdW5jdGlvbihmYWN0b3J5KSB7XG4gIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcpIHtcbiAgICAvLyBOb2RlL0NvbW1vbkpTXG4gICAgZmFjdG9yeShyZXF1aXJlKCdtaXRocmlsJyksIHJlcXVpcmUoJ3VuZGVyc2NvcmUnKSk7XG4gIH1cbiAgZWxzZSB7XG4gICAgLy8gQnJvd3NlciBnbG9iYWxzXG4gICAgZmFjdG9yeSh3aW5kb3cubSwgd2luZG93Ll8pO1xuICB9XG59KChtLCBfKSA9PiB7XG4gIG0ucG9zdGdyZXN0LmZpbHRlcnNWTSA9IChhdHRyaWJ1dGVzKSA9PiB7XG4gICAgdmFyIG5ld1ZNID0ge30sXG4gICAgZmlsdGVyID0gKCkgPT4ge1xuICAgICAgdmFyIHByb3AgPSBtLnByb3AoJycpLFxuICAgICAgZmlsdGVyUHJvcCA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMCl7XG4gICAgICAgICAgcHJvcCh2YWx1ZSk7XG4gICAgICAgICAgcmV0dXJuIG5ld1ZNO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwcm9wKCk7XG4gICAgICB9O1xuICAgICAgLy8gSnVzdCBzbyB3ZSBjYW4gaGF2ZSBhIGRlZmF1bHQgdG9fZmlsdGVyIGFuZCBhdm9pZCBpZiBfLmlzRnVuY3Rpb24gY2FsbHNcbiAgICAgIGZpbHRlclByb3AudG9GaWx0ZXIgPSAoKSA9PiB7XG4gICAgICAgIHJldHVybiBfLmlzU3RyaW5nKGZpbHRlclByb3AoKSkgPyBmaWx0ZXJQcm9wKCkudHJpbSgpIDogZmlsdGVyUHJvcCgpO1xuICAgICAgfTtcbiAgICAgIHJldHVybiBmaWx0ZXJQcm9wO1xuICAgIH0sXG5cbiAgICBnZXR0ZXJzID0gXy5yZWR1Y2UoXG4gICAgICBhdHRyaWJ1dGVzLFxuICAgICAgKG1lbW8sIG9wZXJhdG9yLCBhdHRyKSA9PiB7XG4gICAgICAgIC8vIFRoZSBvcGVyYXRvciBiZXR3ZWVuIGlzIGltcGxlbWVudGVkIHdpdGggdHdvIHByb3BlcnRpZXMsIG9uZSBmb3IgZ3JlYXRlciB0aGFuIHZhbHVlIGFuZCBhbm90aGVyIGZvciBsZXNzZXIgdGhhbiB2YWx1ZS5cbiAgICAgICAgLy8gQm90aCBwcm9wZXJ0aWVzIGFyZSBzZW50IGluIHRoZSBxdWV1cnlzdHJpbmcgd2l0aCB0aGUgc2FtZSBuYW1lLFxuICAgICAgICAvLyB0aGF0J3Mgd2h5IHdlIG5lZWQgdGhlIHNwZWNpYWwgY2FzZSBoZXJlLCBzbyB3ZSBjYW4gdXNlIGEgc2ltcGxlIG1hcCBhcyBhcmd1bWVudCB0byBmaWx0ZXJzVk0uXG4gICAgICAgIGlmIChvcGVyYXRvciA9PT0gJ2JldHdlZW4nKXtcbiAgICAgICAgICBtZW1vW2F0dHJdID0ge2x0ZTogZmlsdGVyKCksIGd0ZTogZmlsdGVyKCl9O1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIG1lbW9bYXR0cl0gPSBmaWx0ZXIoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgIH0sXG4gICAgICB7b3JkZXI6IG0ucHJvcCgpfVxuICAgICksXG5cbiAgICBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyID0gKCkgPT4ge1xuICAgICAgcmV0dXJuIF8ucmVkdWNlKFxuICAgICAgICBnZXR0ZXJzLFxuICAgICAgICAobWVtbywgZ2V0dGVyLCBhdHRyKSA9PiB7XG4gICAgICAgICAgaWYgKGF0dHIgIT09ICdvcmRlcicpe1xuICAgICAgICAgICAgdmFyIG9wZXJhdG9yID0gYXR0cmlidXRlc1thdHRyXTtcblxuICAgICAgICAgICAgaWYgKF8uaXNGdW5jdGlvbihnZXR0ZXIudG9GaWx0ZXIpICYmIChnZXR0ZXIudG9GaWx0ZXIoKSA9PT0gdW5kZWZpbmVkIHx8IGdldHRlci50b0ZpbHRlcigpID09PSAnJykpeyByZXR1cm4gbWVtbzsgfVxuXG4gICAgICAgICAgICAvLyBCZWxsb3cgd2UgdXNlIGRpZmZlcmVudCBmb3JtYXR0aW5nIHJ1bGVzIGZvciB0aGUgdmFsdWUgZGVwZW5kaW5nIG9uIHRoZSBvcGVyYXRvclxuICAgICAgICAgICAgLy8gVGhlc2UgcnVsZXMgYXJlIHVzZWQgcmVnYXJkbGVzcyBvZiB0aGUgdG9GaWx0ZXIgZnVuY3Rpb24sXG4gICAgICAgICAgICAvLyBzbyB0aGUgdXNlciBjYW4gdXNlIGEgY3VzdG9tIHRvRmlsdGVyIHdpdGhvdXQgaGF2aW5nIHRvIHdvcnJ5IHdpdGggYmFzaWMgZmlsdGVyIHN5bnRheFxuICAgICAgICAgICAgaWYgKG9wZXJhdG9yID09PSAnaWxpa2UnIHx8IG9wZXJhdG9yID09PSAnbGlrZScpe1xuICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gb3BlcmF0b3IgKyAnLionICsgZ2V0dGVyLnRvRmlsdGVyKCkgKyAnKic7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChvcGVyYXRvciA9PT0gJ0BAJykge1xuICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gb3BlcmF0b3IgKyAnLicgKyBnZXR0ZXIudG9GaWx0ZXIoKS5yZXBsYWNlKC9cXHMrL2csICcmJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChvcGVyYXRvciA9PT0gJ2JldHdlZW4nKSB7XG4gICAgICAgICAgICAgIGlmICghZ2V0dGVyLmx0ZS50b0ZpbHRlcigpICYmICFnZXR0ZXIuZ3RlLnRvRmlsdGVyKCkpeyByZXR1cm4gbWVtbzsgfVxuICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gW107XG4gICAgICAgICAgICAgIGlmIChnZXR0ZXIuZ3RlKCkpe1xuICAgICAgICAgICAgICAgIG1lbW9bYXR0cl0ucHVzaCgnZ3RlLicgKyBnZXR0ZXIuZ3RlLnRvRmlsdGVyKCkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChnZXR0ZXIubHRlKCkpe1xuICAgICAgICAgICAgICAgIG1lbW9bYXR0cl0ucHVzaCgnbHRlLicgKyBnZXR0ZXIubHRlLnRvRmlsdGVyKCkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IG9wZXJhdG9yICsgJy4nICsgZ2V0dGVyLnRvRmlsdGVyKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICB9LFxuICAgICAgICB7fVxuICAgICAgKTtcbiAgICB9LFxuXG4gICAgcGFyYW1ldGVycyA9ICgpID0+IHtcbiAgICAgIC8vIFRoZSBvcmRlciBwYXJhbWV0ZXJzIGhhdmUgYSBzcGVjaWFsIHN5bnRheCAoanVzdCBsaWtlIGFuIG9yZGVyIGJ5IFNRTCBjbGF1c2UpXG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vYmVncmlmZnMvcG9zdGdyZXN0L3dpa2kvUm91dGluZyNmaWx0ZXJpbmctYW5kLW9yZGVyaW5nXG4gICAgICB2YXIgb3JkZXIgPSAoKSA9PiB7XG4gICAgICAgIHJldHVybiBnZXR0ZXJzLm9yZGVyKCkgJiYgXy5yZWR1Y2UoXG4gICAgICAgICAgZ2V0dGVycy5vcmRlcigpLFxuICAgICAgICAgIChtZW1vLCBkaXJlY3Rpb24sIGF0dHIpID0+IHtcbiAgICAgICAgICAgIG1lbW8ucHVzaChhdHRyICsgJy4nICsgZGlyZWN0aW9uKTtcbiAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgW11cbiAgICAgICAgKS5qb2luKCcsJyk7XG4gICAgICB9LFxuXG4gICAgICBvcmRlclBhcmFtZXRlciA9IG9yZGVyKCkgPyB7b3JkZXI6IG9yZGVyKCl9IDoge307XG5cbiAgICAgIHJldHVybiBfLmV4dGVuZCh7fSwgb3JkZXJQYXJhbWV0ZXIsIHBhcmFtZXRlcnNXaXRob3V0T3JkZXIoKSk7XG5cbiAgICB9O1xuXG4gICAgcmV0dXJuIF8uZXh0ZW5kKG5ld1ZNLCBnZXR0ZXJzLCB7cGFyYW1ldGVyczogcGFyYW1ldGVycywgcGFyYW1ldGVyc1dpdGhvdXRPcmRlcjogcGFyYW1ldGVyc1dpdGhvdXRPcmRlcn0pO1xuICB9O1xufSkpO1xuIiwiKGZ1bmN0aW9uKGZhY3RvcnkpIHtcbiAgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xuICAgIC8vIE5vZGUvQ29tbW9uSlNcbiAgICBmYWN0b3J5KHJlcXVpcmUoJ21pdGhyaWwnKSwgcmVxdWlyZSgndW5kZXJzY29yZScpKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBCcm93c2VyIGdsb2JhbHNcbiAgICBmYWN0b3J5KHdpbmRvdy5tLCB3aW5kb3cuXyk7XG4gIH1cbn0oZnVuY3Rpb24obSwgXykge1xuICBtLnBvc3RncmVzdC5wYWdpbmF0aW9uVk0gPSAobW9kZWwsIG9yZGVyLCBhdXRoZW50aWNhdGUgPSB0cnVlKSA9PiB7XG4gICAgbGV0IGNvbGxlY3Rpb24gPSBtLnByb3AoW10pLFxuICAgICAgZGVmYXVsdE9yZGVyID0gb3JkZXIgfHwgJ2lkLmRlc2MnLFxuICAgICAgZmlsdGVycyA9IG0ucHJvcCh7b3JkZXI6IGRlZmF1bHRPcmRlcn0pLFxuICAgICAgaXNMb2FkaW5nID0gbS5wcm9wKGZhbHNlKSxcbiAgICAgIHBhZ2UgPSBtLnByb3AoMSksXG4gICAgICByZXN1bHRzQ291bnQgPSBtLnByb3AoMTApLFxuICAgICAgcGFnZVJlcXVlc3QgPSBhdXRoZW50aWNhdGUgPyBtb2RlbC5nZXRQYWdlV2l0aFRva2VuIDogbW9kZWwuZ2V0UGFnZSxcbiAgICAgIHRvdGFsID0gbS5wcm9wKCk7XG5cbiAgICBjb25zdCBmZXRjaCA9ICgpID0+IHtcbiAgICAgIGxldCBkID0gbS5kZWZlcnJlZCgpO1xuICAgICAgY29uc3QgZ2V0VG90YWwgPSAoeGhyKSA9PiB7XG4gICAgICAgIGlmICgheGhyIHx8IHhoci5zdGF0dXMgPT09IDApe1xuICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7aGludDogbnVsbCwgZGV0YWlsczogbnVsbCwgY29kZTogMCwgbWVzc2FnZTogJ0Nvbm5lY3Rpb24gZXJyb3InfSk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHJhbmdlSGVhZGVyID0geGhyLmdldFJlc3BvbnNlSGVhZGVyKCdDb250ZW50LVJhbmdlJyk7XG4gICAgICAgIGlmIChfLmlzU3RyaW5nKHJhbmdlSGVhZGVyKSl7XG4gICAgICAgICAgbGV0IFtzaXplLCBjb3VudF0gPSByYW5nZUhlYWRlci5zcGxpdCgnLycpLFxuICAgICAgICAgICAgICBbZnJvbSwgdG9dID0gc2l6ZS5zcGxpdCgnLScpO1xuXG4gICAgICAgICAgdG90YWwocGFyc2VJbnQoY291bnQpKTtcbiAgICAgICAgICByZXN1bHRzQ291bnQoKHBhcnNlSW50KGZyb20pIC0gIHBhcnNlSW50KHRvKSkpO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgSlNPTi5wYXJzZSh4aHIucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICByZXR1cm4geGhyLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXgpe1xuICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7aGludDogbnVsbCwgZGV0YWlsczogbnVsbCwgY29kZTogMCwgbWVzc2FnZTogeGhyLnJlc3BvbnNlVGV4dH0pO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgaXNMb2FkaW5nKHRydWUpO1xuICAgICAgcGFnZVJlcXVlc3QoZmlsdGVycygpLCBwYWdlKCksIHtiYWNrZ3JvdW5kOiB0cnVlLCBleHRyYWN0OiBnZXRUb3RhbH0sIHsnUHJlZmVyJzogJ2NvdW50PWV4YWN0J30pLnRoZW4oKGRhdGEpID0+IHtcbiAgICAgICAgY29sbGVjdGlvbihfLnVuaW9uKGNvbGxlY3Rpb24oKSwgZGF0YSkpO1xuICAgICAgICBpc0xvYWRpbmcoZmFsc2UpO1xuICAgICAgICBkLnJlc29sdmUoY29sbGVjdGlvbigpKTtcbiAgICAgICAgbS5yZWRyYXcoKTtcbiAgICAgIH0sXG4gICAgICAoZXJyb3IpID0+IHtcbiAgICAgICAgaXNMb2FkaW5nKGZhbHNlKTtcbiAgICAgICAgdG90YWwoMCk7XG4gICAgICAgIGQucmVqZWN0KGVycm9yKTtcbiAgICAgICAgbS5yZWRyYXcoKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGQucHJvbWlzZTtcbiAgICB9LFxuXG4gICAgZmlyc3RQYWdlID0gKHBhcmFtZXRlcnMpID0+IHtcbiAgICAgIGZpbHRlcnMoXy5leHRlbmQoe29yZGVyOiBkZWZhdWx0T3JkZXJ9LCBwYXJhbWV0ZXJzKSk7XG4gICAgICBjb2xsZWN0aW9uKFtdKTtcbiAgICAgIHBhZ2UoMSk7XG4gICAgICByZXR1cm4gZmV0Y2goKTtcbiAgICB9LFxuXG4gICAgaXNMYXN0UGFnZSA9ICgpID0+IHtcbiAgICAgIHJldHVybiAocGFnZSgpICogbW9kZWwucGFnZVNpemUoKSA+PSB0b3RhbCgpKTtcbiAgICB9LFxuXG4gICAgbmV4dFBhZ2UgPSAoKSA9PiB7XG4gICAgICBwYWdlKHBhZ2UoKSArIDEpO1xuICAgICAgcmV0dXJuIGZldGNoKCk7XG4gICAgfTtcblxuICAgIHJldHVybiB7XG4gICAgICBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uLFxuICAgICAgZmlyc3RQYWdlOiBmaXJzdFBhZ2UsXG4gICAgICBpc0xvYWRpbmc6IGlzTG9hZGluZyxcbiAgICAgIG5leHRQYWdlOiBuZXh0UGFnZSxcbiAgICAgIGlzTGFzdFBhZ2U6IGlzTGFzdFBhZ2UsXG4gICAgICB0b3RhbDogdG90YWxcbiAgICB9O1xuICB9O1xuXG59KSk7XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=
