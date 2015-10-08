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
        m.request(_.extend({}, authenticationOptions)).then(function (data) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1pdGhyaWwucG9zdGdyZXN0LmpzIiwidm1zL2ZpbHRlcnNWTS5qcyIsInZtcy9wYWdpbmF0aW9uVk0uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxBQUFDLENBQUEsVUFBUyxPQUFPLEVBQUU7QUFDakIsTUFBSSxPQUFPLE9BQU8sS0FBSyxRQUFRLEVBQUU7O0FBRS9CLFdBQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEVBQUUsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7R0FDcEQsTUFBTTs7QUFFTCxXQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7R0FDN0I7Q0FDRixDQUFBLENBQUMsVUFBQyxDQUFDLEVBQUUsQ0FBQyxFQUFLO0FBQ1YsTUFBSSxTQUFTLEdBQUcsRUFBRSxDQUFDOztBQUVuQixNQUFNLEtBQUssR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFO01BRXRCLFdBQVcsR0FBRyxTQUFkLFdBQVcsQ0FBSSxNQUFNLEVBQUUsT0FBTyxFQUFLO0FBQ2pDLFdBQU8sT0FBTyxJQUFJLENBQUMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUM7R0FDN0Y7TUFFRCxVQUFVLEdBQUcsU0FBYixVQUFVLENBQUksT0FBTyxFQUFLO0FBQ3hCLFdBQU8sVUFBQyxHQUFHLEVBQUs7QUFDZCxPQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxVQUFDLEtBQUssRUFBRSxHQUFHLEVBQUs7QUFDOUIsV0FBRyxDQUFDLGdCQUFnQixDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQztPQUNsQyxDQUFDLENBQUM7QUFDSCxhQUFPLEdBQUcsQ0FBQztLQUNaLENBQUM7R0FDSDtNQUVELGdCQUFnQixHQUFHLFNBQW5CLGdCQUFnQixDQUFJLE9BQU8s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QztPQUNaLENBQUMsQ0FBQztBQUNILGFBQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQztLQUNsQjtRQUVELFNBQVMsR0FBRyxTQUFaLFNBQVMsQ0FBSSxVQUFVLEVBQUs7QUFDMUIsYUFBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBQyxLQUFLLEVBQUUsWUFBWSxFQUFDLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQztBQUNyRCxnQkFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ2YsVUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ1IsYUFBTyxLQUFLLEVBQUUsQ0FBQztLQUNoQjtRQUVELFVBQVUsR0FBRyxTQUFiLFVBQVUsR0FBUztBQUNqQixhQUFRLElBQUksRUFBRSxHQUFHLEtBQUssQ0FBQyxRQUFRLEVBQUUsSUFBSSxLQUFLLEVBQUUsQ0FBRTtLQUMvQztRQUVELFFBQVEsR0FBRyxTQUFYLFFBQVEsR0FBUztBQUNmLFVBQUksQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNqQixhQUFPLEtBQUssRUFBRSxDQUFDO0tBQ2hCLENBQUM7O0FBRUYsV0FBTztBQUNMLGdCQUFVLEVBQUUsVUFBVTtBQUN0QixlQUFTLEVBQUUsU0FBUztBQUNwQixlQUFTLEVBQUUsU0FBUztBQUNwQixjQUFRLEVBQUUsUUFBUTtBQUNsQixnQkFBVSxFQUFFLFVBQVU7QUFDdEIsV0FBSyxFQUFFLEtBQUs7QUFDWixrQkFBWSxFQUFFLFlBQVk7S0FDM0IsQ0FBQztHQUNILENBQUM7Q0FFSCxDQUFDLENBQUUiLCJmaWxlIjoibWl0aHJpbC5wb3N0Z3Jlc3QuanMiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oZmFjdG9yeSkge1xuICBpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG4gICAgLy8gTm9kZS9Db21tb25KU1xuICAgIGZhY3RvcnkocmVxdWlyZSgnbWl0aHJpbCcpLCByZXF1aXJlKCd1bmRlcnNjb3JlJykpO1xuICB9IGVsc2Uge1xuICAgIC8vIEJyb3dzZXIgZ2xvYmFsc1xuICAgIGZhY3Rvcnkod2luZG93Lm0sIHdpbmRvdy5fKTtcbiAgfVxufSgobSwgXykgPT4ge1xuICBsZXQgcG9zdGdyZXN0ID0ge307XG5cbiAgY29uc3QgdG9rZW4gPSBtLnByb3AoKSxcblxuICBtZXJnZUNvbmZpZyA9IChjb25maWcsIG9wdGlvbnMpID0+IHtcbiAgICByZXR1cm4gb3B0aW9ucyAmJiBfLmlzRnVuY3Rpb24ob3B0aW9ucy5jb25maWcpID8gXy5jb21wb3NlKG9wdGlvbnMuY29uZmlnLCBjb25maWcpIDogY29uZmlnO1xuICB9LFxuXG4gIGFkZEhlYWRlcnMgPSAoaGVhZGVycykgPT4ge1xuICAgIHJldHVybiAoeGhyKSA9PiB7XG4gICAgICBfLmVhY2goaGVhZGVycywgKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoa2V5LCB2YWx1ZSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiB4aHI7XG4gICAgfTtcbiAgfSxcblxuICBhZGRDb25maWdIZWFkZXJzID0gKGhlYWRlcnMsIG9wdGlvbnMpID0+IHtcbiAgICByZXR1cm4gXy5leHRlbmQoe30sIG9wdGlvbnMsIHtjb25maWc6IG1lcmdlQ29uZmlnKGFkZEhlYWRlcnMoaGVhZGVycyksIG9wdGlvbnMpfSk7XG4gIH0sXG5cbiAgcmVwcmVzZW50YXRpb25IZWFkZXIgPSB7J1ByZWZlcic6ICdyZXR1cm49cmVwcmVzZW50YXRpb24nfTtcblxuICBwb3N0Z3Jlc3QudG9rZW4gPSB0b2tlbjtcblxuICBwb3N0Z3Jlc3QubG9hZGVyID0gKG9wdGlvbnMsIHJlcXVlc3RGdW5jdGlvbiwgZGVmYXVsdFN0YXRlID0gZmFsc2UpID0+IHtcbiAgICBjb25zdCBsb2FkZXIgPSBtLnByb3AoZGVmYXVsdFN0YXRlKSwgZCA9IG0uZGVmZXJyZWQoKTtcbiAgICBsb2FkZXIubG9hZCA9ICgpID0+IHtcbiAgICAgIGxvYWRlcih0cnVlKTtcbiAgICAgIG0ucmVkcmF3KCk7XG4gICAgICBtLnN0YXJ0Q29tcHV0YXRpb24oKTtcbiAgICAgIHJlcXVlc3RGdW5jdGlvbihfLmV4dGVuZCh7fSwgb3B0aW9ucywge2JhY2tncm91bmQ6IHRydWV9KSkudGhlbigoZGF0YSkgPT4ge1xuICAgICAgICBsb2FkZXIoZmFsc2UpO1xuICAgICAgICBkLnJlc29sdmUoZGF0YSk7XG4gICAgICAgIG0uZW5kQ29tcHV0YXRpb24oKTtcbiAgICAgIH0sIChlcnJvcikgPT4ge1xuICAgICAgICBsb2FkZXIoZmFsc2UpO1xuICAgICAgICBkLnJlamVjdChlcnJvcik7XG4gICAgICAgIG0uZW5kQ29tcHV0YXRpb24oKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGQucHJvbWlzZTtcbiAgICB9O1xuICAgIHJldHVybiBsb2FkZXI7XG4gIH07XG5cbiAgcG9zdGdyZXN0LmxvYWRlcldpdGhUb2tlbiA9IChvcHRpb25zLCBkZWZhdWx0U3RhdGUpID0+IHtcbiAgICByZXR1cm4gcG9zdGdyZXN0LmxvYWRlcihvcHRpb25zLCBwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgZGVmYXVsdFN0YXRlKTtcbiAgfTtcblxuICBwb3N0Z3Jlc3QuaW5pdCA9IChhcGlQcmVmaXgsIGF1dGhlbnRpY2F0aW9uT3B0aW9ucykgPT4ge1xuICAgIHBvc3RncmVzdC5yZXF1ZXN0ID0gKG9wdGlvbnMpID0+IHtcbiAgICAgIHJldHVybiBtLnJlcXVlc3QoXy5leHRlbmQoe30sIG9wdGlvbnMsIHt1cmw6IGFwaVByZWZpeCArIG9wdGlvbnMudXJsfSkpO1xuICAgIH07XG5cbiAgICBwb3N0Z3Jlc3QuYXV0aGVudGljYXRlID0gKCkgPT4ge1xuICAgICAgY29uc3QgZGVmZXJyZWQgPSBtLmRlZmVycmVkKCk7XG4gICAgICBpZiAodG9rZW4oKSl7XG4gICAgICAgIGRlZmVycmVkLnJlc29sdmUoe3Rva2VuOiB0b2tlbigpfSk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgbS5yZXF1ZXN0KF8uZXh0ZW5kKHt9LCBhdXRoZW50aWNhdGlvbk9wdGlvbnMpKS50aGVuKChkYXRhKSA9PiB7XG4gICAgICAgICAgdG9rZW4oZGF0YS50b2tlbik7XG4gICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSh7dG9rZW46IHRva2VuKCl9KTtcbiAgICAgICAgfSwgKGRhdGEpID0+IHsgZGVmZXJyZWQucmVqZWN0KGRhdGEpOyB9KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH07XG5cbiAgICBwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiA9IChvcHRpb25zKSA9PiB7XG4gICAgICByZXR1cm4gbS5wb3N0Z3Jlc3QuYXV0aGVudGljYXRlKCkudGhlbihcbiAgICAgICAgKCkgPT4ge1xuICAgICAgICAgIHJldHVybiBtLnBvc3RncmVzdC5yZXF1ZXN0KGFkZENvbmZpZ0hlYWRlcnMoeydBdXRob3JpemF0aW9uJzogJ0JlYXJlciAnICsgdG9rZW4oKX0sIG9wdGlvbnMpKTtcbiAgICAgICAgfSxcbiAgICAgICAgKCkgPT4ge1xuICAgICAgICAgIHJldHVybiBtLnBvc3RncmVzdC5yZXF1ZXN0KG9wdGlvbnMpO1xuICAgICAgICB9XG4gICAgICApO1xuICAgIH07XG5cbiAgICBwb3N0Z3Jlc3QubW9kZWwgPSAobmFtZSkgPT4ge1xuICAgICAgY29uc3QgcGFnaW5hdGlvbkhlYWRlcnMgPSAocGFnZSwgcGFnZVNpemUpID0+IHtcbiAgICAgICAgaWYgKCFwYWdlU2l6ZSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHRvUmFuZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgY29uc3QgZnJvbSA9IChwYWdlIC0gMSkgKiBwYWdlU2l6ZSxcbiAgICAgICAgICAgIHRvID0gZnJvbSArIHBhZ2VTaXplIC0gMTtcbiAgICAgICAgICByZXR1cm4gZnJvbSArICctJyArIHRvO1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiB7J1JhbmdlLXVuaXQnOiAnaXRlbXMnLCAnUmFuZ2UnOiB0b1JhbmdlKCl9O1xuICAgICAgfSxcblxuICAgICAgcGFnZVNpemUgPSBtLnByb3AoMTApLFxuXG4gICAgICBuYW1lT3B0aW9ucyA9IHt1cmw6ICcvJyArIG5hbWV9LFxuXG4gICAgICBnZXRPcHRpb25zID0gKGRhdGEsIHBhZ2UsIHBhZ2VTaXplLCBvcHRpb25zLCBoZWFkZXJzID0ge30pID0+IHtcbiAgICAgICAgY29uc3QgZXh0cmFIZWFkZXJzID0gXy5leHRlbmQoe30sIHsnUHJlZmVyJzogJ2NvdW50PW5vbmUnfSwgaGVhZGVycywgcGFnaW5hdGlvbkhlYWRlcnMocGFnZSwgcGFnZVNpemUpKTtcbiAgICAgICAgcmV0dXJuIGFkZENvbmZpZ0hlYWRlcnMoZXh0cmFIZWFkZXJzLCBfLmV4dGVuZCh7fSwgb3B0aW9ucywgbmFtZU9wdGlvbnMsIHttZXRob2Q6ICdHRVQnLCBkYXRhOiBkYXRhfSkpO1xuICAgICAgfSxcblxuICAgICAgcXVlcnlzdHJpbmcgPSAoZmlsdGVycywgb3B0aW9ucykgPT4ge1xuICAgICAgICBvcHRpb25zLnVybCArPSAnPycgKyBtLnJvdXRlLmJ1aWxkUXVlcnlTdHJpbmcoZmlsdGVycyk7XG4gICAgICAgIHJldHVybiBvcHRpb25zO1xuICAgICAgfSxcblxuICAgICAgb3B0aW9ucyA9IChvcHRpb25zKSA9PiB7XG4gICAgICAgIHJldHVybiBtLnBvc3RncmVzdC5yZXF1ZXN0KF8uZXh0ZW5kKHt9LCBvcHRpb25zLCBuYW1lT3B0aW9ucywge21ldGhvZDogJ09QVElPTlMnfSkpO1xuICAgICAgfSxcblxuICAgICAgcG9zdE9wdGlvbnMgPSAoYXR0cmlidXRlcywgb3B0aW9ucywgaGVhZGVycyA9IHt9KSA9PiB7XG4gICAgICAgIGNvbnN0IGV4dHJhSGVhZGVycyA9IF8uZXh0ZW5kKHt9LCByZXByZXNlbnRhdGlvbkhlYWRlciwgaGVhZGVycyk7XG4gICAgICAgIHJldHVybiBhZGRDb25maWdIZWFkZXJzKFxuICAgICAgICAgIGV4dHJhSGVhZGVycyxcbiAgICAgICAgICBfLmV4dGVuZChcbiAgICAgICAgICAgIHt9LFxuICAgICAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgICAgIG5hbWVPcHRpb25zLFxuICAgICAgICAgICAge21ldGhvZDogJ1BPU1QnLCBkYXRhOiBhdHRyaWJ1dGVzfVxuICAgICAgICAgIClcbiAgICAgICAgKTtcbiAgICAgIH0sXG5cbiAgICAgIGRlbGV0ZU9wdGlvbnMgPSAoZmlsdGVycywgb3B0aW9ucywgaGVhZGVycyA9IHt9KSA9PiB7XG4gICAgICAgIGNvbnN0IGV4dHJhSGVhZGVycyA9IGFkZEhlYWRlcnMoXy5leHRlbmQoe30sIGhlYWRlcnMpKTtcbiAgICAgICAgcmV0dXJuIHF1ZXJ5c3RyaW5nKGZpbHRlcnMsIGFkZENvbmZpZ0hlYWRlcnMoZXh0cmFIZWFkZXJzLCBfLmV4dGVuZCh7fSwgb3B0aW9ucywgbmFtZU9wdGlvbnMsIHttZXRob2Q6ICdERUxFVEUnfSkpKTtcbiAgICAgIH0sXG5cbiAgICAgIHBhdGNoT3B0aW9ucyA9IChmaWx0ZXJzLCBhdHRyaWJ1dGVzLCBvcHRpb25zLCBoZWFkZXJzID0ge30pID0+IHtcbiAgICAgICAgY29uc3QgZXh0cmFIZWFkZXJzID0gXy5leHRlbmQoe30sIHJlcHJlc2VudGF0aW9uSGVhZGVyLCBoZWFkZXJzKTtcbiAgICAgICAgcmV0dXJuIHF1ZXJ5c3RyaW5nKFxuICAgICAgICAgIGZpbHRlcnMsXG4gICAgICAgICAgYWRkQ29uZmlnSGVhZGVycyhcbiAgICAgICAgICAgIGV4dHJhSGVhZGVycyxcbiAgICAgICAgICAgIF8uZXh0ZW5kKFxuICAgICAgICAgICAgICB7fSxcbiAgICAgICAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgICAgICAgbmFtZU9wdGlvbnMsXG4gICAgICAgICAgICAgIHttZXRob2Q6ICdQQVRDSCcsIGRhdGE6IGF0dHJpYnV0ZXN9XG4gICAgICAgICAgICApXG4gICAgICAgICAgKVxuICAgICAgICApO1xuICAgICAgfSxcblxuICAgICAgZ2V0UGFnZU9wdGlvbnMgPSAoZGF0YSwgcGFnZSwgb3B0aW9ucywgaGVhZGVycyA9IHt9KSA9PiB7XG4gICAgICAgIHJldHVybiBnZXRPcHRpb25zKGRhdGEsIChwYWdlIHx8IDEpLCBwYWdlU2l6ZSgpLCBvcHRpb25zLCBoZWFkZXJzKTtcbiAgICAgIH0sXG5cbiAgICAgIGdldFJvd09wdGlvbnMgPSAoZGF0YSwgb3B0aW9ucywgaGVhZGVycyA9IHt9KSA9PiB7XG4gICAgICAgIHJldHVybiBnZXRPcHRpb25zKGRhdGEsIDEsIDEsIG9wdGlvbnMsIGhlYWRlcnMpO1xuICAgICAgfTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcGFnZVNpemU6IHBhZ2VTaXplLFxuICAgICAgICBnZXRQYWdlT3B0aW9uczogICBnZXRQYWdlT3B0aW9ucyxcbiAgICAgICAgZ2V0Um93T3B0aW9uczogICAgZ2V0Um93T3B0aW9ucyxcbiAgICAgICAgcGF0Y2hPcHRpb25zOiAgICAgcGF0Y2hPcHRpb25zLFxuICAgICAgICBwb3N0T3B0aW9uczogICAgICBwb3N0T3B0aW9ucyxcbiAgICAgICAgZGVsZXRlT3B0aW9uczogICAgZGVsZXRlT3B0aW9ucyxcbiAgICAgICAgZ2V0UGFnZTogICAgICAgICAgXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0LCBnZXRQYWdlT3B0aW9ucyksXG4gICAgICAgIGdldFJvdzogICAgICAgICAgIF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgZ2V0Um93T3B0aW9ucyksXG4gICAgICAgIHBhdGNoOiAgICAgICAgICAgIF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgcGF0Y2hPcHRpb25zKSxcbiAgICAgICAgcG9zdDogICAgICAgICAgICAgXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0LCBwb3N0T3B0aW9ucyksXG4gICAgICAgIGRlbGV0ZVJlcXVlc3Q6ICAgIF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgZGVsZXRlT3B0aW9ucyksXG4gICAgICAgIGdldFBhZ2VXaXRoVG9rZW46IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgZ2V0UGFnZU9wdGlvbnMpLFxuICAgICAgICBnZXRSb3dXaXRoVG9rZW46ICBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIGdldFJvd09wdGlvbnMpLFxuICAgICAgICBwYXRjaFdpdGhUb2tlbjogICBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIHBhdGNoT3B0aW9ucyksXG4gICAgICAgIHBvc3RXaXRoVG9rZW46ICAgIF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgcG9zdE9wdGlvbnMpLFxuICAgICAgICBkZWxldGVXaXRoVG9rZW46ICBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIGRlbGV0ZU9wdGlvbnMpLFxuICAgICAgICBvcHRpb25zOiBvcHRpb25zXG4gICAgICB9O1xuICAgIH07XG5cbiAgICByZXR1cm4gcG9zdGdyZXN0O1xuICB9O1xuXG4gIG0ucG9zdGdyZXN0ID0gcG9zdGdyZXN0O1xufSkpO1xuIiwiKGZ1bmN0aW9uKGZhY3RvcnkpIHtcbiAgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xuICAgIC8vIE5vZGUvQ29tbW9uSlNcbiAgICBmYWN0b3J5KHJlcXVpcmUoJ21pdGhyaWwnKSwgcmVxdWlyZSgndW5kZXJzY29yZScpKTtcbiAgfVxuICBlbHNlIHtcbiAgICAvLyBCcm93c2VyIGdsb2JhbHNcbiAgICBmYWN0b3J5KHdpbmRvdy5tLCB3aW5kb3cuXyk7XG4gIH1cbn0oKG0sIF8pID0+IHtcbiAgbS5wb3N0Z3Jlc3QuZmlsdGVyc1ZNID0gKGF0dHJpYnV0ZXMpID0+IHtcbiAgICB2YXIgbmV3Vk0gPSB7fSxcbiAgICBmaWx0ZXIgPSAoKSA9PiB7XG4gICAgICB2YXIgcHJvcCA9IG0ucHJvcCgnJyksXG4gICAgICBmaWx0ZXJQcm9wID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAwKXtcbiAgICAgICAgICBwcm9wKHZhbHVlKTtcbiAgICAgICAgICByZXR1cm4gbmV3Vk07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHByb3AoKTtcbiAgICAgIH07XG4gICAgICAvLyBKdXN0IHNvIHdlIGNhbiBoYXZlIGEgZGVmYXVsdCB0b19maWx0ZXIgYW5kIGF2b2lkIGlmIF8uaXNGdW5jdGlvbiBjYWxsc1xuICAgICAgZmlsdGVyUHJvcC50b0ZpbHRlciA9ICgpID0+IHtcbiAgICAgICAgcmV0dXJuIF8uaXNTdHJpbmcoZmlsdGVyUHJvcCgpKSA/IGZpbHRlclByb3AoKS50cmltKCkgOiBmaWx0ZXJQcm9wKCk7XG4gICAgICB9O1xuICAgICAgcmV0dXJuIGZpbHRlclByb3A7XG4gICAgfSxcblxuICAgIGdldHRlcnMgPSBfLnJlZHVjZShcbiAgICAgIGF0dHJpYnV0ZXMsXG4gICAgICAobWVtbywgb3BlcmF0b3IsIGF0dHIpID0+IHtcbiAgICAgICAgLy8gVGhlIG9wZXJhdG9yIGJldHdlZW4gaXMgaW1wbGVtZW50ZWQgd2l0aCB0d28gcHJvcGVydGllcywgb25lIGZvciBncmVhdGVyIHRoYW4gdmFsdWUgYW5kIGFub3RoZXIgZm9yIGxlc3NlciB0aGFuIHZhbHVlLlxuICAgICAgICAvLyBCb3RoIHByb3BlcnRpZXMgYXJlIHNlbnQgaW4gdGhlIHF1ZXVyeXN0cmluZyB3aXRoIHRoZSBzYW1lIG5hbWUsXG4gICAgICAgIC8vIHRoYXQncyB3aHkgd2UgbmVlZCB0aGUgc3BlY2lhbCBjYXNlIGhlcmUsIHNvIHdlIGNhbiB1c2UgYSBzaW1wbGUgbWFwIGFzIGFyZ3VtZW50IHRvIGZpbHRlcnNWTS5cbiAgICAgICAgaWYgKG9wZXJhdG9yID09PSAnYmV0d2Vlbicpe1xuICAgICAgICAgIG1lbW9bYXR0cl0gPSB7bHRlOiBmaWx0ZXIoKSwgZ3RlOiBmaWx0ZXIoKX07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgbWVtb1thdHRyXSA9IGZpbHRlcigpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgfSxcbiAgICAgIHtvcmRlcjogbS5wcm9wKCl9XG4gICAgKSxcblxuICAgIHBhcmFtZXRlcnNXaXRob3V0T3JkZXIgPSAoKSA9PiB7XG4gICAgICByZXR1cm4gXy5yZWR1Y2UoXG4gICAgICAgIGdldHRlcnMsXG4gICAgICAgIChtZW1vLCBnZXR0ZXIsIGF0dHIpID0+IHtcbiAgICAgICAgICBpZiAoYXR0ciAhPT0gJ29yZGVyJyl7XG4gICAgICAgICAgICB2YXIgb3BlcmF0b3IgPSBhdHRyaWJ1dGVzW2F0dHJdO1xuXG4gICAgICAgICAgICBpZiAoXy5pc0Z1bmN0aW9uKGdldHRlci50b0ZpbHRlcikgJiYgKGdldHRlci50b0ZpbHRlcigpID09PSB1bmRlZmluZWQgfHwgZ2V0dGVyLnRvRmlsdGVyKCkgPT09ICcnKSl7IHJldHVybiBtZW1vOyB9XG5cbiAgICAgICAgICAgIC8vIEJlbGxvdyB3ZSB1c2UgZGlmZmVyZW50IGZvcm1hdHRpbmcgcnVsZXMgZm9yIHRoZSB2YWx1ZSBkZXBlbmRpbmcgb24gdGhlIG9wZXJhdG9yXG4gICAgICAgICAgICAvLyBUaGVzZSBydWxlcyBhcmUgdXNlZCByZWdhcmRsZXNzIG9mIHRoZSB0b0ZpbHRlciBmdW5jdGlvbixcbiAgICAgICAgICAgIC8vIHNvIHRoZSB1c2VyIGNhbiB1c2UgYSBjdXN0b20gdG9GaWx0ZXIgd2l0aG91dCBoYXZpbmcgdG8gd29ycnkgd2l0aCBiYXNpYyBmaWx0ZXIgc3ludGF4XG4gICAgICAgICAgICBpZiAob3BlcmF0b3IgPT09ICdpbGlrZScgfHwgb3BlcmF0b3IgPT09ICdsaWtlJyl7XG4gICAgICAgICAgICAgIG1lbW9bYXR0cl0gPSBvcGVyYXRvciArICcuKicgKyBnZXR0ZXIudG9GaWx0ZXIoKSArICcqJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKG9wZXJhdG9yID09PSAnQEAnKSB7XG4gICAgICAgICAgICAgIG1lbW9bYXR0cl0gPSBvcGVyYXRvciArICcuJyArIGdldHRlci50b0ZpbHRlcigpLnJlcGxhY2UoL1xccysvZywgJyYnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKG9wZXJhdG9yID09PSAnYmV0d2VlbicpIHtcbiAgICAgICAgICAgICAgaWYgKCFnZXR0ZXIubHRlLnRvRmlsdGVyKCkgJiYgIWdldHRlci5ndGUudG9GaWx0ZXIoKSl7IHJldHVybiBtZW1vOyB9XG4gICAgICAgICAgICAgIG1lbW9bYXR0cl0gPSBbXTtcbiAgICAgICAgICAgICAgaWYgKGdldHRlci5ndGUoKSl7XG4gICAgICAgICAgICAgICAgbWVtb1thdHRyXS5wdXNoKCdndGUuJyArIGdldHRlci5ndGUudG9GaWx0ZXIoKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKGdldHRlci5sdGUoKSl7XG4gICAgICAgICAgICAgICAgbWVtb1thdHRyXS5wdXNoKCdsdGUuJyArIGdldHRlci5sdGUudG9GaWx0ZXIoKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gb3BlcmF0b3IgKyAnLicgKyBnZXR0ZXIudG9GaWx0ZXIoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgIH0sXG4gICAgICAgIHt9XG4gICAgICApO1xuICAgIH0sXG5cbiAgICBwYXJhbWV0ZXJzID0gKCkgPT4ge1xuICAgICAgLy8gVGhlIG9yZGVyIHBhcmFtZXRlcnMgaGF2ZSBhIHNwZWNpYWwgc3ludGF4IChqdXN0IGxpa2UgYW4gb3JkZXIgYnkgU1FMIGNsYXVzZSlcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9iZWdyaWZmcy9wb3N0Z3Jlc3Qvd2lraS9Sb3V0aW5nI2ZpbHRlcmluZy1hbmQtb3JkZXJpbmdcbiAgICAgIHZhciBvcmRlciA9ICgpID0+IHtcbiAgICAgICAgcmV0dXJuIGdldHRlcnMub3JkZXIoKSAmJiBfLnJlZHVjZShcbiAgICAgICAgICBnZXR0ZXJzLm9yZGVyKCksXG4gICAgICAgICAgKG1lbW8sIGRpcmVjdGlvbiwgYXR0cikgPT4ge1xuICAgICAgICAgICAgbWVtby5wdXNoKGF0dHIgKyAnLicgKyBkaXJlY3Rpb24pO1xuICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgICAgfSxcbiAgICAgICAgICBbXVxuICAgICAgICApLmpvaW4oJywnKTtcbiAgICAgIH0sXG5cbiAgICAgIG9yZGVyUGFyYW1ldGVyID0gb3JkZXIoKSA/IHtvcmRlcjogb3JkZXIoKX0gOiB7fTtcblxuICAgICAgcmV0dXJuIF8uZXh0ZW5kKHt9LCBvcmRlclBhcmFtZXRlciwgcGFyYW1ldGVyc1dpdGhvdXRPcmRlcigpKTtcblxuICAgIH07XG5cbiAgICByZXR1cm4gXy5leHRlbmQobmV3Vk0sIGdldHRlcnMsIHtwYXJhbWV0ZXJzOiBwYXJhbWV0ZXJzLCBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyOiBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyfSk7XG4gIH07XG59KSk7XG4iLCIoZnVuY3Rpb24oZmFjdG9yeSkge1xuICBpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG4gICAgLy8gTm9kZS9Db21tb25KU1xuICAgIGZhY3RvcnkocmVxdWlyZSgnbWl0aHJpbCcpLCByZXF1aXJlKCd1bmRlcnNjb3JlJykpO1xuICB9IGVsc2Uge1xuICAgIC8vIEJyb3dzZXIgZ2xvYmFsc1xuICAgIGZhY3Rvcnkod2luZG93Lm0sIHdpbmRvdy5fKTtcbiAgfVxufShmdW5jdGlvbihtLCBfKSB7XG4gIG0ucG9zdGdyZXN0LnBhZ2luYXRpb25WTSA9IChtb2RlbCwgb3JkZXIsIGF1dGhlbnRpY2F0ZSA9IHRydWUpID0+IHtcbiAgICBsZXQgY29sbGVjdGlvbiA9IG0ucHJvcChbXSksXG4gICAgICBkZWZhdWx0T3JkZXIgPSBvcmRlciB8fCAnaWQuZGVzYycsXG4gICAgICBmaWx0ZXJzID0gbS5wcm9wKHtvcmRlcjogZGVmYXVsdE9yZGVyfSksXG4gICAgICBpc0xvYWRpbmcgPSBtLnByb3AoZmFsc2UpLFxuICAgICAgcGFnZSA9IG0ucHJvcCgxKSxcbiAgICAgIHJlc3VsdHNDb3VudCA9IG0ucHJvcCgpLFxuICAgICAgcGFnZVJlcXVlc3QgPSBhdXRoZW50aWNhdGUgPyBtb2RlbC5nZXRQYWdlV2l0aFRva2VuIDogbW9kZWwuZ2V0UGFnZSxcbiAgICAgIHRvdGFsID0gbS5wcm9wKCk7XG5cbiAgICBjb25zdCBmZXRjaCA9ICgpID0+IHtcbiAgICAgIGxldCBkID0gbS5kZWZlcnJlZCgpO1xuICAgICAgY29uc3QgZ2V0VG90YWwgPSAoeGhyKSA9PiB7XG4gICAgICAgIGlmICgheGhyIHx8IHhoci5zdGF0dXMgPT09IDApe1xuICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7aGludDogbnVsbCwgZGV0YWlsczogbnVsbCwgY29kZTogMCwgbWVzc2FnZTogJ0Nvbm5lY3Rpb24gZXJyb3InfSk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHJhbmdlSGVhZGVyID0geGhyLmdldFJlc3BvbnNlSGVhZGVyKCdDb250ZW50LVJhbmdlJyk7XG4gICAgICAgIGlmIChfLmlzU3RyaW5nKHJhbmdlSGVhZGVyKSl7XG4gICAgICAgICAgbGV0IFtzaXplLCBjb3VudF0gPSByYW5nZUhlYWRlci5zcGxpdCgnLycpLFxuICAgICAgICAgICAgICBbZnJvbSwgdG9dID0gc2l6ZS5zcGxpdCgnLScpO1xuXG4gICAgICAgICAgdG90YWwocGFyc2VJbnQoY291bnQpKTtcbiAgICAgICAgICByZXN1bHRzQ291bnQoKHBhcnNlSW50KHRvKSAtIHBhcnNlSW50KGZyb20pICsgMSkpO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgSlNPTi5wYXJzZSh4aHIucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICByZXR1cm4geGhyLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXgpe1xuICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7aGludDogbnVsbCwgZGV0YWlsczogbnVsbCwgY29kZTogMCwgbWVzc2FnZTogeGhyLnJlc3BvbnNlVGV4dH0pO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgaXNMb2FkaW5nKHRydWUpO1xuICAgICAgcGFnZVJlcXVlc3QoZmlsdGVycygpLCBwYWdlKCksIHtiYWNrZ3JvdW5kOiB0cnVlLCBleHRyYWN0OiBnZXRUb3RhbH0sIHsnUHJlZmVyJzogJ2NvdW50PWV4YWN0J30pLnRoZW4oKGRhdGEpID0+IHtcbiAgICAgICAgY29sbGVjdGlvbihfLnVuaW9uKGNvbGxlY3Rpb24oKSwgZGF0YSkpO1xuICAgICAgICBpc0xvYWRpbmcoZmFsc2UpO1xuICAgICAgICBkLnJlc29sdmUoY29sbGVjdGlvbigpKTtcbiAgICAgICAgbS5yZWRyYXcoKTtcbiAgICAgIH0sXG4gICAgICAoZXJyb3IpID0+IHtcbiAgICAgICAgaXNMb2FkaW5nKGZhbHNlKTtcbiAgICAgICAgdG90YWwoMCk7XG4gICAgICAgIGQucmVqZWN0KGVycm9yKTtcbiAgICAgICAgbS5yZWRyYXcoKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGQucHJvbWlzZTtcbiAgICB9LFxuXG4gICAgZmlyc3RQYWdlID0gKHBhcmFtZXRlcnMpID0+IHtcbiAgICAgIGZpbHRlcnMoXy5leHRlbmQoe29yZGVyOiBkZWZhdWx0T3JkZXJ9LCBwYXJhbWV0ZXJzKSk7XG4gICAgICBjb2xsZWN0aW9uKFtdKTtcbiAgICAgIHBhZ2UoMSk7XG4gICAgICByZXR1cm4gZmV0Y2goKTtcbiAgICB9LFxuXG4gICAgaXNMYXN0UGFnZSA9ICgpID0+IHtcbiAgICAgIHJldHVybiAocGFnZSgpICogbW9kZWwucGFnZVNpemUoKSA+PSB0b3RhbCgpKTtcbiAgICB9LFxuXG4gICAgbmV4dFBhZ2UgPSAoKSA9PiB7XG4gICAgICBwYWdlKHBhZ2UoKSArIDEpO1xuICAgICAgcmV0dXJuIGZldGNoKCk7XG4gICAgfTtcblxuICAgIHJldHVybiB7XG4gICAgICBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uLFxuICAgICAgZmlyc3RQYWdlOiBmaXJzdFBhZ2UsXG4gICAgICBpc0xvYWRpbmc6IGlzTG9hZGluZyxcbiAgICAgIG5leHRQYWdlOiBuZXh0UGFnZSxcbiAgICAgIGlzTGFzdFBhZ2U6IGlzTGFzdFBhZ2UsXG4gICAgICB0b3RhbDogdG90YWwsXG4gICAgICByZXN1bHRzQ291bnQ6IHJlc3VsdHNDb3VudFxuICAgIH07XG4gIH07XG5cbn0pKTtcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==