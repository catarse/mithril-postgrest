(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('mithril'), require('underscore')) :
	typeof define === 'function' && define.amd ? define(['mithril', 'underscore'], factory) :
	(global.Postgrest = factory(global.m,global._));
}(this, (function (m,_) { 'use strict';

m = m && m.hasOwnProperty('default') ? m['default'] : m;
_ = _ && _.hasOwnProperty('default') ? _['default'] : _;

var filtersVM = function filtersVM(attributes) {
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
            memo[attr] = {
                lte: filter(),
                gte: filter()
            };
        } else {
            memo[attr] = filter();
        }
        return memo;
    }, {
        order: filter()
    }),
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
                } else if (operator === 'is.null') {
                    memo[attr] = getter.toFilter() === null ? 'is.null' : 'not.is.null';
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
            orderParameter = order() ? {
            order: order()
        } : {};

        return _.extend({}, orderParameter, parametersWithoutOrder());
    };

    return _.extend(newVM, getters, {
        parameters: parameters,
        parametersWithoutOrder: parametersWithoutOrder
    });
};

var asyncGenerator = function () {
  function AwaitValue(value) {
    this.value = value;
  }

  function AsyncGenerator(gen) {
    var front, back;

    function send(key, arg) {
      return new Promise(function (resolve, reject) {
        var request = {
          key: key,
          arg: arg,
          resolve: resolve,
          reject: reject,
          next: null
        };

        if (back) {
          back = back.next = request;
        } else {
          front = back = request;
          resume(key, arg);
        }
      });
    }

    function resume(key, arg) {
      try {
        var result = gen[key](arg);
        var value = result.value;

        if (value instanceof AwaitValue) {
          Promise.resolve(value.value).then(function (arg) {
            resume("next", arg);
          }, function (arg) {
            resume("throw", arg);
          });
        } else {
          settle(result.done ? "return" : "normal", result.value);
        }
      } catch (err) {
        settle("throw", err);
      }
    }

    function settle(type, value) {
      switch (type) {
        case "return":
          front.resolve({
            value: value,
            done: true
          });
          break;

        case "throw":
          front.reject(value);
          break;

        default:
          front.resolve({
            value: value,
            done: false
          });
          break;
      }

      front = front.next;

      if (front) {
        resume(front.key, front.arg);
      } else {
        back = null;
      }
    }

    this._invoke = send;

    if (typeof gen.return !== "function") {
      this.return = undefined;
    }
  }

  if (typeof Symbol === "function" && Symbol.asyncIterator) {
    AsyncGenerator.prototype[Symbol.asyncIterator] = function () {
      return this;
    };
  }

  AsyncGenerator.prototype.next = function (arg) {
    return this._invoke("next", arg);
  };

  AsyncGenerator.prototype.throw = function (arg) {
    return this._invoke("throw", arg);
  };

  AsyncGenerator.prototype.return = function (arg) {
    return this._invoke("return", arg);
  };

  return {
    wrap: function (fn) {
      return function () {
        return new AsyncGenerator(fn.apply(this, arguments));
      };
    },
    await: function (value) {
      return new AwaitValue(value);
    }
  };
}();



































var slicedToArray = function () {
  function sliceIterator(arr, i) {
    var _arr = [];
    var _n = true;
    var _d = false;
    var _e = undefined;

    try {
      for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);

        if (i && _arr.length === i) break;
      }
    } catch (err) {
      _d = true;
      _e = err;
    } finally {
      try {
        if (!_n && _i["return"]) _i["return"]();
      } finally {
        if (_d) throw _e;
      }
    }

    return _arr;
  }

  return function (arr, i) {
    if (Array.isArray(arr)) {
      return arr;
    } else if (Symbol.iterator in Object(arr)) {
      return sliceIterator(arr, i);
    } else {
      throw new TypeError("Invalid attempt to destructure non-iterable instance");
    }
  };
}();

var paginationVM = function paginationVM(model, order) {
    var extraHeaders = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    var authenticate = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;

    var collection = m.prop([]),
        defaultOrder = order || 'id.desc',
        filters = m.prop({
        order: defaultOrder
    }),
        isLoading = m.prop(false),
        page = m.prop(1),
        resultsCount = m.prop(),
        pageRequest = authenticate ? model.getPageWithToken : model.getPage,
        total = m.prop();

    var fetch = function fetch() {
        var d = m.deferred();
        var getTotal = function getTotal(xhr) {
            if (!xhr || xhr.status === 0) {
                return JSON.stringify({
                    hint: null,
                    details: null,
                    code: 0,
                    message: 'Connection error'
                });
            }
            var rangeHeader = xhr.getResponseHeader('Content-Range');
            if (_.isString(rangeHeader)) {
                var _rangeHeader$split = rangeHeader.split('/'),
                    _rangeHeader$split2 = slicedToArray(_rangeHeader$split, 2),
                    headerSize = _rangeHeader$split2[0],
                    headerCount = _rangeHeader$split2[1],
                    _headerSize$split = headerSize.split('-'),
                    _headerSize$split2 = slicedToArray(_headerSize$split, 2),
                    headerFrom = _headerSize$split2[0],
                    headerTo = _headerSize$split2[1],
                    to = parseInt(headerTo) + 1 || 0,
                    from = parseInt(headerFrom) || 0;

                total(parseInt(headerCount));
                resultsCount(to - from);
            }
            try {
                return xhr.responseText;
            } catch (ex) {
                return JSON.stringify({
                    hint: null,
                    details: null,
                    code: 0,
                    message: xhr.responseText
                });
            }
        };
        isLoading(true);
        pageRequest(filters(), page(), {
            background: true,
            extract: getTotal
        }, extraHeaders).then(function (data) {
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
        filters(_.extend({
            order: defaultOrder
        }, parameters));
        collection([]);
        page(1);
        return fetch();
    },
        isLastPage = function isLastPage() {
        return model.pageSize() > resultsCount();
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

function Postgrest() {
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
        return _.extend({}, options, {
            config: mergeConfig(addHeaders(headers), options)
        });
    },
        createLoader = function createLoader(requestFunction, options) {
        var defaultState = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

        var loader = m.prop(defaultState),
            d = m.deferred();
        loader.load = function () {
            loader(true);
            m.redraw();
            requestFunction(_.extend({}, options, {
                background: true
            })).then(function (data) {
                loader(false);
                d.resolve(data);
                m.redraw();
            }, function (error) {
                loader(false);
                d.reject(error);
                m.redraw();
            });
            return d.promise;
        };
        return loader;
    },
        representationHeader = {
        'Prefer': 'return=representation'
    };

    postgrest.token = token;

    postgrest.init = function (apiPrefix, authenticationOptions) {
        postgrest.request = function (options) {
            var errorHandler = function errorHandler(xhr) {
                try {
                    return xhr.responseText;
                } catch (ex) {
                    return JSON.stringify({
                        hint: null,
                        details: null,
                        code: 0,
                        message: xhr.responseText
                    });
                }
            };
            return m.request(_.extend({ extract: errorHandler }, options, {
                url: apiPrefix + options.url
            }));
        };

        postgrest.authenticate = function () {
            var deferred = m.deferred();
            if (token()) {
                deferred.resolve({
                    token: token()
                });
            } else {
                m.request(_.extend({}, authenticationOptions)).then(function (data) {
                    token(data.token);
                    deferred.resolve({
                        token: token()
                    });
                }, function (data) {
                    deferred.reject(data);
                });
            }
            return deferred.promise;
        };

        postgrest.requestWithToken = function (options) {
            return postgrest.authenticate().then(function () {
                return postgrest.request(addConfigHeaders({
                    'Authorization': 'Bearer ' + token()
                }, options));
            }, function () {
                return postgrest.request(options);
            });
        };

        postgrest.loader = _.partial(createLoader, postgrest.request);

        postgrest.loaderWithToken = _.partial(createLoader, postgrest.requestWithToken);

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

                return {
                    'Range-unit': 'items',
                    'Range': toRange()
                };
            },
                pageSize = m.prop(10),
                nameOptions = {
                url: '/' + name
            },
                getOptions = function getOptions(data, page, pageSize, options) {
                var headers = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};

                var extraHeaders = _.extend({}, {
                    'Prefer': 'count=none'
                }, headers, paginationHeaders(page, pageSize));
                return addConfigHeaders(extraHeaders, _.extend({}, options, nameOptions, {
                    method: 'GET',
                    data: data
                }));
            },
                querystring = function querystring(filters, options) {
                options.url += '?' + m.route.buildQueryString(filters);
                return options;
            },
                options = function options(_options) {
                return postgrest.request(_.extend({}, _options, nameOptions, {
                    method: 'OPTIONS'
                }));
            },
                postOptions = function postOptions(attributes, options) {
                var headers = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

                var extraHeaders = _.extend({}, representationHeader, headers);
                return addConfigHeaders(extraHeaders, _.extend({}, options, nameOptions, {
                    method: 'POST',
                    data: attributes
                }));
            },
                deleteOptions = function deleteOptions(filters, options) {
                var headers = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

                var extraHeaders = addHeaders(_.extend({}, headers));
                return querystring(filters, addConfigHeaders(extraHeaders, _.extend({}, options, nameOptions, {
                    method: 'DELETE'
                })));
            },
                patchOptions = function patchOptions(filters, attributes, options) {
                var headers = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

                var extraHeaders = _.extend({}, representationHeader, headers);
                return querystring(filters, addConfigHeaders(extraHeaders, _.extend({}, options, nameOptions, {
                    method: 'PATCH',
                    data: attributes
                })));
            },
                getPageOptions = function getPageOptions(data, page, options) {
                var headers = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

                return getOptions(data, page || 1, pageSize(), options, headers);
            },
                getRowOptions = function getRowOptions(data, options) {
                var headers = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

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

    postgrest.filtersVM = filtersVM;
    postgrest.paginationVM = paginationVM;

    return postgrest;
}

return Postgrest;

})));

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiIiwic291cmNlcyI6WyJzcmMvKiovKi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gKGdsb2JhbCwgZmFjdG9yeSkge1xuXHR0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgPyBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkocmVxdWlyZSgnbWl0aHJpbCcpLCByZXF1aXJlKCd1bmRlcnNjb3JlJykpIDpcblx0dHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kID8gZGVmaW5lKFsnbWl0aHJpbCcsICd1bmRlcnNjb3JlJ10sIGZhY3RvcnkpIDpcblx0KGdsb2JhbC5Qb3N0Z3Jlc3QgPSBmYWN0b3J5KGdsb2JhbC5tLGdsb2JhbC5fKSk7XG59KHRoaXMsIChmdW5jdGlvbiAobSxfKSB7ICd1c2Ugc3RyaWN0JztcblxubSA9IG0gJiYgbS5oYXNPd25Qcm9wZXJ0eSgnZGVmYXVsdCcpID8gbVsnZGVmYXVsdCddIDogbTtcbl8gPSBfICYmIF8uaGFzT3duUHJvcGVydHkoJ2RlZmF1bHQnKSA/IF9bJ2RlZmF1bHQnXSA6IF87XG5cbnZhciBmaWx0ZXJzVk0gPSBmdW5jdGlvbiBmaWx0ZXJzVk0oYXR0cmlidXRlcykge1xuICAgIHZhciBuZXdWTSA9IHt9LFxuICAgICAgICBmaWx0ZXIgPSBmdW5jdGlvbiBmaWx0ZXIoKSB7XG4gICAgICAgIHZhciBwcm9wID0gbS5wcm9wKCcnKSxcbiAgICAgICAgICAgIGZpbHRlclByb3AgPSBmdW5jdGlvbiBmaWx0ZXJQcm9wKHZhbHVlKSB7XG4gICAgICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBwcm9wKHZhbHVlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3Vk07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcHJvcCgpO1xuICAgICAgICB9O1xuICAgICAgICAvLyBKdXN0IHNvIHdlIGNhbiBoYXZlIGEgZGVmYXVsdCB0b19maWx0ZXIgYW5kIGF2b2lkIGlmIF8uaXNGdW5jdGlvbiBjYWxsc1xuICAgICAgICBmaWx0ZXJQcm9wLnRvRmlsdGVyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIF8uaXNTdHJpbmcoZmlsdGVyUHJvcCgpKSA/IGZpbHRlclByb3AoKS50cmltKCkgOiBmaWx0ZXJQcm9wKCk7XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBmaWx0ZXJQcm9wO1xuICAgIH0sXG4gICAgICAgIGdldHRlcnMgPSBfLnJlZHVjZShhdHRyaWJ1dGVzLCBmdW5jdGlvbiAobWVtbywgb3BlcmF0b3IsIGF0dHIpIHtcbiAgICAgICAgLy8gVGhlIG9wZXJhdG9yIGJldHdlZW4gaXMgaW1wbGVtZW50ZWQgd2l0aCB0d28gcHJvcGVydGllcywgb25lIGZvciBncmVhdGVyIHRoYW4gdmFsdWUgYW5kIGFub3RoZXIgZm9yIGxlc3NlciB0aGFuIHZhbHVlLlxuICAgICAgICAvLyBCb3RoIHByb3BlcnRpZXMgYXJlIHNlbnQgaW4gdGhlIHF1ZXVyeXN0cmluZyB3aXRoIHRoZSBzYW1lIG5hbWUsXG4gICAgICAgIC8vIHRoYXQncyB3aHkgd2UgbmVlZCB0aGUgc3BlY2lhbCBjYXNlIGhlcmUsIHNvIHdlIGNhbiB1c2UgYSBzaW1wbGUgbWFwIGFzIGFyZ3VtZW50IHRvIGZpbHRlcnNWTS5cbiAgICAgICAgaWYgKG9wZXJhdG9yID09PSAnYmV0d2VlbicpIHtcbiAgICAgICAgICAgIG1lbW9bYXR0cl0gPSB7XG4gICAgICAgICAgICAgICAgbHRlOiBmaWx0ZXIoKSxcbiAgICAgICAgICAgICAgICBndGU6IGZpbHRlcigpXG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWVtb1thdHRyXSA9IGZpbHRlcigpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtZW1vO1xuICAgIH0sIHtcbiAgICAgICAgb3JkZXI6IGZpbHRlcigpXG4gICAgfSksXG4gICAgICAgIHBhcmFtZXRlcnNXaXRob3V0T3JkZXIgPSBmdW5jdGlvbiBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyKCkge1xuICAgICAgICByZXR1cm4gXy5yZWR1Y2UoZ2V0dGVycywgZnVuY3Rpb24gKG1lbW8sIGdldHRlciwgYXR0cikge1xuICAgICAgICAgICAgaWYgKGF0dHIgIT09ICdvcmRlcicpIHtcbiAgICAgICAgICAgICAgICB2YXIgb3BlcmF0b3IgPSBhdHRyaWJ1dGVzW2F0dHJdO1xuXG4gICAgICAgICAgICAgICAgaWYgKF8uaXNGdW5jdGlvbihnZXR0ZXIudG9GaWx0ZXIpICYmIChnZXR0ZXIudG9GaWx0ZXIoKSA9PT0gdW5kZWZpbmVkIHx8IGdldHRlci50b0ZpbHRlcigpID09PSAnJykpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gQmVsbG93IHdlIHVzZSBkaWZmZXJlbnQgZm9ybWF0dGluZyBydWxlcyBmb3IgdGhlIHZhbHVlIGRlcGVuZGluZyBvbiB0aGUgb3BlcmF0b3JcbiAgICAgICAgICAgICAgICAvLyBUaGVzZSBydWxlcyBhcmUgdXNlZCByZWdhcmRsZXNzIG9mIHRoZSB0b0ZpbHRlciBmdW5jdGlvbixcbiAgICAgICAgICAgICAgICAvLyBzbyB0aGUgdXNlciBjYW4gdXNlIGEgY3VzdG9tIHRvRmlsdGVyIHdpdGhvdXQgaGF2aW5nIHRvIHdvcnJ5IHdpdGggYmFzaWMgZmlsdGVyIHN5bnRheFxuICAgICAgICAgICAgICAgIGlmIChvcGVyYXRvciA9PT0gJ2lsaWtlJyB8fCBvcGVyYXRvciA9PT0gJ2xpa2UnKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lbW9bYXR0cl0gPSBvcGVyYXRvciArICcuKicgKyBnZXR0ZXIudG9GaWx0ZXIoKSArICcqJztcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG9wZXJhdG9yID09PSAnQEAnKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lbW9bYXR0cl0gPSBvcGVyYXRvciArICcuJyArIGdldHRlci50b0ZpbHRlcigpLnJlcGxhY2UoL1xccysvZywgJyYnKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG9wZXJhdG9yID09PSAnYmV0d2VlbicpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFnZXR0ZXIubHRlLnRvRmlsdGVyKCkgJiYgIWdldHRlci5ndGUudG9GaWx0ZXIoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZ2V0dGVyLmd0ZSgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdLnB1c2goJ2d0ZS4nICsgZ2V0dGVyLmd0ZS50b0ZpbHRlcigpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoZ2V0dGVyLmx0ZSgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdLnB1c2goJ2x0ZS4nICsgZ2V0dGVyLmx0ZS50b0ZpbHRlcigpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAob3BlcmF0b3IgPT09ICdpcy5udWxsJykge1xuICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gZ2V0dGVyLnRvRmlsdGVyKCkgPT09IG51bGwgPyAnaXMubnVsbCcgOiAnbm90LmlzLm51bGwnO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG1lbW9bYXR0cl0gPSBvcGVyYXRvciArICcuJyArIGdldHRlci50b0ZpbHRlcigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICB9LCB7fSk7XG4gICAgfSxcbiAgICAgICAgcGFyYW1ldGVycyA9IGZ1bmN0aW9uIHBhcmFtZXRlcnMoKSB7XG4gICAgICAgIC8vIFRoZSBvcmRlciBwYXJhbWV0ZXJzIGhhdmUgYSBzcGVjaWFsIHN5bnRheCAoanVzdCBsaWtlIGFuIG9yZGVyIGJ5IFNRTCBjbGF1c2UpXG4gICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9iZWdyaWZmcy9wb3N0Z3Jlc3Qvd2lraS9Sb3V0aW5nI2ZpbHRlcmluZy1hbmQtb3JkZXJpbmdcbiAgICAgICAgdmFyIG9yZGVyID0gZnVuY3Rpb24gb3JkZXIoKSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0dGVycy5vcmRlcigpICYmIF8ucmVkdWNlKGdldHRlcnMub3JkZXIoKSwgZnVuY3Rpb24gKG1lbW8sIGRpcmVjdGlvbiwgYXR0cikge1xuICAgICAgICAgICAgICAgIG1lbW8ucHVzaChhdHRyICsgJy4nICsgZGlyZWN0aW9uKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgICAgIH0sIFtdKS5qb2luKCcsJyk7XG4gICAgICAgIH0sXG4gICAgICAgICAgICBvcmRlclBhcmFtZXRlciA9IG9yZGVyKCkgPyB7XG4gICAgICAgICAgICBvcmRlcjogb3JkZXIoKVxuICAgICAgICB9IDoge307XG5cbiAgICAgICAgcmV0dXJuIF8uZXh0ZW5kKHt9LCBvcmRlclBhcmFtZXRlciwgcGFyYW1ldGVyc1dpdGhvdXRPcmRlcigpKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIF8uZXh0ZW5kKG5ld1ZNLCBnZXR0ZXJzLCB7XG4gICAgICAgIHBhcmFtZXRlcnM6IHBhcmFtZXRlcnMsXG4gICAgICAgIHBhcmFtZXRlcnNXaXRob3V0T3JkZXI6IHBhcmFtZXRlcnNXaXRob3V0T3JkZXJcbiAgICB9KTtcbn07XG5cbnZhciBhc3luY0dlbmVyYXRvciA9IGZ1bmN0aW9uICgpIHtcbiAgZnVuY3Rpb24gQXdhaXRWYWx1ZSh2YWx1ZSkge1xuICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIEFzeW5jR2VuZXJhdG9yKGdlbikge1xuICAgIHZhciBmcm9udCwgYmFjaztcblxuICAgIGZ1bmN0aW9uIHNlbmQoa2V5LCBhcmcpIHtcbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgIHZhciByZXF1ZXN0ID0ge1xuICAgICAgICAgIGtleToga2V5LFxuICAgICAgICAgIGFyZzogYXJnLFxuICAgICAgICAgIHJlc29sdmU6IHJlc29sdmUsXG4gICAgICAgICAgcmVqZWN0OiByZWplY3QsXG4gICAgICAgICAgbmV4dDogbnVsbFxuICAgICAgICB9O1xuXG4gICAgICAgIGlmIChiYWNrKSB7XG4gICAgICAgICAgYmFjayA9IGJhY2submV4dCA9IHJlcXVlc3Q7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZnJvbnQgPSBiYWNrID0gcmVxdWVzdDtcbiAgICAgICAgICByZXN1bWUoa2V5LCBhcmcpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZXN1bWUoa2V5LCBhcmcpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHZhciByZXN1bHQgPSBnZW5ba2V5XShhcmcpO1xuICAgICAgICB2YXIgdmFsdWUgPSByZXN1bHQudmFsdWU7XG5cbiAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgQXdhaXRWYWx1ZSkge1xuICAgICAgICAgIFByb21pc2UucmVzb2x2ZSh2YWx1ZS52YWx1ZSkudGhlbihmdW5jdGlvbiAoYXJnKSB7XG4gICAgICAgICAgICByZXN1bWUoXCJuZXh0XCIsIGFyZyk7XG4gICAgICAgICAgfSwgZnVuY3Rpb24gKGFyZykge1xuICAgICAgICAgICAgcmVzdW1lKFwidGhyb3dcIiwgYXJnKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzZXR0bGUocmVzdWx0LmRvbmUgPyBcInJldHVyblwiIDogXCJub3JtYWxcIiwgcmVzdWx0LnZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHNldHRsZShcInRocm93XCIsIGVycik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2V0dGxlKHR5cGUsIHZhbHVlKSB7XG4gICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgY2FzZSBcInJldHVyblwiOlxuICAgICAgICAgIGZyb250LnJlc29sdmUoe1xuICAgICAgICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgICAgICAgZG9uZTogdHJ1ZVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgXCJ0aHJvd1wiOlxuICAgICAgICAgIGZyb250LnJlamVjdCh2YWx1ZSk7XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBmcm9udC5yZXNvbHZlKHtcbiAgICAgICAgICAgIHZhbHVlOiB2YWx1ZSxcbiAgICAgICAgICAgIGRvbmU6IGZhbHNlXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGZyb250ID0gZnJvbnQubmV4dDtcblxuICAgICAgaWYgKGZyb250KSB7XG4gICAgICAgIHJlc3VtZShmcm9udC5rZXksIGZyb250LmFyZyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBiYWNrID0gbnVsbDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLl9pbnZva2UgPSBzZW5kO1xuXG4gICAgaWYgKHR5cGVvZiBnZW4ucmV0dXJuICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIHRoaXMucmV0dXJuID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgfVxuXG4gIGlmICh0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgU3ltYm9sLmFzeW5jSXRlcmF0b3IpIHtcbiAgICBBc3luY0dlbmVyYXRvci5wcm90b3R5cGVbU3ltYm9sLmFzeW5jSXRlcmF0b3JdID0gZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcbiAgfVxuXG4gIEFzeW5jR2VuZXJhdG9yLnByb3RvdHlwZS5uZXh0ID0gZnVuY3Rpb24gKGFyZykge1xuICAgIHJldHVybiB0aGlzLl9pbnZva2UoXCJuZXh0XCIsIGFyZyk7XG4gIH07XG5cbiAgQXN5bmNHZW5lcmF0b3IucHJvdG90eXBlLnRocm93ID0gZnVuY3Rpb24gKGFyZykge1xuICAgIHJldHVybiB0aGlzLl9pbnZva2UoXCJ0aHJvd1wiLCBhcmcpO1xuICB9O1xuXG4gIEFzeW5jR2VuZXJhdG9yLnByb3RvdHlwZS5yZXR1cm4gPSBmdW5jdGlvbiAoYXJnKSB7XG4gICAgcmV0dXJuIHRoaXMuX2ludm9rZShcInJldHVyblwiLCBhcmcpO1xuICB9O1xuXG4gIHJldHVybiB7XG4gICAgd3JhcDogZnVuY3Rpb24gKGZuKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gbmV3IEFzeW5jR2VuZXJhdG9yKGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cykpO1xuICAgICAgfTtcbiAgICB9LFxuICAgIGF3YWl0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgIHJldHVybiBuZXcgQXdhaXRWYWx1ZSh2YWx1ZSk7XG4gICAgfVxuICB9O1xufSgpO1xuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbnZhciBzbGljZWRUb0FycmF5ID0gZnVuY3Rpb24gKCkge1xuICBmdW5jdGlvbiBzbGljZUl0ZXJhdG9yKGFyciwgaSkge1xuICAgIHZhciBfYXJyID0gW107XG4gICAgdmFyIF9uID0gdHJ1ZTtcbiAgICB2YXIgX2QgPSBmYWxzZTtcbiAgICB2YXIgX2UgPSB1bmRlZmluZWQ7XG5cbiAgICB0cnkge1xuICAgICAgZm9yICh2YXIgX2kgPSBhcnJbU3ltYm9sLml0ZXJhdG9yXSgpLCBfczsgIShfbiA9IChfcyA9IF9pLm5leHQoKSkuZG9uZSk7IF9uID0gdHJ1ZSkge1xuICAgICAgICBfYXJyLnB1c2goX3MudmFsdWUpO1xuXG4gICAgICAgIGlmIChpICYmIF9hcnIubGVuZ3RoID09PSBpKSBicmVhaztcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIF9kID0gdHJ1ZTtcbiAgICAgIF9lID0gZXJyO1xuICAgIH0gZmluYWxseSB7XG4gICAgICB0cnkge1xuICAgICAgICBpZiAoIV9uICYmIF9pW1wicmV0dXJuXCJdKSBfaVtcInJldHVyblwiXSgpO1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgaWYgKF9kKSB0aHJvdyBfZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gX2FycjtcbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbiAoYXJyLCBpKSB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoYXJyKSkge1xuICAgICAgcmV0dXJuIGFycjtcbiAgICB9IGVsc2UgaWYgKFN5bWJvbC5pdGVyYXRvciBpbiBPYmplY3QoYXJyKSkge1xuICAgICAgcmV0dXJuIHNsaWNlSXRlcmF0b3IoYXJyLCBpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkludmFsaWQgYXR0ZW1wdCB0byBkZXN0cnVjdHVyZSBub24taXRlcmFibGUgaW5zdGFuY2VcIik7XG4gICAgfVxuICB9O1xufSgpO1xuXG52YXIgcGFnaW5hdGlvblZNID0gZnVuY3Rpb24gcGFnaW5hdGlvblZNKG1vZGVsLCBvcmRlcikge1xuICAgIHZhciBleHRyYUhlYWRlcnMgPSBhcmd1bWVudHMubGVuZ3RoID4gMiAmJiBhcmd1bWVudHNbMl0gIT09IHVuZGVmaW5lZCA/IGFyZ3VtZW50c1syXSA6IHt9O1xuICAgIHZhciBhdXRoZW50aWNhdGUgPSBhcmd1bWVudHMubGVuZ3RoID4gMyAmJiBhcmd1bWVudHNbM10gIT09IHVuZGVmaW5lZCA/IGFyZ3VtZW50c1szXSA6IHRydWU7XG5cbiAgICB2YXIgY29sbGVjdGlvbiA9IG0ucHJvcChbXSksXG4gICAgICAgIGRlZmF1bHRPcmRlciA9IG9yZGVyIHx8ICdpZC5kZXNjJyxcbiAgICAgICAgZmlsdGVycyA9IG0ucHJvcCh7XG4gICAgICAgIG9yZGVyOiBkZWZhdWx0T3JkZXJcbiAgICB9KSxcbiAgICAgICAgaXNMb2FkaW5nID0gbS5wcm9wKGZhbHNlKSxcbiAgICAgICAgcGFnZSA9IG0ucHJvcCgxKSxcbiAgICAgICAgcmVzdWx0c0NvdW50ID0gbS5wcm9wKCksXG4gICAgICAgIHBhZ2VSZXF1ZXN0ID0gYXV0aGVudGljYXRlID8gbW9kZWwuZ2V0UGFnZVdpdGhUb2tlbiA6IG1vZGVsLmdldFBhZ2UsXG4gICAgICAgIHRvdGFsID0gbS5wcm9wKCk7XG5cbiAgICB2YXIgZmV0Y2ggPSBmdW5jdGlvbiBmZXRjaCgpIHtcbiAgICAgICAgdmFyIGQgPSBtLmRlZmVycmVkKCk7XG4gICAgICAgIHZhciBnZXRUb3RhbCA9IGZ1bmN0aW9uIGdldFRvdGFsKHhocikge1xuICAgICAgICAgICAgaWYgKCF4aHIgfHwgeGhyLnN0YXR1cyA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgIGhpbnQ6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIGRldGFpbHM6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIGNvZGU6IDAsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdDb25uZWN0aW9uIGVycm9yJ1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHJhbmdlSGVhZGVyID0geGhyLmdldFJlc3BvbnNlSGVhZGVyKCdDb250ZW50LVJhbmdlJyk7XG4gICAgICAgICAgICBpZiAoXy5pc1N0cmluZyhyYW5nZUhlYWRlcikpIHtcbiAgICAgICAgICAgICAgICB2YXIgX3JhbmdlSGVhZGVyJHNwbGl0ID0gcmFuZ2VIZWFkZXIuc3BsaXQoJy8nKSxcbiAgICAgICAgICAgICAgICAgICAgX3JhbmdlSGVhZGVyJHNwbGl0MiA9IHNsaWNlZFRvQXJyYXkoX3JhbmdlSGVhZGVyJHNwbGl0LCAyKSxcbiAgICAgICAgICAgICAgICAgICAgaGVhZGVyU2l6ZSA9IF9yYW5nZUhlYWRlciRzcGxpdDJbMF0sXG4gICAgICAgICAgICAgICAgICAgIGhlYWRlckNvdW50ID0gX3JhbmdlSGVhZGVyJHNwbGl0MlsxXSxcbiAgICAgICAgICAgICAgICAgICAgX2hlYWRlclNpemUkc3BsaXQgPSBoZWFkZXJTaXplLnNwbGl0KCctJyksXG4gICAgICAgICAgICAgICAgICAgIF9oZWFkZXJTaXplJHNwbGl0MiA9IHNsaWNlZFRvQXJyYXkoX2hlYWRlclNpemUkc3BsaXQsIDIpLFxuICAgICAgICAgICAgICAgICAgICBoZWFkZXJGcm9tID0gX2hlYWRlclNpemUkc3BsaXQyWzBdLFxuICAgICAgICAgICAgICAgICAgICBoZWFkZXJUbyA9IF9oZWFkZXJTaXplJHNwbGl0MlsxXSxcbiAgICAgICAgICAgICAgICAgICAgdG8gPSBwYXJzZUludChoZWFkZXJUbykgKyAxIHx8IDAsXG4gICAgICAgICAgICAgICAgICAgIGZyb20gPSBwYXJzZUludChoZWFkZXJGcm9tKSB8fCAwO1xuXG4gICAgICAgICAgICAgICAgdG90YWwocGFyc2VJbnQoaGVhZGVyQ291bnQpKTtcbiAgICAgICAgICAgICAgICByZXN1bHRzQ291bnQodG8gLSBmcm9tKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHhoci5yZXNwb25zZVRleHQ7XG4gICAgICAgICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgIGhpbnQ6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIGRldGFpbHM6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIGNvZGU6IDAsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IHhoci5yZXNwb25zZVRleHRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgaXNMb2FkaW5nKHRydWUpO1xuICAgICAgICBwYWdlUmVxdWVzdChmaWx0ZXJzKCksIHBhZ2UoKSwge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdHJ1ZSxcbiAgICAgICAgICAgIGV4dHJhY3Q6IGdldFRvdGFsXG4gICAgICAgIH0sIGV4dHJhSGVhZGVycykudGhlbihmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICAgICAgY29sbGVjdGlvbihfLnVuaW9uKGNvbGxlY3Rpb24oKSwgZGF0YSkpO1xuICAgICAgICAgICAgaXNMb2FkaW5nKGZhbHNlKTtcbiAgICAgICAgICAgIGQucmVzb2x2ZShjb2xsZWN0aW9uKCkpO1xuICAgICAgICAgICAgbS5yZWRyYXcoKTtcbiAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICBpc0xvYWRpbmcoZmFsc2UpO1xuICAgICAgICAgICAgdG90YWwoMCk7XG4gICAgICAgICAgICBkLnJlamVjdChlcnJvcik7XG4gICAgICAgICAgICBtLnJlZHJhdygpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGQucHJvbWlzZTtcbiAgICB9LFxuICAgICAgICBmaXJzdFBhZ2UgPSBmdW5jdGlvbiBmaXJzdFBhZ2UocGFyYW1ldGVycykge1xuICAgICAgICBmaWx0ZXJzKF8uZXh0ZW5kKHtcbiAgICAgICAgICAgIG9yZGVyOiBkZWZhdWx0T3JkZXJcbiAgICAgICAgfSwgcGFyYW1ldGVycykpO1xuICAgICAgICBjb2xsZWN0aW9uKFtdKTtcbiAgICAgICAgcGFnZSgxKTtcbiAgICAgICAgcmV0dXJuIGZldGNoKCk7XG4gICAgfSxcbiAgICAgICAgaXNMYXN0UGFnZSA9IGZ1bmN0aW9uIGlzTGFzdFBhZ2UoKSB7XG4gICAgICAgIHJldHVybiBtb2RlbC5wYWdlU2l6ZSgpID4gcmVzdWx0c0NvdW50KCk7XG4gICAgfSxcbiAgICAgICAgbmV4dFBhZ2UgPSBmdW5jdGlvbiBuZXh0UGFnZSgpIHtcbiAgICAgICAgcGFnZShwYWdlKCkgKyAxKTtcbiAgICAgICAgcmV0dXJuIGZldGNoKCk7XG4gICAgfTtcblxuICAgIHJldHVybiB7XG4gICAgICAgIGNvbGxlY3Rpb246IGNvbGxlY3Rpb24sXG4gICAgICAgIGZpcnN0UGFnZTogZmlyc3RQYWdlLFxuICAgICAgICBpc0xvYWRpbmc6IGlzTG9hZGluZyxcbiAgICAgICAgbmV4dFBhZ2U6IG5leHRQYWdlLFxuICAgICAgICBpc0xhc3RQYWdlOiBpc0xhc3RQYWdlLFxuICAgICAgICB0b3RhbDogdG90YWwsXG4gICAgICAgIHJlc3VsdHNDb3VudDogcmVzdWx0c0NvdW50XG4gICAgfTtcbn07XG5cbmZ1bmN0aW9uIFBvc3RncmVzdCgpIHtcbiAgICB2YXIgcG9zdGdyZXN0ID0ge307XG5cbiAgICB2YXIgdG9rZW4gPSBtLnByb3AoKSxcbiAgICAgICAgbWVyZ2VDb25maWcgPSBmdW5jdGlvbiBtZXJnZUNvbmZpZyhjb25maWcsIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIG9wdGlvbnMgJiYgXy5pc0Z1bmN0aW9uKG9wdGlvbnMuY29uZmlnKSA/IF8uY29tcG9zZShvcHRpb25zLmNvbmZpZywgY29uZmlnKSA6IGNvbmZpZztcbiAgICB9LFxuICAgICAgICBhZGRIZWFkZXJzID0gZnVuY3Rpb24gYWRkSGVhZGVycyhoZWFkZXJzKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoeGhyKSB7XG4gICAgICAgICAgICBfLmVhY2goaGVhZGVycywgZnVuY3Rpb24gKHZhbHVlLCBrZXkpIHtcbiAgICAgICAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihrZXksIHZhbHVlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHhocjtcbiAgICAgICAgfTtcbiAgICB9LFxuICAgICAgICBhZGRDb25maWdIZWFkZXJzID0gZnVuY3Rpb24gYWRkQ29uZmlnSGVhZGVycyhoZWFkZXJzLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiBfLmV4dGVuZCh7fSwgb3B0aW9ucywge1xuICAgICAgICAgICAgY29uZmlnOiBtZXJnZUNvbmZpZyhhZGRIZWFkZXJzKGhlYWRlcnMpLCBvcHRpb25zKVxuICAgICAgICB9KTtcbiAgICB9LFxuICAgICAgICBjcmVhdGVMb2FkZXIgPSBmdW5jdGlvbiBjcmVhdGVMb2FkZXIocmVxdWVzdEZ1bmN0aW9uLCBvcHRpb25zKSB7XG4gICAgICAgIHZhciBkZWZhdWx0U3RhdGUgPSBhcmd1bWVudHMubGVuZ3RoID4gMiAmJiBhcmd1bWVudHNbMl0gIT09IHVuZGVmaW5lZCA/IGFyZ3VtZW50c1syXSA6IGZhbHNlO1xuXG4gICAgICAgIHZhciBsb2FkZXIgPSBtLnByb3AoZGVmYXVsdFN0YXRlKSxcbiAgICAgICAgICAgIGQgPSBtLmRlZmVycmVkKCk7XG4gICAgICAgIGxvYWRlci5sb2FkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgbG9hZGVyKHRydWUpO1xuICAgICAgICAgICAgbS5yZWRyYXcoKTtcbiAgICAgICAgICAgIHJlcXVlc3RGdW5jdGlvbihfLmV4dGVuZCh7fSwgb3B0aW9ucywge1xuICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6IHRydWVcbiAgICAgICAgICAgIH0pKS50aGVuKGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgbG9hZGVyKGZhbHNlKTtcbiAgICAgICAgICAgICAgICBkLnJlc29sdmUoZGF0YSk7XG4gICAgICAgICAgICAgICAgbS5yZWRyYXcoKTtcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGxvYWRlcihmYWxzZSk7XG4gICAgICAgICAgICAgICAgZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgIG0ucmVkcmF3KCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBkLnByb21pc2U7XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBsb2FkZXI7XG4gICAgfSxcbiAgICAgICAgcmVwcmVzZW50YXRpb25IZWFkZXIgPSB7XG4gICAgICAgICdQcmVmZXInOiAncmV0dXJuPXJlcHJlc2VudGF0aW9uJ1xuICAgIH07XG5cbiAgICBwb3N0Z3Jlc3QudG9rZW4gPSB0b2tlbjtcblxuICAgIHBvc3RncmVzdC5pbml0ID0gZnVuY3Rpb24gKGFwaVByZWZpeCwgYXV0aGVudGljYXRpb25PcHRpb25zKSB7XG4gICAgICAgIHBvc3RncmVzdC5yZXF1ZXN0ID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHZhciBlcnJvckhhbmRsZXIgPSBmdW5jdGlvbiBlcnJvckhhbmRsZXIoeGhyKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHhoci5yZXNwb25zZVRleHQ7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGhpbnQ6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXRhaWxzOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IHhoci5yZXNwb25zZVRleHRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiBtLnJlcXVlc3QoXy5leHRlbmQoeyBleHRyYWN0OiBlcnJvckhhbmRsZXIgfSwgb3B0aW9ucywge1xuICAgICAgICAgICAgICAgIHVybDogYXBpUHJlZml4ICsgb3B0aW9ucy51cmxcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfTtcblxuICAgICAgICBwb3N0Z3Jlc3QuYXV0aGVudGljYXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIGRlZmVycmVkID0gbS5kZWZlcnJlZCgpO1xuICAgICAgICAgICAgaWYgKHRva2VuKCkpIHtcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHtcbiAgICAgICAgICAgICAgICAgICAgdG9rZW46IHRva2VuKClcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbS5yZXF1ZXN0KF8uZXh0ZW5kKHt9LCBhdXRoZW50aWNhdGlvbk9wdGlvbnMpKS50aGVuKGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIHRva2VuKGRhdGEudG9rZW4pO1xuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRva2VuOiB0b2tlbigpXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChkYXRhKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgICAgICB9O1xuXG4gICAgICAgIHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHJldHVybiBwb3N0Z3Jlc3QuYXV0aGVudGljYXRlKCkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBvc3RncmVzdC5yZXF1ZXN0KGFkZENvbmZpZ0hlYWRlcnMoe1xuICAgICAgICAgICAgICAgICAgICAnQXV0aG9yaXphdGlvbic6ICdCZWFyZXIgJyArIHRva2VuKClcbiAgICAgICAgICAgICAgICB9LCBvcHRpb25zKSk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBvc3RncmVzdC5yZXF1ZXN0KG9wdGlvbnMpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgcG9zdGdyZXN0LmxvYWRlciA9IF8ucGFydGlhbChjcmVhdGVMb2FkZXIsIHBvc3RncmVzdC5yZXF1ZXN0KTtcblxuICAgICAgICBwb3N0Z3Jlc3QubG9hZGVyV2l0aFRva2VuID0gXy5wYXJ0aWFsKGNyZWF0ZUxvYWRlciwgcG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4pO1xuXG4gICAgICAgIHBvc3RncmVzdC5tb2RlbCA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgICAgICB2YXIgcGFnaW5hdGlvbkhlYWRlcnMgPSBmdW5jdGlvbiBwYWdpbmF0aW9uSGVhZGVycyhwYWdlLCBwYWdlU2l6ZSkge1xuICAgICAgICAgICAgICAgIGlmICghcGFnZVNpemUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZhciB0b1JhbmdlID0gZnVuY3Rpb24gdG9SYW5nZSgpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZyb20gPSAocGFnZSAtIDEpICogcGFnZVNpemUsXG4gICAgICAgICAgICAgICAgICAgICAgICB0byA9IGZyb20gKyBwYWdlU2l6ZSAtIDE7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmcm9tICsgJy0nICsgdG87XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICdSYW5nZS11bml0JzogJ2l0ZW1zJyxcbiAgICAgICAgICAgICAgICAgICAgJ1JhbmdlJzogdG9SYW5nZSgpXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcGFnZVNpemUgPSBtLnByb3AoMTApLFxuICAgICAgICAgICAgICAgIG5hbWVPcHRpb25zID0ge1xuICAgICAgICAgICAgICAgIHVybDogJy8nICsgbmFtZVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBnZXRPcHRpb25zID0gZnVuY3Rpb24gZ2V0T3B0aW9ucyhkYXRhLCBwYWdlLCBwYWdlU2l6ZSwgb3B0aW9ucykge1xuICAgICAgICAgICAgICAgIHZhciBoZWFkZXJzID0gYXJndW1lbnRzLmxlbmd0aCA+IDQgJiYgYXJndW1lbnRzWzRdICE9PSB1bmRlZmluZWQgPyBhcmd1bWVudHNbNF0gOiB7fTtcblxuICAgICAgICAgICAgICAgIHZhciBleHRyYUhlYWRlcnMgPSBfLmV4dGVuZCh7fSwge1xuICAgICAgICAgICAgICAgICAgICAnUHJlZmVyJzogJ2NvdW50PW5vbmUnXG4gICAgICAgICAgICAgICAgfSwgaGVhZGVycywgcGFnaW5hdGlvbkhlYWRlcnMocGFnZSwgcGFnZVNpemUpKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gYWRkQ29uZmlnSGVhZGVycyhleHRyYUhlYWRlcnMsIF8uZXh0ZW5kKHt9LCBvcHRpb25zLCBuYW1lT3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiBkYXRhXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBxdWVyeXN0cmluZyA9IGZ1bmN0aW9uIHF1ZXJ5c3RyaW5nKGZpbHRlcnMsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICBvcHRpb25zLnVybCArPSAnPycgKyBtLnJvdXRlLmJ1aWxkUXVlcnlTdHJpbmcoZmlsdGVycyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9wdGlvbnM7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIG9wdGlvbnMgPSBmdW5jdGlvbiBvcHRpb25zKF9vcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBvc3RncmVzdC5yZXF1ZXN0KF8uZXh0ZW5kKHt9LCBfb3B0aW9ucywgbmFtZU9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnT1BUSU9OUydcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHBvc3RPcHRpb25zID0gZnVuY3Rpb24gcG9zdE9wdGlvbnMoYXR0cmlidXRlcywgb3B0aW9ucykge1xuICAgICAgICAgICAgICAgIHZhciBoZWFkZXJzID0gYXJndW1lbnRzLmxlbmd0aCA+IDIgJiYgYXJndW1lbnRzWzJdICE9PSB1bmRlZmluZWQgPyBhcmd1bWVudHNbMl0gOiB7fTtcblxuICAgICAgICAgICAgICAgIHZhciBleHRyYUhlYWRlcnMgPSBfLmV4dGVuZCh7fSwgcmVwcmVzZW50YXRpb25IZWFkZXIsIGhlYWRlcnMpO1xuICAgICAgICAgICAgICAgIHJldHVybiBhZGRDb25maWdIZWFkZXJzKGV4dHJhSGVhZGVycywgXy5leHRlbmQoe30sIG9wdGlvbnMsIG5hbWVPcHRpb25zLCB7XG4gICAgICAgICAgICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiBhdHRyaWJ1dGVzXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBkZWxldGVPcHRpb25zID0gZnVuY3Rpb24gZGVsZXRlT3B0aW9ucyhmaWx0ZXJzLCBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgdmFyIGhlYWRlcnMgPSBhcmd1bWVudHMubGVuZ3RoID4gMiAmJiBhcmd1bWVudHNbMl0gIT09IHVuZGVmaW5lZCA/IGFyZ3VtZW50c1syXSA6IHt9O1xuXG4gICAgICAgICAgICAgICAgdmFyIGV4dHJhSGVhZGVycyA9IGFkZEhlYWRlcnMoXy5leHRlbmQoe30sIGhlYWRlcnMpKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcXVlcnlzdHJpbmcoZmlsdGVycywgYWRkQ29uZmlnSGVhZGVycyhleHRyYUhlYWRlcnMsIF8uZXh0ZW5kKHt9LCBvcHRpb25zLCBuYW1lT3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdERUxFVEUnXG4gICAgICAgICAgICAgICAgfSkpKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcGF0Y2hPcHRpb25zID0gZnVuY3Rpb24gcGF0Y2hPcHRpb25zKGZpbHRlcnMsIGF0dHJpYnV0ZXMsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICB2YXIgaGVhZGVycyA9IGFyZ3VtZW50cy5sZW5ndGggPiAzICYmIGFyZ3VtZW50c1szXSAhPT0gdW5kZWZpbmVkID8gYXJndW1lbnRzWzNdIDoge307XG5cbiAgICAgICAgICAgICAgICB2YXIgZXh0cmFIZWFkZXJzID0gXy5leHRlbmQoe30sIHJlcHJlc2VudGF0aW9uSGVhZGVyLCBoZWFkZXJzKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcXVlcnlzdHJpbmcoZmlsdGVycywgYWRkQ29uZmlnSGVhZGVycyhleHRyYUhlYWRlcnMsIF8uZXh0ZW5kKHt9LCBvcHRpb25zLCBuYW1lT3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdQQVRDSCcsXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IGF0dHJpYnV0ZXNcbiAgICAgICAgICAgICAgICB9KSkpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBnZXRQYWdlT3B0aW9ucyA9IGZ1bmN0aW9uIGdldFBhZ2VPcHRpb25zKGRhdGEsIHBhZ2UsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgICAgICB2YXIgaGVhZGVycyA9IGFyZ3VtZW50cy5sZW5ndGggPiAzICYmIGFyZ3VtZW50c1szXSAhPT0gdW5kZWZpbmVkID8gYXJndW1lbnRzWzNdIDoge307XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gZ2V0T3B0aW9ucyhkYXRhLCBwYWdlIHx8IDEsIHBhZ2VTaXplKCksIG9wdGlvbnMsIGhlYWRlcnMpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBnZXRSb3dPcHRpb25zID0gZnVuY3Rpb24gZ2V0Um93T3B0aW9ucyhkYXRhLCBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgdmFyIGhlYWRlcnMgPSBhcmd1bWVudHMubGVuZ3RoID4gMiAmJiBhcmd1bWVudHNbMl0gIT09IHVuZGVmaW5lZCA/IGFyZ3VtZW50c1syXSA6IHt9O1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGdldE9wdGlvbnMoZGF0YSwgMSwgMSwgb3B0aW9ucywgaGVhZGVycyk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHBhZ2VTaXplOiBwYWdlU2l6ZSxcbiAgICAgICAgICAgICAgICBnZXRQYWdlT3B0aW9uczogZ2V0UGFnZU9wdGlvbnMsXG4gICAgICAgICAgICAgICAgZ2V0Um93T3B0aW9uczogZ2V0Um93T3B0aW9ucyxcbiAgICAgICAgICAgICAgICBwYXRjaE9wdGlvbnM6IHBhdGNoT3B0aW9ucyxcbiAgICAgICAgICAgICAgICBwb3N0T3B0aW9uczogcG9zdE9wdGlvbnMsXG4gICAgICAgICAgICAgICAgZGVsZXRlT3B0aW9uczogZGVsZXRlT3B0aW9ucyxcbiAgICAgICAgICAgICAgICBnZXRQYWdlOiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIGdldFBhZ2VPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBnZXRSb3c6IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgZ2V0Um93T3B0aW9ucyksXG4gICAgICAgICAgICAgICAgcGF0Y2g6IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgcGF0Y2hPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBwb3N0OiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIHBvc3RPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBkZWxldGVSZXF1ZXN0OiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIGRlbGV0ZU9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIGdldFBhZ2VXaXRoVG9rZW46IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgZ2V0UGFnZU9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIGdldFJvd1dpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBnZXRSb3dPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBwYXRjaFdpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBwYXRjaE9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIHBvc3RXaXRoVG9rZW46IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgcG9zdE9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIGRlbGV0ZVdpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBkZWxldGVPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBvcHRpb25zOiBvcHRpb25zXG4gICAgICAgICAgICB9O1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiBwb3N0Z3Jlc3Q7XG4gICAgfTtcblxuICAgIHBvc3RncmVzdC5maWx0ZXJzVk0gPSBmaWx0ZXJzVk07XG4gICAgcG9zdGdyZXN0LnBhZ2luYXRpb25WTSA9IHBhZ2luYXRpb25WTTtcblxuICAgIHJldHVybiBwb3N0Z3Jlc3Q7XG59XG5cbnJldHVybiBQb3N0Z3Jlc3Q7XG5cbn0pKSk7XG4iXSwiZmlsZSI6InNyYy8qKi8qLmpzIn0=
