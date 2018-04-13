var Postgrest = (function (m,_) {
'use strict';

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
        var globalHeader = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

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
            return m.request(addConfigHeaders(globalHeader, _.extend({ extract: errorHandler }, options, {
                url: apiPrefix + options.url
            })));
        };

        var authenticationRequested = m.prop(false);
        postgrest.authenticate = function (delegatedDeferred) {
            var deferred = delegatedDeferred || m.deferred();
            if (token()) {
                deferred.resolve({
                    token: token()
                });
            } else if (!authenticationRequested()) {
                authenticationRequested(true);

                m.request(_.extend({}, authenticationOptions)).then(function (data) {
                    authenticationRequested(false);
                    token(data.token);
                    deferred.resolve({
                        token: token()
                    });
                }).catch(function (data) {
                    authenticationRequested(false);
                    deferred.reject(data);
                });
            } else {
                setTimeout(function () {
                    return postgrest.authenticate(deferred);
                }, 250);
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

                var extraHeaders = _.extend({}, representationHeader, headers);
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

}(m,_));
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjLyoqLyouanMiLCJzb3VyY2VzIjpbInNyYy92bXMvZmlsdGVyc1ZNLmpzIiwic3JjL3Ztcy9wYWdpbmF0aW9uVk0uanMiLCJzcmMvcG9zdGdyZXN0LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBtIGZyb20gJ21pdGhyaWwnO1xuaW1wb3J0IF8gZnJvbSAndW5kZXJzY29yZSc7XG5cbmNvbnN0IGZpbHRlcnNWTSA9IChhdHRyaWJ1dGVzKSA9PiB7XG4gICAgbGV0IG5ld1ZNID0ge30sXG4gICAgICAgIGZpbHRlciA9ICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHByb3AgPSBtLnByb3AoJycpLFxuICAgICAgICAgICAgICAgIGZpbHRlclByb3AgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wKHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXdWTTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcHJvcCgpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAvLyBKdXN0IHNvIHdlIGNhbiBoYXZlIGEgZGVmYXVsdCB0b19maWx0ZXIgYW5kIGF2b2lkIGlmIF8uaXNGdW5jdGlvbiBjYWxsc1xuICAgICAgICAgICAgZmlsdGVyUHJvcC50b0ZpbHRlciA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gXy5pc1N0cmluZyhmaWx0ZXJQcm9wKCkpID8gZmlsdGVyUHJvcCgpLnRyaW0oKSA6IGZpbHRlclByb3AoKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXR1cm4gZmlsdGVyUHJvcDtcbiAgICAgICAgfSxcblxuICAgICAgICBnZXR0ZXJzID0gXy5yZWR1Y2UoXG4gICAgICAgICAgICBhdHRyaWJ1dGVzLCAobWVtbywgb3BlcmF0b3IsIGF0dHIpID0+IHtcbiAgICAgICAgICAgICAgICAvLyBUaGUgb3BlcmF0b3IgYmV0d2VlbiBpcyBpbXBsZW1lbnRlZCB3aXRoIHR3byBwcm9wZXJ0aWVzLCBvbmUgZm9yIGdyZWF0ZXIgdGhhbiB2YWx1ZSBhbmQgYW5vdGhlciBmb3IgbGVzc2VyIHRoYW4gdmFsdWUuXG4gICAgICAgICAgICAgICAgLy8gQm90aCBwcm9wZXJ0aWVzIGFyZSBzZW50IGluIHRoZSBxdWV1cnlzdHJpbmcgd2l0aCB0aGUgc2FtZSBuYW1lLFxuICAgICAgICAgICAgICAgIC8vIHRoYXQncyB3aHkgd2UgbmVlZCB0aGUgc3BlY2lhbCBjYXNlIGhlcmUsIHNvIHdlIGNhbiB1c2UgYSBzaW1wbGUgbWFwIGFzIGFyZ3VtZW50IHRvIGZpbHRlcnNWTS5cbiAgICAgICAgICAgICAgICBpZiAob3BlcmF0b3IgPT09ICdiZXR3ZWVuJykge1xuICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbHRlOiBmaWx0ZXIoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGd0ZTogZmlsdGVyKClcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gZmlsdGVyKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICAgIG9yZGVyOiBmaWx0ZXIoKVxuICAgICAgICAgICAgfVxuICAgICAgICApLFxuXG4gICAgICAgIHBhcmFtZXRlcnNXaXRob3V0T3JkZXIgPSAoKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gXy5yZWR1Y2UoXG4gICAgICAgICAgICAgICAgZ2V0dGVycywgKG1lbW8sIGdldHRlciwgYXR0cikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXR0ciAhPT0gJ29yZGVyJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3BlcmF0b3IgPSBhdHRyaWJ1dGVzW2F0dHJdO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoXy5pc0Z1bmN0aW9uKGdldHRlci50b0ZpbHRlcikgJiYgKGdldHRlci50b0ZpbHRlcigpID09PSB1bmRlZmluZWQgfHwgZ2V0dGVyLnRvRmlsdGVyKCkgPT09ICcnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBCZWxsb3cgd2UgdXNlIGRpZmZlcmVudCBmb3JtYXR0aW5nIHJ1bGVzIGZvciB0aGUgdmFsdWUgZGVwZW5kaW5nIG9uIHRoZSBvcGVyYXRvclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVGhlc2UgcnVsZXMgYXJlIHVzZWQgcmVnYXJkbGVzcyBvZiB0aGUgdG9GaWx0ZXIgZnVuY3Rpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBzbyB0aGUgdXNlciBjYW4gdXNlIGEgY3VzdG9tIHRvRmlsdGVyIHdpdGhvdXQgaGF2aW5nIHRvIHdvcnJ5IHdpdGggYmFzaWMgZmlsdGVyIHN5bnRheFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9wZXJhdG9yID09PSAnaWxpa2UnIHx8IG9wZXJhdG9yID09PSAnbGlrZScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gb3BlcmF0b3IgKyAnLionICsgZ2V0dGVyLnRvRmlsdGVyKCkgKyAnKic7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG9wZXJhdG9yID09PSAnQEAnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IG9wZXJhdG9yICsgJy4nICsgZ2V0dGVyLnRvRmlsdGVyKCkucmVwbGFjZSgvXFxzKy9nLCAnJicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChvcGVyYXRvciA9PT0gJ2JldHdlZW4nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFnZXR0ZXIubHRlLnRvRmlsdGVyKCkgJiYgIWdldHRlci5ndGUudG9GaWx0ZXIoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChnZXR0ZXIuZ3RlKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXS5wdXNoKCdndGUuJyArIGdldHRlci5ndGUudG9GaWx0ZXIoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChnZXR0ZXIubHRlKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXS5wdXNoKCdsdGUuJyArIGdldHRlci5sdGUudG9GaWx0ZXIoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChvcGVyYXRvciA9PT0gJ2lzLm51bGwnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IGdldHRlci50b0ZpbHRlcigpID09PSBudWxsID8gJ2lzLm51bGwnIDogJ25vdC5pcy5udWxsJztcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IG9wZXJhdG9yICsgJy4nICsgZ2V0dGVyLnRvRmlsdGVyKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgICAgICAgICAgfSwge31cbiAgICAgICAgICAgICk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgcGFyYW1ldGVycyA9ICgpID0+IHtcbiAgICAgICAgICAgIC8vIFRoZSBvcmRlciBwYXJhbWV0ZXJzIGhhdmUgYSBzcGVjaWFsIHN5bnRheCAoanVzdCBsaWtlIGFuIG9yZGVyIGJ5IFNRTCBjbGF1c2UpXG4gICAgICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vYmVncmlmZnMvcG9zdGdyZXN0L3dpa2kvUm91dGluZyNmaWx0ZXJpbmctYW5kLW9yZGVyaW5nXG4gICAgICAgICAgICBjb25zdCBvcmRlciA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZ2V0dGVycy5vcmRlcigpICYmIF8ucmVkdWNlKFxuICAgICAgICAgICAgICAgICAgICBnZXR0ZXJzLm9yZGVyKCksIChtZW1vLCBkaXJlY3Rpb24sIGF0dHIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lbW8ucHVzaChhdHRyICsgJy4nICsgZGlyZWN0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgICAgICAgICB9LCBbXVxuICAgICAgICAgICAgICAgICkuam9pbignLCcpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgIG9yZGVyUGFyYW1ldGVyID0gb3JkZXIoKSA/IHtcbiAgICAgICAgICAgICAgICAgICAgb3JkZXI6IG9yZGVyKClcbiAgICAgICAgICAgICAgICB9IDoge307XG5cbiAgICAgICAgICAgIHJldHVybiBfLmV4dGVuZCh7fSwgb3JkZXJQYXJhbWV0ZXIsIHBhcmFtZXRlcnNXaXRob3V0T3JkZXIoKSk7XG5cbiAgICAgICAgfTtcblxuICAgIHJldHVybiBfLmV4dGVuZChuZXdWTSwgZ2V0dGVycywge1xuICAgICAgICBwYXJhbWV0ZXJzOiBwYXJhbWV0ZXJzLFxuICAgICAgICBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyOiBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyXG4gICAgfSk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBmaWx0ZXJzVk07XG4iLCJpbXBvcnQgbSBmcm9tICdtaXRocmlsJztcbmltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuXG5jb25zdCBwYWdpbmF0aW9uVk0gPSAobW9kZWwsIG9yZGVyLCBleHRyYUhlYWRlcnMgPSB7fSwgYXV0aGVudGljYXRlID0gdHJ1ZSkgPT4ge1xuICAgIGxldCBjb2xsZWN0aW9uID0gbS5wcm9wKFtdKSxcbiAgICAgICAgZGVmYXVsdE9yZGVyID0gb3JkZXIgfHwgJ2lkLmRlc2MnLFxuICAgICAgICBmaWx0ZXJzID0gbS5wcm9wKHtcbiAgICAgICAgICAgIG9yZGVyOiBkZWZhdWx0T3JkZXJcbiAgICAgICAgfSksXG4gICAgICAgIGlzTG9hZGluZyA9IG0ucHJvcChmYWxzZSksXG4gICAgICAgIHBhZ2UgPSBtLnByb3AoMSksXG4gICAgICAgIHJlc3VsdHNDb3VudCA9IG0ucHJvcCgpLFxuICAgICAgICBwYWdlUmVxdWVzdCA9IGF1dGhlbnRpY2F0ZSA/IG1vZGVsLmdldFBhZ2VXaXRoVG9rZW4gOiBtb2RlbC5nZXRQYWdlLFxuICAgICAgICB0b3RhbCA9IG0ucHJvcCgpO1xuXG4gICAgY29uc3QgZmV0Y2ggPSAoKSA9PiB7XG4gICAgICAgIGxldCBkID0gbS5kZWZlcnJlZCgpO1xuICAgICAgICBjb25zdCBnZXRUb3RhbCA9ICh4aHIpID0+IHtcbiAgICAgICAgICAgIGlmICgheGhyIHx8IHhoci5zdGF0dXMgPT09IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICBoaW50OiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBkZXRhaWxzOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBjb2RlOiAwLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnQ29ubmVjdGlvbiBlcnJvcidcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCByYW5nZUhlYWRlciA9IHhoci5nZXRSZXNwb25zZUhlYWRlcignQ29udGVudC1SYW5nZScpO1xuICAgICAgICAgICAgaWYgKF8uaXNTdHJpbmcocmFuZ2VIZWFkZXIpKSB7XG4gICAgICAgICAgICAgICAgbGV0IFtoZWFkZXJTaXplLCBoZWFkZXJDb3VudF0gPSByYW5nZUhlYWRlci5zcGxpdCgnLycpLFxuICAgICAgICAgICAgICAgICAgICBbaGVhZGVyRnJvbSwgaGVhZGVyVG9dID0gaGVhZGVyU2l6ZS5zcGxpdCgnLScpLFxuICAgICAgICAgICAgICAgICAgICB0byA9IHBhcnNlSW50KGhlYWRlclRvKSArIDEgfHwgMCxcbiAgICAgICAgICAgICAgICAgICAgZnJvbSA9IHBhcnNlSW50KGhlYWRlckZyb20pICB8fCAwO1xuXG4gICAgICAgICAgICAgICAgdG90YWwocGFyc2VJbnQoaGVhZGVyQ291bnQpKTtcbiAgICAgICAgICAgICAgICByZXN1bHRzQ291bnQodG8gLSBmcm9tKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgSlNPTi5wYXJzZSh4aHIucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICByZXR1cm4geGhyLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgaGludDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgZGV0YWlsczogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgY29kZTogMCxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogeGhyLnJlc3BvbnNlVGV4dFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBpc0xvYWRpbmcodHJ1ZSk7XG4gICAgICAgIHBhZ2VSZXF1ZXN0KGZpbHRlcnMoKSwgcGFnZSgpLCB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cnVlLFxuICAgICAgICAgICAgZXh0cmFjdDogZ2V0VG90YWxcbiAgICAgICAgfSwgZXh0cmFIZWFkZXJzKS50aGVuKChkYXRhKSA9PiB7XG4gICAgICAgICAgICBjb2xsZWN0aW9uKF8udW5pb24oY29sbGVjdGlvbigpLCBkYXRhKSk7XG4gICAgICAgICAgICBpc0xvYWRpbmcoZmFsc2UpO1xuICAgICAgICAgICAgZC5yZXNvbHZlKGNvbGxlY3Rpb24oKSk7XG4gICAgICAgICAgICBtLnJlZHJhdygpO1xuICAgICAgICB9LCAoZXJyb3IpID0+IHtcbiAgICAgICAgICAgIGlzTG9hZGluZyhmYWxzZSk7XG4gICAgICAgICAgICB0b3RhbCgwKTtcbiAgICAgICAgICAgIGQucmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgIG0ucmVkcmF3KCk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZC5wcm9taXNlO1xuICAgIH0sXG5cbiAgICBmaXJzdFBhZ2UgPSAocGFyYW1ldGVycykgPT4ge1xuICAgICAgICBmaWx0ZXJzKF8uZXh0ZW5kKHtcbiAgICAgICAgICAgIG9yZGVyOiBkZWZhdWx0T3JkZXJcbiAgICAgICAgfSwgcGFyYW1ldGVycykpO1xuICAgICAgICBjb2xsZWN0aW9uKFtdKTtcbiAgICAgICAgcGFnZSgxKTtcbiAgICAgICAgcmV0dXJuIGZldGNoKCk7XG4gICAgfSxcblxuICAgIGlzTGFzdFBhZ2UgPSAoKSA9PiB7XG4gICAgICAgIHJldHVybiAobW9kZWwucGFnZVNpemUoKSA+IHJlc3VsdHNDb3VudCgpKTtcbiAgICB9LFxuXG4gICAgbmV4dFBhZ2UgPSAoKSA9PiB7XG4gICAgICAgIHBhZ2UocGFnZSgpICsgMSk7XG4gICAgICAgIHJldHVybiBmZXRjaCgpO1xuICAgIH07XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uLFxuICAgICAgICBmaXJzdFBhZ2U6IGZpcnN0UGFnZSxcbiAgICAgICAgaXNMb2FkaW5nOiBpc0xvYWRpbmcsXG4gICAgICAgIG5leHRQYWdlOiBuZXh0UGFnZSxcbiAgICAgICAgaXNMYXN0UGFnZTogaXNMYXN0UGFnZSxcbiAgICAgICAgdG90YWw6IHRvdGFsLFxuICAgICAgICByZXN1bHRzQ291bnQ6IHJlc3VsdHNDb3VudFxuICAgIH07XG59O1xuXG5leHBvcnQgZGVmYXVsdCBwYWdpbmF0aW9uVk07XG4iLCJpbXBvcnQgbSBmcm9tICdtaXRocmlsJztcbmltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuaW1wb3J0IGZpbHRlcnNWTSBmcm9tICcuL3Ztcy9maWx0ZXJzVk0nO1xuaW1wb3J0IHBhZ2luYXRpb25WTSBmcm9tICcuL3Ztcy9wYWdpbmF0aW9uVk0nO1xuXG5mdW5jdGlvbiBQb3N0Z3Jlc3QgKCkge1xuICAgIGxldCBwb3N0Z3Jlc3QgPSB7fTtcblxuICAgIGNvbnN0IHRva2VuID0gbS5wcm9wKCksXG5cbiAgICAgICAgICBtZXJnZUNvbmZpZyA9IChjb25maWcsIG9wdGlvbnMpID0+IHtcbiAgICAgICAgICAgICAgcmV0dXJuIG9wdGlvbnMgJiYgXy5pc0Z1bmN0aW9uKG9wdGlvbnMuY29uZmlnKSA/IF8uY29tcG9zZShvcHRpb25zLmNvbmZpZywgY29uZmlnKSA6IGNvbmZpZztcbiAgICAgICAgICB9LFxuXG4gICAgICAgICAgYWRkSGVhZGVycyA9IChoZWFkZXJzKSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiAoeGhyKSA9PiB7XG4gICAgICAgICAgICAgICAgICBfLmVhY2goaGVhZGVycywgKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihrZXksIHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHhocjtcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICB9LFxuXG4gICAgICAgICAgYWRkQ29uZmlnSGVhZGVycyA9IChoZWFkZXJzLCBvcHRpb25zKSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiBfLmV4dGVuZCh7fSwgb3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgY29uZmlnOiBtZXJnZUNvbmZpZyhhZGRIZWFkZXJzKGhlYWRlcnMpLCBvcHRpb25zKVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICB9LFxuXG4gICAgICAgICAgY3JlYXRlTG9hZGVyID0gKHJlcXVlc3RGdW5jdGlvbiwgb3B0aW9ucywgZGVmYXVsdFN0YXRlID0gZmFsc2UpID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgbG9hZGVyID0gbS5wcm9wKGRlZmF1bHRTdGF0ZSksXG4gICAgICAgICAgICAgICAgICAgIGQgPSBtLmRlZmVycmVkKCk7XG4gICAgICAgICAgICAgIGxvYWRlci5sb2FkID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgbG9hZGVyKHRydWUpO1xuICAgICAgICAgICAgICAgICAgbS5yZWRyYXcoKTtcbiAgICAgICAgICAgICAgICAgIHJlcXVlc3RGdW5jdGlvbihfLmV4dGVuZCh7fSwgb3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6IHRydWVcbiAgICAgICAgICAgICAgICAgIH0pKS50aGVuKChkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgbG9hZGVyKGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgICBkLnJlc29sdmUoZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgbS5yZWRyYXcoKTtcbiAgICAgICAgICAgICAgICAgIH0sIChlcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIGxvYWRlcihmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgIG0ucmVkcmF3KCk7XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBkLnByb21pc2U7XG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgIHJldHVybiBsb2FkZXI7XG4gICAgICAgICAgfSxcblxuICAgICAgICAgIHJlcHJlc2VudGF0aW9uSGVhZGVyID0ge1xuICAgICAgICAgICAgICAnUHJlZmVyJzogJ3JldHVybj1yZXByZXNlbnRhdGlvbidcbiAgICAgICAgICB9O1xuXG4gICAgcG9zdGdyZXN0LnRva2VuID0gdG9rZW47XG5cbiAgICBwb3N0Z3Jlc3QuaW5pdCA9IChhcGlQcmVmaXgsIGF1dGhlbnRpY2F0aW9uT3B0aW9ucywgZ2xvYmFsSGVhZGVyID0ge30pID0+IHtcbiAgICAgICAgcG9zdGdyZXN0LnJlcXVlc3QgPSAob3B0aW9ucykgPT4ge1xuICAgICAgICAgICAgY29uc3QgZXJyb3JIYW5kbGVyID0gKHhocikgPT4ge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIEpTT04ucGFyc2UoeGhyLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB4aHIucmVzcG9uc2VUZXh0O1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBoaW50OiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGV0YWlsczogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiB4aHIucmVzcG9uc2VUZXh0XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXR1cm4gbS5yZXF1ZXN0KFxuICAgICAgICAgICAgICAgIGFkZENvbmZpZ0hlYWRlcnMoZ2xvYmFsSGVhZGVyLFxuICAgICAgICAgICAgICAgICAgICBfLmV4dGVuZCh7ZXh0cmFjdDogZXJyb3JIYW5kbGVyfSwgb3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICAgICAgdXJsOiBhcGlQcmVmaXggKyBvcHRpb25zLnVybFxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICk7XG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgYXV0aGVudGljYXRpb25SZXF1ZXN0ZWQgPSBtLnByb3AoZmFsc2UpO1xuICAgICAgICBwb3N0Z3Jlc3QuYXV0aGVudGljYXRlID0gKGRlbGVnYXRlZERlZmVycmVkKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBkZWZlcnJlZCA9IGRlbGVnYXRlZERlZmVycmVkIHx8IG0uZGVmZXJyZWQoKTtcbiAgICAgICAgICAgIGlmICh0b2tlbigpKSB7XG4gICAgICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSh7XG4gICAgICAgICAgICAgICAgICAgIHRva2VuOiB0b2tlbigpXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCFhdXRoZW50aWNhdGlvblJlcXVlc3RlZCgpKSB7XG4gICAgICAgICAgICAgICAgYXV0aGVudGljYXRpb25SZXF1ZXN0ZWQodHJ1ZSk7XG5cbiAgICAgICAgICAgICAgICBtLnJlcXVlc3QoXy5leHRlbmQoe30sIGF1dGhlbnRpY2F0aW9uT3B0aW9ucykpLnRoZW4oKGRhdGEpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgYXV0aGVudGljYXRpb25SZXF1ZXN0ZWQoZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICB0b2tlbihkYXRhLnRva2VuKTtcbiAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZSh7XG4gICAgICAgICAgICAgICAgICAgICAgICB0b2tlbjogdG9rZW4oKVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KS5jYXRjaCgoZGF0YSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBhdXRoZW50aWNhdGlvblJlcXVlc3RlZChmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChkYXRhKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiBwb3N0Z3Jlc3QuYXV0aGVudGljYXRlKGRlZmVycmVkKSwgMjUwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgICAgICB9O1xuXG4gICAgICAgIHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuID0gKG9wdGlvbnMpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBwb3N0Z3Jlc3QuYXV0aGVudGljYXRlKCkudGhlbihcbiAgICAgICAgICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwb3N0Z3Jlc3QucmVxdWVzdChhZGRDb25maWdIZWFkZXJzKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICdBdXRob3JpemF0aW9uJzogJ0JlYXJlciAnICsgdG9rZW4oKVxuICAgICAgICAgICAgICAgICAgICB9LCBvcHRpb25zKSk7XG4gICAgICAgICAgICAgICAgfSwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcG9zdGdyZXN0LnJlcXVlc3Qob3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfTtcblxuICAgICAgICBwb3N0Z3Jlc3QubG9hZGVyID0gXy5wYXJ0aWFsKGNyZWF0ZUxvYWRlciwgcG9zdGdyZXN0LnJlcXVlc3QpO1xuICAgICAgICBcbiAgICAgICAgcG9zdGdyZXN0LmxvYWRlcldpdGhUb2tlbiA9IF8ucGFydGlhbChjcmVhdGVMb2FkZXIsIHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuKTtcblxuICAgICAgICBwb3N0Z3Jlc3QubW9kZWwgPSAobmFtZSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgcGFnaW5hdGlvbkhlYWRlcnMgPSAocGFnZSwgcGFnZVNpemUpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIXBhZ2VTaXplKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCB0b1JhbmdlID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmcm9tID0gKHBhZ2UgLSAxKSAqIHBhZ2VTaXplLFxuICAgICAgICAgICAgICAgICAgICAgICAgICB0byA9IGZyb20gKyBwYWdlU2l6ZSAtIDE7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmcm9tICsgJy0nICsgdG87XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICdSYW5nZS11bml0JzogJ2l0ZW1zJyxcbiAgICAgICAgICAgICAgICAgICAgJ1JhbmdlJzogdG9SYW5nZSgpXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgIHBhZ2VTaXplID0gbS5wcm9wKDEwKSxcblxuICAgICAgICAgICAgICAgICAgbmFtZU9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgdXJsOiAnLycgKyBuYW1lXG4gICAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgICBnZXRPcHRpb25zID0gKGRhdGEsIHBhZ2UsIHBhZ2VTaXplLCBvcHRpb25zLCBoZWFkZXJzID0ge30pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBleHRyYUhlYWRlcnMgPSBfLmV4dGVuZCh7fSwge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAnUHJlZmVyJzogJ2NvdW50PW5vbmUnXG4gICAgICAgICAgICAgICAgICAgICAgfSwgaGVhZGVycywgcGFnaW5hdGlvbkhlYWRlcnMocGFnZSwgcGFnZVNpemUpKTtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWRkQ29uZmlnSGVhZGVycyhleHRyYUhlYWRlcnMsIF8uZXh0ZW5kKHt9LCBvcHRpb25zLCBuYW1lT3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiBkYXRhXG4gICAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgcXVlcnlzdHJpbmcgPSAoZmlsdGVycywgb3B0aW9ucykgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMudXJsICs9ICc/JyArIG0ucm91dGUuYnVpbGRRdWVyeVN0cmluZyhmaWx0ZXJzKTtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gb3B0aW9ucztcbiAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgIG9wdGlvbnMgPSAob3B0aW9ucykgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwb3N0Z3Jlc3QucmVxdWVzdChfLmV4dGVuZCh7fSwgb3B0aW9ucywgbmFtZU9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnT1BUSU9OUydcbiAgICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgICBwb3N0T3B0aW9ucyA9IChhdHRyaWJ1dGVzLCBvcHRpb25zLCBoZWFkZXJzID0ge30pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBleHRyYUhlYWRlcnMgPSBfLmV4dGVuZCh7fSwgcmVwcmVzZW50YXRpb25IZWFkZXIsIGhlYWRlcnMpO1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBhZGRDb25maWdIZWFkZXJzKFxuICAgICAgICAgICAgICAgICAgICAgICAgICBleHRyYUhlYWRlcnMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIF8uZXh0ZW5kKHt9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lT3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiBhdHRyaWJ1dGVzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgIGRlbGV0ZU9wdGlvbnMgPSAoZmlsdGVycywgb3B0aW9ucywgaGVhZGVycyA9IHt9KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgZXh0cmFIZWFkZXJzID0gXy5leHRlbmQoe30sIHJlcHJlc2VudGF0aW9uSGVhZGVyLCBoZWFkZXJzKTtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcXVlcnlzdHJpbmcoZmlsdGVycywgYWRkQ29uZmlnSGVhZGVycyhleHRyYUhlYWRlcnMsIF8uZXh0ZW5kKHt9LCBvcHRpb25zLCBuYW1lT3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdERUxFVEUnXG4gICAgICAgICAgICAgICAgICAgICAgfSkpKTtcbiAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgIHBhdGNoT3B0aW9ucyA9IChmaWx0ZXJzLCBhdHRyaWJ1dGVzLCBvcHRpb25zLCBoZWFkZXJzID0ge30pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBleHRyYUhlYWRlcnMgPSBfLmV4dGVuZCh7fSwgcmVwcmVzZW50YXRpb25IZWFkZXIsIGhlYWRlcnMpO1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBxdWVyeXN0cmluZyhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsdGVycyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkQ29uZmlnSGVhZGVycyhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4dHJhSGVhZGVycyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF8uZXh0ZW5kKHt9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWVPcHRpb25zLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnUEFUQ0gnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IGF0dHJpYnV0ZXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgIGdldFBhZ2VPcHRpb25zID0gKGRhdGEsIHBhZ2UsIG9wdGlvbnMsIGhlYWRlcnMgPSB7fSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBnZXRPcHRpb25zKGRhdGEsIChwYWdlIHx8IDEpLCBwYWdlU2l6ZSgpLCBvcHRpb25zLCBoZWFkZXJzKTtcbiAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgIGdldFJvd09wdGlvbnMgPSAoZGF0YSwgb3B0aW9ucywgaGVhZGVycyA9IHt9KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGdldE9wdGlvbnMoZGF0YSwgMSwgMSwgb3B0aW9ucywgaGVhZGVycyk7XG4gICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHBhZ2VTaXplOiBwYWdlU2l6ZSxcbiAgICAgICAgICAgICAgICBnZXRQYWdlT3B0aW9uczogZ2V0UGFnZU9wdGlvbnMsXG4gICAgICAgICAgICAgICAgZ2V0Um93T3B0aW9uczogZ2V0Um93T3B0aW9ucyxcbiAgICAgICAgICAgICAgICBwYXRjaE9wdGlvbnM6IHBhdGNoT3B0aW9ucyxcbiAgICAgICAgICAgICAgICBwb3N0T3B0aW9uczogcG9zdE9wdGlvbnMsXG4gICAgICAgICAgICAgICAgZGVsZXRlT3B0aW9uczogZGVsZXRlT3B0aW9ucyxcbiAgICAgICAgICAgICAgICBnZXRQYWdlOiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIGdldFBhZ2VPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBnZXRSb3c6IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgZ2V0Um93T3B0aW9ucyksXG4gICAgICAgICAgICAgICAgcGF0Y2g6IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgcGF0Y2hPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBwb3N0OiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIHBvc3RPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBkZWxldGVSZXF1ZXN0OiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIGRlbGV0ZU9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIGdldFBhZ2VXaXRoVG9rZW46IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgZ2V0UGFnZU9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIGdldFJvd1dpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBnZXRSb3dPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBwYXRjaFdpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBwYXRjaE9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIHBvc3RXaXRoVG9rZW46IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgcG9zdE9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIGRlbGV0ZVdpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBkZWxldGVPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBvcHRpb25zOiBvcHRpb25zXG4gICAgICAgICAgICB9O1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiBwb3N0Z3Jlc3Q7XG4gICAgfTtcblxuICAgIHBvc3RncmVzdC5maWx0ZXJzVk0gPSBmaWx0ZXJzVk07XG4gICAgcG9zdGdyZXN0LnBhZ2luYXRpb25WTSA9IHBhZ2luYXRpb25WTTtcbiAgXG4gICAgcmV0dXJuIHBvc3RncmVzdDtcbn1cblxuZXhwb3J0IGRlZmF1bHQgUG9zdGdyZXN0O1xuIl0sIm5hbWVzIjpbImZpbHRlcnNWTSIsImF0dHJpYnV0ZXMiLCJuZXdWTSIsImZpbHRlciIsInByb3AiLCJtIiwiZmlsdGVyUHJvcCIsInZhbHVlIiwiYXJndW1lbnRzIiwibGVuZ3RoIiwidG9GaWx0ZXIiLCJfIiwiaXNTdHJpbmciLCJ0cmltIiwiZ2V0dGVycyIsInJlZHVjZSIsIm1lbW8iLCJvcGVyYXRvciIsImF0dHIiLCJwYXJhbWV0ZXJzV2l0aG91dE9yZGVyIiwiZ2V0dGVyIiwiaXNGdW5jdGlvbiIsInVuZGVmaW5lZCIsInJlcGxhY2UiLCJsdGUiLCJndGUiLCJwdXNoIiwicGFyYW1ldGVycyIsIm9yZGVyIiwiZGlyZWN0aW9uIiwiam9pbiIsIm9yZGVyUGFyYW1ldGVyIiwiZXh0ZW5kIiwicGFnaW5hdGlvblZNIiwibW9kZWwiLCJleHRyYUhlYWRlcnMiLCJhdXRoZW50aWNhdGUiLCJjb2xsZWN0aW9uIiwiZGVmYXVsdE9yZGVyIiwiZmlsdGVycyIsImlzTG9hZGluZyIsInBhZ2UiLCJyZXN1bHRzQ291bnQiLCJwYWdlUmVxdWVzdCIsImdldFBhZ2VXaXRoVG9rZW4iLCJnZXRQYWdlIiwidG90YWwiLCJmZXRjaCIsImQiLCJkZWZlcnJlZCIsImdldFRvdGFsIiwieGhyIiwic3RhdHVzIiwiSlNPTiIsInN0cmluZ2lmeSIsInJhbmdlSGVhZGVyIiwiZ2V0UmVzcG9uc2VIZWFkZXIiLCJzcGxpdCIsImhlYWRlclNpemUiLCJoZWFkZXJDb3VudCIsImhlYWRlckZyb20iLCJoZWFkZXJUbyIsInRvIiwicGFyc2VJbnQiLCJmcm9tIiwicmVzcG9uc2VUZXh0IiwiZXgiLCJ0aGVuIiwiZGF0YSIsInVuaW9uIiwicmVzb2x2ZSIsInJlZHJhdyIsImVycm9yIiwicmVqZWN0IiwicHJvbWlzZSIsImZpcnN0UGFnZSIsImlzTGFzdFBhZ2UiLCJwYWdlU2l6ZSIsIm5leHRQYWdlIiwiUG9zdGdyZXN0IiwicG9zdGdyZXN0IiwidG9rZW4iLCJtZXJnZUNvbmZpZyIsImNvbmZpZyIsIm9wdGlvbnMiLCJjb21wb3NlIiwiYWRkSGVhZGVycyIsImhlYWRlcnMiLCJlYWNoIiwia2V5Iiwic2V0UmVxdWVzdEhlYWRlciIsImFkZENvbmZpZ0hlYWRlcnMiLCJjcmVhdGVMb2FkZXIiLCJyZXF1ZXN0RnVuY3Rpb24iLCJkZWZhdWx0U3RhdGUiLCJsb2FkZXIiLCJsb2FkIiwicmVwcmVzZW50YXRpb25IZWFkZXIiLCJpbml0IiwiYXBpUHJlZml4IiwiYXV0aGVudGljYXRpb25PcHRpb25zIiwiZ2xvYmFsSGVhZGVyIiwicmVxdWVzdCIsImVycm9ySGFuZGxlciIsImV4dHJhY3QiLCJ1cmwiLCJhdXRoZW50aWNhdGlvblJlcXVlc3RlZCIsImRlbGVnYXRlZERlZmVycmVkIiwiY2F0Y2giLCJyZXF1ZXN0V2l0aFRva2VuIiwicGFydGlhbCIsImxvYWRlcldpdGhUb2tlbiIsIm5hbWUiLCJwYWdpbmF0aW9uSGVhZGVycyIsInRvUmFuZ2UiLCJuYW1lT3B0aW9ucyIsImdldE9wdGlvbnMiLCJxdWVyeXN0cmluZyIsInJvdXRlIiwiYnVpbGRRdWVyeVN0cmluZyIsInBvc3RPcHRpb25zIiwiZGVsZXRlT3B0aW9ucyIsInBhdGNoT3B0aW9ucyIsImdldFBhZ2VPcHRpb25zIiwiZ2V0Um93T3B0aW9ucyJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBR0EsSUFBTUEsWUFBWSxTQUFaQSxTQUFZLENBQUNDLFVBQUQsRUFBZ0I7UUFDMUJDLFFBQVEsRUFBWjtRQUNJQyxTQUFTLFNBQVRBLE1BQVMsR0FBTTtZQUNMQyxPQUFPQyxFQUFFRCxJQUFGLENBQU8sRUFBUCxDQUFiO1lBQ0lFLGFBQWEsU0FBYkEsVUFBYSxDQUFVQyxLQUFWLEVBQWlCO2dCQUN0QkMsVUFBVUMsTUFBVixHQUFtQixDQUF2QixFQUEwQjtxQkFDakJGLEtBQUw7dUJBQ09MLEtBQVA7O21CQUVHRSxNQUFQO1NBTlI7O21CQVNXTSxRQUFYLEdBQXNCLFlBQU07bUJBQ2pCQyxFQUFFQyxRQUFGLENBQVdOLFlBQVgsSUFBMkJBLGFBQWFPLElBQWIsRUFBM0IsR0FBaURQLFlBQXhEO1NBREo7ZUFHT0EsVUFBUDtLQWRSO1FBaUJJUSxVQUFVSCxFQUFFSSxNQUFGLENBQ05kLFVBRE0sRUFDTSxVQUFDZSxJQUFELEVBQU9DLFFBQVAsRUFBaUJDLElBQWpCLEVBQTBCOzs7O1lBSTlCRCxhQUFhLFNBQWpCLEVBQTRCO2lCQUNuQkMsSUFBTCxJQUFhO3FCQUNKZixRQURJO3FCQUVKQTthQUZUO1NBREosTUFLTztpQkFDRWUsSUFBTCxJQUFhZixRQUFiOztlQUVHYSxJQUFQO0tBYkUsRUFjSDtlQUNRYjtLQWZMLENBakJkO1FBb0NJZ0IseUJBQXlCLFNBQXpCQSxzQkFB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RU8rQyxTQUFQOzs7Ozs7Ozs7IiwicHJlRXhpc3RpbmdDb21tZW50IjoiLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ9dXRmLTg7YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0ptYVd4bElqcHVkV3hzTENKemIzVnlZMlZ6SWpwYklpOW9iMjFsTDNacFkyNXBZMmwxY3k5RVpYWXZiV2wwYUhKcGJDMXdiM04wWjNKbGMzUXZjM0pqTDNadGN5OW1hV3gwWlhKelZrMHVhbk1pTENJdmFHOXRaUzkyYVdOdWFXTnBkWE12UkdWMkwyMXBkR2h5YVd3dGNHOXpkR2R5WlhOMEwzTnlZeTkyYlhNdmNHRm5hVzVoZEdsdmJsWk5MbXB6SWl3aUwyaHZiV1V2ZG1samJtbGphWFZ6TDBSbGRpOXRhWFJvY21sc0xYQnZjM1JuY21WemRDOXpjbU12Y0c5emRHZHlaWE4wTG1weklsMHNJbk52ZFhKalpYTkRiMjUwWlc1MElqcGJJbWx0Y0c5eWRDQnRJR1p5YjIwZ0oyMXBkR2h5YVd3bk8xeHVhVzF3YjNKMElGOGdabkp2YlNBbmRXNWtaWEp6WTI5eVpTYzdYRzVjYm1OdmJuTjBJR1pwYkhSbGNuTldUU0E5SUNoaGRIUnlhV0oxZEdWektTQTlQaUI3WEc0Z0lDQWdiR1YwSUc1bGQxWk5JRDBnZTMwc1hHNGdJQ0FnSUNBZ0lHWnBiSFJsY2lBOUlDZ3BJRDArSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJR052Ym5OMElIQnliM0FnUFNCdExuQnliM0FvSnljcExGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHWnBiSFJsY2xCeWIzQWdQU0JtZFc1amRHbHZiaUFvZG1Gc2RXVXBJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2FXWWdLR0Z5WjNWdFpXNTBjeTVzWlc1bmRHZ2dQaUF3S1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCd2NtOXdLSFpoYkhWbEtUdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCdVpYZFdUVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdjSEp2Y0NncE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIMDdYRzRnSUNBZ0lDQWdJQ0FnSUNBdkx5QktkWE4wSUhOdklIZGxJR05oYmlCb1lYWmxJR0VnWkdWbVlYVnNkQ0IwYjE5bWFXeDBaWElnWVc1a0lHRjJiMmxrSUdsbUlGOHVhWE5HZFc1amRHbHZiaUJqWVd4c2MxeHVJQ0FnSUNBZ0lDQWdJQ0FnWm1sc2RHVnlVSEp2Y0M1MGIwWnBiSFJsY2lBOUlDZ3BJRDArSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCeVpYUjFjbTRnWHk1cGMxTjBjbWx1WnlobWFXeDBaWEpRY205d0tDa3BJRDhnWm1sc2RHVnlVSEp2Y0NncExuUnlhVzBvS1NBNklHWnBiSFJsY2xCeWIzQW9LVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lIMDdYRzRnSUNBZ0lDQWdJQ0FnSUNCeVpYUjFjbTRnWm1sc2RHVnlVSEp2Y0R0Y2JpQWdJQ0FnSUNBZ2ZTeGNibHh1SUNBZ0lDQWdJQ0JuWlhSMFpYSnpJRDBnWHk1eVpXUjFZMlVvWEc0Z0lDQWdJQ0FnSUNBZ0lDQmhkSFJ5YVdKMWRHVnpMQ0FvYldWdGJ5d2diM0JsY21GMGIzSXNJR0YwZEhJcElEMCtJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0F2THlCVWFHVWdiM0JsY21GMGIzSWdZbVYwZDJWbGJpQnBjeUJwYlhCc1pXMWxiblJsWkNCM2FYUm9JSFIzYnlCd2NtOXdaWEowYVdWekxDQnZibVVnWm05eUlHZHlaV0YwWlhJZ2RHaGhiaUIyWVd4MVpTQmhibVFnWVc1dmRHaGxjaUJtYjNJZ2JHVnpjMlZ5SUhSb1lXNGdkbUZzZFdVdVhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0x5OGdRbTkwYUNCd2NtOXdaWEowYVdWeklHRnlaU0J6Wlc1MElHbHVJSFJvWlNCeGRXVjFjbmx6ZEhKcGJtY2dkMmwwYUNCMGFHVWdjMkZ0WlNCdVlXMWxMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQzh2SUhSb1lYUW5jeUIzYUhrZ2QyVWdibVZsWkNCMGFHVWdjM0JsWTJsaGJDQmpZWE5sSUdobGNtVXNJSE52SUhkbElHTmhiaUIxYzJVZ1lTQnphVzF3YkdVZ2JXRndJR0Z6SUdGeVozVnRaVzUwSUhSdklHWnBiSFJsY25OV1RTNWNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnBaaUFvYjNCbGNtRjBiM0lnUFQwOUlDZGlaWFIzWldWdUp5a2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCdFpXMXZXMkYwZEhKZElEMGdlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdiSFJsT2lCbWFXeDBaWElvS1N4Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdkMFpUb2dabWxzZEdWeUtDbGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZlR0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCOUlHVnNjMlVnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnRaVzF2VzJGMGRISmRJRDBnWm1sc2RHVnlLQ2s3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUJ0Wlcxdk8xeHVJQ0FnSUNBZ0lDQWdJQ0FnZlN3Z2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHOXlaR1Z5T2lCbWFXeDBaWElvS1Z4dUlDQWdJQ0FnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0FwTEZ4dVhHNGdJQ0FnSUNBZ0lIQmhjbUZ0WlhSbGNuTlhhWFJvYjNWMFQzSmtaWElnUFNBb0tTQTlQaUI3WEc0Z0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z1h5NXlaV1IxWTJVb1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1oyVjBkR1Z5Y3l3Z0tHMWxiVzhzSUdkbGRIUmxjaXdnWVhSMGNpa2dQVDRnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnBaaUFvWVhSMGNpQWhQVDBnSjI5eVpHVnlKeWtnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnWTI5dWMzUWdiM0JsY21GMGIzSWdQU0JoZEhSeWFXSjFkR1Z6VzJGMGRISmRPMXh1WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JwWmlBb1h5NXBjMFoxYm1OMGFXOXVLR2RsZEhSbGNpNTBiMFpwYkhSbGNpa2dKaVlnS0dkbGRIUmxjaTUwYjBacGJIUmxjaWdwSUQwOVBTQjFibVJsWm1sdVpXUWdmSHdnWjJWMGRHVnlMblJ2Um1sc2RHVnlLQ2tnUFQwOUlDY25LU2tnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCdFpXMXZPMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmVnh1WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0F2THlCQ1pXeHNiM2NnZDJVZ2RYTmxJR1JwWm1abGNtVnVkQ0JtYjNKdFlYUjBhVzVuSUhKMWJHVnpJR1p2Y2lCMGFHVWdkbUZzZFdVZ1pHVndaVzVrYVc1bklHOXVJSFJvWlNCdmNHVnlZWFJ2Y2x4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnTHk4Z1ZHaGxjMlVnY25Wc1pYTWdZWEpsSUhWelpXUWdjbVZuWVhKa2JHVnpjeUJ2WmlCMGFHVWdkRzlHYVd4MFpYSWdablZ1WTNScGIyNHNYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQXZMeUJ6YnlCMGFHVWdkWE5sY2lCallXNGdkWE5sSUdFZ1kzVnpkRzl0SUhSdlJtbHNkR1Z5SUhkcGRHaHZkWFFnYUdGMmFXNW5JSFJ2SUhkdmNuSjVJSGRwZEdnZ1ltRnphV01nWm1sc2RHVnlJSE41Ym5SaGVGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2FXWWdLRzl3WlhKaGRHOXlJRDA5UFNBbmFXeHBhMlVuSUh4OElHOXdaWEpoZEc5eUlEMDlQU0FuYkdsclpTY3BJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCdFpXMXZXMkYwZEhKZElEMGdiM0JsY21GMGIzSWdLeUFuTGlvbklDc2daMlYwZEdWeUxuUnZSbWxzZEdWeUtDa2dLeUFuS2ljN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCOUlHVnNjMlVnYVdZZ0tHOXdaWEpoZEc5eUlEMDlQU0FuUUVBbktTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYldWdGIxdGhkSFJ5WFNBOUlHOXdaWEpoZEc5eUlDc2dKeTRuSUNzZ1oyVjBkR1Z5TG5SdlJtbHNkR1Z5S0NrdWNtVndiR0ZqWlNndlhGeHpLeTluTENBbkppY3BPMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmU0JsYkhObElHbG1JQ2h2Y0dWeVlYUnZjaUE5UFQwZ0oySmxkSGRsWlc0bktTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYVdZZ0tDRm5aWFIwWlhJdWJIUmxMblJ2Um1sc2RHVnlLQ2tnSmlZZ0lXZGxkSFJsY2k1bmRHVXVkRzlHYVd4MFpYSW9LU2tnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdiV1Z0Ynp0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYldWdGIxdGhkSFJ5WFNBOUlGdGRPMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdsbUlDaG5aWFIwWlhJdVozUmxLQ2twSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYldWdGIxdGhkSFJ5WFM1d2RYTm9LQ2RuZEdVdUp5QXJJR2RsZEhSbGNpNW5kR1V1ZEc5R2FXeDBaWElvS1NrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdsbUlDaG5aWFIwWlhJdWJIUmxLQ2twSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYldWdGIxdGhkSFJ5WFM1d2RYTm9LQ2RzZEdVdUp5QXJJR2RsZEhSbGNpNXNkR1V1ZEc5R2FXeDBaWElvS1NrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmU0JsYkhObElHbG1JQ2h2Y0dWeVlYUnZjaUE5UFQwZ0oybHpMbTUxYkd3bktTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYldWdGIxdGhkSFJ5WFNBOUlHZGxkSFJsY2k1MGIwWnBiSFJsY2lncElEMDlQU0J1ZFd4c0lEOGdKMmx6TG01MWJHd25JRG9nSjI1dmRDNXBjeTV1ZFd4c0p6dGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIMGdaV3h6WlNCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdiV1Z0YjF0aGRIUnlYU0E5SUc5d1pYSmhkRzl5SUNzZ0p5NG5JQ3NnWjJWMGRHVnlMblJ2Um1sc2RHVnlLQ2s3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnY21WMGRYSnVJRzFsYlc4N1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2ZTd2dlMzFjYmlBZ0lDQWdJQ0FnSUNBZ0lDazdYRzRnSUNBZ0lDQWdJSDBzWEc1Y2JpQWdJQ0FnSUNBZ2NHRnlZVzFsZEdWeWN5QTlJQ2dwSUQwK0lIdGNiaUFnSUNBZ0lDQWdJQ0FnSUM4dklGUm9aU0J2Y21SbGNpQndZWEpoYldWMFpYSnpJR2hoZG1VZ1lTQnpjR1ZqYVdGc0lITjViblJoZUNBb2FuVnpkQ0JzYVd0bElHRnVJRzl5WkdWeUlHSjVJRk5SVENCamJHRjFjMlVwWEc0Z0lDQWdJQ0FnSUNBZ0lDQXZMeUJvZEhSd2N6b3ZMMmRwZEdoMVlpNWpiMjB2WW1WbmNtbG1abk12Y0c5emRHZHlaWE4wTDNkcGEya3ZVbTkxZEdsdVp5Tm1hV3gwWlhKcGJtY3RZVzVrTFc5eVpHVnlhVzVuWEc0Z0lDQWdJQ0FnSUNBZ0lDQmpiMjV6ZENCdmNtUmxjaUE5SUNncElEMCtJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdaMlYwZEdWeWN5NXZjbVJsY2lncElDWW1JRjh1Y21Wa2RXTmxLRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCblpYUjBaWEp6TG05eVpHVnlLQ2tzSUNodFpXMXZMQ0JrYVhKbFkzUnBiMjRzSUdGMGRISXBJRDArSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUcxbGJXOHVjSFZ6YUNoaGRIUnlJQ3NnSnk0bklDc2daR2x5WldOMGFXOXVLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQnRaVzF2TzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlMQ0JiWFZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNrdWFtOXBiaWduTENjcE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnZlN4Y2JseHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHOXlaR1Z5VUdGeVlXMWxkR1Z5SUQwZ2IzSmtaWElvS1NBL0lIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYjNKa1pYSTZJRzl5WkdWeUtDbGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlJRG9nZTMwN1hHNWNiaUFnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUJmTG1WNGRHVnVaQ2g3ZlN3Z2IzSmtaWEpRWVhKaGJXVjBaWElzSUhCaGNtRnRaWFJsY25OWGFYUm9iM1YwVDNKa1pYSW9LU2s3WEc1Y2JpQWdJQ0FnSUNBZ2ZUdGNibHh1SUNBZ0lISmxkSFZ5YmlCZkxtVjRkR1Z1WkNodVpYZFdUU3dnWjJWMGRHVnljeXdnZTF4dUlDQWdJQ0FnSUNCd1lYSmhiV1YwWlhKek9pQndZWEpoYldWMFpYSnpMRnh1SUNBZ0lDQWdJQ0J3WVhKaGJXVjBaWEp6VjJsMGFHOTFkRTl5WkdWeU9pQndZWEpoYldWMFpYSnpWMmwwYUc5MWRFOXlaR1Z5WEc0Z0lDQWdmU2s3WEc1OU8xeHVYRzVsZUhCdmNuUWdaR1ZtWVhWc2RDQm1hV3gwWlhKelZrMDdYRzRpTENKcGJYQnZjblFnYlNCbWNtOXRJQ2R0YVhSb2NtbHNKenRjYm1sdGNHOXlkQ0JmSUdaeWIyMGdKM1Z1WkdWeWMyTnZjbVVuTzF4dVhHNWpiMjV6ZENCd1lXZHBibUYwYVc5dVZrMGdQU0FvYlc5a1pXd3NJRzl5WkdWeUxDQmxlSFJ5WVVobFlXUmxjbk1nUFNCN2ZTd2dZWFYwYUdWdWRHbGpZWFJsSUQwZ2RISjFaU2tnUFQ0Z2UxeHVJQ0FnSUd4bGRDQmpiMnhzWldOMGFXOXVJRDBnYlM1d2NtOXdLRnRkS1N4Y2JpQWdJQ0FnSUNBZ1pHVm1ZWFZzZEU5eVpHVnlJRDBnYjNKa1pYSWdmSHdnSjJsa0xtUmxjMk1uTEZ4dUlDQWdJQ0FnSUNCbWFXeDBaWEp6SUQwZ2JTNXdjbTl3S0h0Y2JpQWdJQ0FnSUNBZ0lDQWdJRzl5WkdWeU9pQmtaV1poZFd4MFQzSmtaWEpjYmlBZ0lDQWdJQ0FnZlNrc1hHNGdJQ0FnSUNBZ0lHbHpURzloWkdsdVp5QTlJRzB1Y0hKdmNDaG1ZV3h6WlNrc1hHNGdJQ0FnSUNBZ0lIQmhaMlVnUFNCdExuQnliM0FvTVNrc1hHNGdJQ0FnSUNBZ0lISmxjM1ZzZEhORGIzVnVkQ0E5SUcwdWNISnZjQ2dwTEZ4dUlDQWdJQ0FnSUNCd1lXZGxVbVZ4ZFdWemRDQTlJR0YxZEdobGJuUnBZMkYwWlNBL0lHMXZaR1ZzTG1kbGRGQmhaMlZYYVhSb1ZHOXJaVzRnT2lCdGIyUmxiQzVuWlhSUVlXZGxMRnh1SUNBZ0lDQWdJQ0IwYjNSaGJDQTlJRzB1Y0hKdmNDZ3BPMXh1WEc0Z0lDQWdZMjl1YzNRZ1ptVjBZMmdnUFNBb0tTQTlQaUI3WEc0Z0lDQWdJQ0FnSUd4bGRDQmtJRDBnYlM1a1pXWmxjbkpsWkNncE8xeHVJQ0FnSUNBZ0lDQmpiMjV6ZENCblpYUlViM1JoYkNBOUlDaDRhSElwSUQwK0lIdGNiaUFnSUNBZ0lDQWdJQ0FnSUdsbUlDZ2hlR2h5SUh4OElIaG9jaTV6ZEdGMGRYTWdQVDA5SURBcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z1NsTlBUaTV6ZEhKcGJtZHBabmtvZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQm9hVzUwT2lCdWRXeHNMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCa1pYUmhhV3h6T2lCdWRXeHNMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCamIyUmxPaUF3TEZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnRaWE56WVdkbE9pQW5RMjl1Ym1WamRHbHZiaUJsY25KdmNpZGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdJQ0FnSUd4bGRDQnlZVzVuWlVobFlXUmxjaUE5SUhob2NpNW5aWFJTWlhOd2IyNXpaVWhsWVdSbGNpZ25RMjl1ZEdWdWRDMVNZVzVuWlNjcE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnYVdZZ0tGOHVhWE5UZEhKcGJtY29jbUZ1WjJWSVpXRmtaWElwS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2JHVjBJRnRvWldGa1pYSlRhWHBsTENCb1pXRmtaWEpEYjNWdWRGMGdQU0J5WVc1blpVaGxZV1JsY2k1emNHeHBkQ2duTHljcExGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JiYUdWaFpHVnlSbkp2YlN3Z2FHVmhaR1Z5Vkc5ZElEMGdhR1ZoWkdWeVUybDZaUzV6Y0d4cGRDZ25MU2NwTEZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjBieUE5SUhCaGNuTmxTVzUwS0dobFlXUmxjbFJ2S1NBcklERWdmSHdnTUN4Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdabkp2YlNBOUlIQmhjbk5sU1c1MEtHaGxZV1JsY2taeWIyMHBJQ0I4ZkNBd08xeHVYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdkRzkwWVd3b2NHRnljMlZKYm5Rb2FHVmhaR1Z5UTI5MWJuUXBLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J5WlhOMWJIUnpRMjkxYm5Rb2RHOGdMU0JtY205dEtUdGNiaUFnSUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ0lDQWdJSFJ5ZVNCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1NsTlBUaTV3WVhKelpTaDRhSEl1Y21WemNHOXVjMlZVWlhoMEtUdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z2VHaHlMbkpsYzNCdmJuTmxWR1Y0ZER0Y2JpQWdJQ0FnSUNBZ0lDQWdJSDBnWTJGMFkyZ2dLR1Y0S1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2NtVjBkWEp1SUVwVFQwNHVjM1J5YVc1bmFXWjVLSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2FHbHVkRG9nYm5Wc2JDeGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnWkdWMFlXbHNjem9nYm5Wc2JDeGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnWTI5a1pUb2dNQ3hjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2JXVnpjMkZuWlRvZ2VHaHlMbkpsYzNCdmJuTmxWR1Y0ZEZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUgwcE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNCOU8xeHVJQ0FnSUNBZ0lDQnBjMHh2WVdScGJtY29kSEoxWlNrN1hHNGdJQ0FnSUNBZ0lIQmhaMlZTWlhGMVpYTjBLR1pwYkhSbGNuTW9LU3dnY0dGblpTZ3BMQ0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQmlZV05yWjNKdmRXNWtPaUIwY25WbExGeHVJQ0FnSUNBZ0lDQWdJQ0FnWlhoMGNtRmpkRG9nWjJWMFZHOTBZV3hjYmlBZ0lDQWdJQ0FnZlN3Z1pYaDBjbUZJWldGa1pYSnpLUzUwYUdWdUtDaGtZWFJoS1NBOVBpQjdYRzRnSUNBZ0lDQWdJQ0FnSUNCamIyeHNaV04wYVc5dUtGOHVkVzVwYjI0b1kyOXNiR1ZqZEdsdmJpZ3BMQ0JrWVhSaEtTazdYRzRnSUNBZ0lDQWdJQ0FnSUNCcGMweHZZV1JwYm1jb1ptRnNjMlVwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdaQzV5WlhOdmJIWmxLR052Ykd4bFkzUnBiMjRvS1NrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0J0TG5KbFpISmhkeWdwTzF4dUlDQWdJQ0FnSUNCOUxDQW9aWEp5YjNJcElEMCtJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lHbHpURzloWkdsdVp5aG1ZV3h6WlNrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0IwYjNSaGJDZ3dLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lHUXVjbVZxWldOMEtHVnljbTl5S1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJRzB1Y21Wa2NtRjNLQ2s3WEc0Z0lDQWdJQ0FnSUgwcE8xeHVJQ0FnSUNBZ0lDQnlaWFIxY200Z1pDNXdjbTl0YVhObE8xeHVJQ0FnSUgwc1hHNWNiaUFnSUNCbWFYSnpkRkJoWjJVZ1BTQW9jR0Z5WVcxbGRHVnljeWtnUFQ0Z2UxeHVJQ0FnSUNBZ0lDQm1hV3gwWlhKektGOHVaWGgwWlc1a0tIdGNiaUFnSUNBZ0lDQWdJQ0FnSUc5eVpHVnlPaUJrWldaaGRXeDBUM0prWlhKY2JpQWdJQ0FnSUNBZ2ZTd2djR0Z5WVcxbGRHVnljeWtwTzF4dUlDQWdJQ0FnSUNCamIyeHNaV04wYVc5dUtGdGRLVHRjYmlBZ0lDQWdJQ0FnY0dGblpTZ3hLVHRjYmlBZ0lDQWdJQ0FnY21WMGRYSnVJR1psZEdOb0tDazdYRzRnSUNBZ2ZTeGNibHh1SUNBZ0lHbHpUR0Z6ZEZCaFoyVWdQU0FvS1NBOVBpQjdYRzRnSUNBZ0lDQWdJSEpsZEhWeWJpQW9iVzlrWld3dWNHRm5aVk5wZW1Vb0tTQStJSEpsYzNWc2RITkRiM1Z1ZENncEtUdGNiaUFnSUNCOUxGeHVYRzRnSUNBZ2JtVjRkRkJoWjJVZ1BTQW9LU0E5UGlCN1hHNGdJQ0FnSUNBZ0lIQmhaMlVvY0dGblpTZ3BJQ3NnTVNrN1hHNGdJQ0FnSUNBZ0lISmxkSFZ5YmlCbVpYUmphQ2dwTzF4dUlDQWdJSDA3WEc1Y2JpQWdJQ0J5WlhSMWNtNGdlMXh1SUNBZ0lDQWdJQ0JqYjJ4c1pXTjBhVzl1T2lCamIyeHNaV04wYVc5dUxGeHVJQ0FnSUNBZ0lDQm1hWEp6ZEZCaFoyVTZJR1pwY25OMFVHRm5aU3hjYmlBZ0lDQWdJQ0FnYVhOTWIyRmthVzVuT2lCcGMweHZZV1JwYm1jc1hHNGdJQ0FnSUNBZ0lHNWxlSFJRWVdkbE9pQnVaWGgwVUdGblpTeGNiaUFnSUNBZ0lDQWdhWE5NWVhOMFVHRm5aVG9nYVhOTVlYTjBVR0ZuWlN4Y2JpQWdJQ0FnSUNBZ2RHOTBZV3c2SUhSdmRHRnNMRnh1SUNBZ0lDQWdJQ0J5WlhOMWJIUnpRMjkxYm5RNklISmxjM1ZzZEhORGIzVnVkRnh1SUNBZ0lIMDdYRzU5TzF4dVhHNWxlSEJ2Y25RZ1pHVm1ZWFZzZENCd1lXZHBibUYwYVc5dVZrMDdYRzRpTENKcGJYQnZjblFnYlNCbWNtOXRJQ2R0YVhSb2NtbHNKenRjYm1sdGNHOXlkQ0JmSUdaeWIyMGdKM1Z1WkdWeWMyTnZjbVVuTzF4dWFXMXdiM0owSUdacGJIUmxjbk5XVFNCbWNtOXRJQ2N1TDNadGN5OW1hV3gwWlhKelZrMG5PMXh1YVcxd2IzSjBJSEJoWjJsdVlYUnBiMjVXVFNCbWNtOXRJQ2N1TDNadGN5OXdZV2RwYm1GMGFXOXVWazBuTzF4dVhHNW1kVzVqZEdsdmJpQlFiM04wWjNKbGMzUWdLQ2tnZTF4dUlDQWdJR3hsZENCd2IzTjBaM0psYzNRZ1BTQjdmVHRjYmx4dUlDQWdJR052Ym5OMElIUnZhMlZ1SUQwZ2JTNXdjbTl3S0Nrc1hHNWNiaUFnSUNBZ0lDQWdJQ0J0WlhKblpVTnZibVpwWnlBOUlDaGpiMjVtYVdjc0lHOXdkR2x2Ym5NcElEMCtJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdjbVYwZFhKdUlHOXdkR2x2Ym5NZ0ppWWdYeTVwYzBaMWJtTjBhVzl1S0c5d2RHbHZibk11WTI5dVptbG5LU0EvSUY4dVkyOXRjRzl6WlNodmNIUnBiMjV6TG1OdmJtWnBaeXdnWTI5dVptbG5LU0E2SUdOdmJtWnBaenRjYmlBZ0lDQWdJQ0FnSUNCOUxGeHVYRzRnSUNBZ0lDQWdJQ0FnWVdSa1NHVmhaR1Z5Y3lBOUlDaG9aV0ZrWlhKektTQTlQaUI3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQW9lR2h5S1NBOVBpQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JmTG1WaFkyZ29hR1ZoWkdWeWN5d2dLSFpoYkhWbExDQnJaWGtwSUQwK0lIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCNGFISXVjMlYwVW1WeGRXVnpkRWhsWVdSbGNpaHJaWGtzSUhaaGJIVmxLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUgwcE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdjbVYwZFhKdUlIaG9janRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdmVHRjYmlBZ0lDQWdJQ0FnSUNCOUxGeHVYRzRnSUNBZ0lDQWdJQ0FnWVdSa1EyOXVabWxuU0dWaFpHVnljeUE5SUNob1pXRmtaWEp6TENCdmNIUnBiMjV6S1NBOVBpQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCZkxtVjRkR1Z1WkNoN2ZTd2diM0IwYVc5dWN5d2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnWTI5dVptbG5PaUJ0WlhKblpVTnZibVpwWnloaFpHUklaV0ZrWlhKektHaGxZV1JsY25NcExDQnZjSFJwYjI1ektWeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNCOUtUdGNiaUFnSUNBZ0lDQWdJQ0I5TEZ4dVhHNGdJQ0FnSUNBZ0lDQWdZM0psWVhSbFRHOWhaR1Z5SUQwZ0tISmxjWFZsYzNSR2RXNWpkR2x2Yml3Z2IzQjBhVzl1Y3l3Z1pHVm1ZWFZzZEZOMFlYUmxJRDBnWm1Gc2MyVXBJRDArSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnWTI5dWMzUWdiRzloWkdWeUlEMGdiUzV3Y205d0tHUmxabUYxYkhSVGRHRjBaU2tzWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHUWdQU0J0TG1SbFptVnljbVZrS0NrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUd4dllXUmxjaTVzYjJGa0lEMGdLQ2tnUFQ0Z2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdiRzloWkdWeUtIUnlkV1VwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2JTNXlaV1J5WVhjb0tUdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEpsY1hWbGMzUkdkVzVqZEdsdmJpaGZMbVY0ZEdWdVpDaDdmU3dnYjNCMGFXOXVjeXdnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR0poWTJ0bmNtOTFibVE2SUhSeWRXVmNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDBwS1M1MGFHVnVLQ2hrWVhSaEtTQTlQaUI3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdiRzloWkdWeUtHWmhiSE5sS1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JrTG5KbGMyOXNkbVVvWkdGMFlTazdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2JTNXlaV1J5WVhjb0tUdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDBzSUNobGNuSnZjaWtnUFQ0Z2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUd4dllXUmxjaWhtWVd4elpTazdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1pDNXlaV3BsWTNRb1pYSnliM0lwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJRzB1Y21Wa2NtRjNLQ2s3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCOUtUdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQmtMbkJ5YjIxcGMyVTdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lIMDdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCc2IyRmtaWEk3WEc0Z0lDQWdJQ0FnSUNBZ2ZTeGNibHh1SUNBZ0lDQWdJQ0FnSUhKbGNISmxjMlZ1ZEdGMGFXOXVTR1ZoWkdWeUlEMGdlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQW5VSEpsWm1WeUp6b2dKM0psZEhWeWJqMXlaWEJ5WlhObGJuUmhkR2x2YmlkY2JpQWdJQ0FnSUNBZ0lDQjlPMXh1WEc0Z0lDQWdjRzl6ZEdkeVpYTjBMblJ2YTJWdUlEMGdkRzlyWlc0N1hHNWNiaUFnSUNCd2IzTjBaM0psYzNRdWFXNXBkQ0E5SUNoaGNHbFFjbVZtYVhnc0lHRjFkR2hsYm5ScFkyRjBhVzl1VDNCMGFXOXVjeXdnWjJ4dlltRnNTR1ZoWkdWeUlEMGdlMzBwSUQwK0lIdGNiaUFnSUNBZ0lDQWdjRzl6ZEdkeVpYTjBMbkpsY1hWbGMzUWdQU0FvYjNCMGFXOXVjeWtnUFQ0Z2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnWTI5dWMzUWdaWEp5YjNKSVlXNWtiR1Z5SUQwZ0tIaG9jaWtnUFQ0Z2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIUnllU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lFcFRUMDR1Y0dGeWMyVW9lR2h5TG5KbGMzQnZibk5sVkdWNGRDazdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUI0YUhJdWNtVnpjRzl1YzJWVVpYaDBPMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDBnWTJGMFkyZ2dLR1Y0S1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQktVMDlPTG5OMGNtbHVaMmxtZVNoN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCb2FXNTBPaUJ1ZFd4c0xGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1pHVjBZV2xzY3pvZ2JuVnNiQ3hjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR052WkdVNklEQXNYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnRaWE56WVdkbE9pQjRhSEl1Y21WemNHOXVjMlZVWlhoMFhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDBwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ0lDQWdJSDA3WEc0Z0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z2JTNXlaWEYxWlhOMEtGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHRmtaRU52Ym1acFowaGxZV1JsY25Nb1oyeHZZbUZzU0dWaFpHVnlMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCZkxtVjRkR1Z1WkNoN1pYaDBjbUZqZERvZ1pYSnliM0pJWVc1a2JHVnlmU3dnYjNCMGFXOXVjeXdnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZFhKc09pQmhjR2xRY21WbWFYZ2dLeUJ2Y0hScGIyNXpMblZ5YkZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlLVnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ2xjYmlBZ0lDQWdJQ0FnSUNBZ0lDazdYRzRnSUNBZ0lDQWdJSDA3WEc1Y2JpQWdJQ0FnSUNBZ1kyOXVjM1FnWVhWMGFHVnVkR2xqWVhScGIyNVNaWEYxWlhOMFpXUWdQU0J0TG5CeWIzQW9abUZzYzJVcE8xeHVJQ0FnSUNBZ0lDQndiM04wWjNKbGMzUXVZWFYwYUdWdWRHbGpZWFJsSUQwZ0tHUmxiR1ZuWVhSbFpFUmxabVZ5Y21Wa0tTQTlQaUI3WEc0Z0lDQWdJQ0FnSUNBZ0lDQmpiMjV6ZENCa1pXWmxjbkpsWkNBOUlHUmxiR1ZuWVhSbFpFUmxabVZ5Y21Wa0lIeDhJRzB1WkdWbVpYSnlaV1FvS1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJR2xtSUNoMGIydGxiaWdwS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1pHVm1aWEp5WldRdWNtVnpiMngyWlNoN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSFJ2YTJWdU9pQjBiMnRsYmlncFhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2ZTazdYRzRnSUNBZ0lDQWdJQ0FnSUNCOUlHVnNjMlVnYVdZZ0tDRmhkWFJvWlc1MGFXTmhkR2x2YmxKbGNYVmxjM1JsWkNncEtTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdZWFYwYUdWdWRHbGpZWFJwYjI1U1pYRjFaWE4wWldRb2RISjFaU2s3WEc1Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCdExuSmxjWFZsYzNRb1h5NWxlSFJsYm1Rb2UzMHNJR0YxZEdobGJuUnBZMkYwYVc5dVQzQjBhVzl1Y3lrcExuUm9aVzRvS0dSaGRHRXBJRDArSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdZWFYwYUdWdWRHbGpZWFJwYjI1U1pYRjFaWE4wWldRb1ptRnNjMlVwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjBiMnRsYmloa1lYUmhMblJ2YTJWdUtUdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnWkdWbVpYSnlaV1F1Y21WemIyeDJaU2g3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0IwYjJ0bGJqb2dkRzlyWlc0b0tWeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0I5S1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCOUtTNWpZWFJqYUNnb1pHRjBZU2tnUFQ0Z2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JoZFhSb1pXNTBhV05oZEdsdmJsSmxjWFZsYzNSbFpDaG1ZV3h6WlNrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR1JsWm1WeWNtVmtMbkpsYW1WamRDaGtZWFJoS1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCOUtUdGNiaUFnSUNBZ0lDQWdJQ0FnSUgwZ1pXeHpaU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYzJWMFZHbHRaVzkxZENnb0tTQTlQaUJ3YjNOMFozSmxjM1F1WVhWMGFHVnVkR2xqWVhSbEtHUmxabVZ5Y21Wa0tTd2dNalV3S1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCa1pXWmxjbkpsWkM1d2NtOXRhWE5sTzF4dUlDQWdJQ0FnSUNCOU8xeHVYRzRnSUNBZ0lDQWdJSEJ2YzNSbmNtVnpkQzV5WlhGMVpYTjBWMmwwYUZSdmEyVnVJRDBnS0c5d2RHbHZibk1wSUQwK0lIdGNiaUFnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUJ3YjNOMFozSmxjM1F1WVhWMGFHVnVkR2xqWVhSbEtDa3VkR2hsYmloY2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBb0tTQTlQaUI3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCd2IzTjBaM0psYzNRdWNtVnhkV1Z6ZENoaFpHUkRiMjVtYVdkSVpXRmtaWEp6S0h0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNkQmRYUm9iM0pwZW1GMGFXOXVKem9nSjBKbFlYSmxjaUFuSUNzZ2RHOXJaVzRvS1Z4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlMQ0J2Y0hScGIyNXpLU2s3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZlN3Z0tDa2dQVDRnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z2NHOXpkR2R5WlhOMExuSmxjWFZsYzNRb2IzQjBhVzl1Y3lrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQWdJQ0FnS1R0Y2JpQWdJQ0FnSUNBZ2ZUdGNibHh1SUNBZ0lDQWdJQ0J3YjNOMFozSmxjM1F1Ykc5aFpHVnlJRDBnWHk1d1lYSjBhV0ZzS0dOeVpXRjBaVXh2WVdSbGNpd2djRzl6ZEdkeVpYTjBMbkpsY1hWbGMzUXBPMXh1SUNBZ0lDQWdJQ0JjYmlBZ0lDQWdJQ0FnY0c5emRHZHlaWE4wTG14dllXUmxjbGRwZEdoVWIydGxiaUE5SUY4dWNHRnlkR2xoYkNoamNtVmhkR1ZNYjJGa1pYSXNJSEJ2YzNSbmNtVnpkQzV5WlhGMVpYTjBWMmwwYUZSdmEyVnVLVHRjYmx4dUlDQWdJQ0FnSUNCd2IzTjBaM0psYzNRdWJXOWtaV3dnUFNBb2JtRnRaU2tnUFQ0Z2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnWTI5dWMzUWdjR0ZuYVc1aGRHbHZia2hsWVdSbGNuTWdQU0FvY0dGblpTd2djR0ZuWlZOcGVtVXBJRDArSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCcFppQW9JWEJoWjJWVGFYcGxLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lISmxkSFZ5Ymp0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCOVhHNWNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQmpiMjV6ZENCMGIxSmhibWRsSUQwZ0tDa2dQVDRnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQmpiMjV6ZENCbWNtOXRJRDBnS0hCaFoyVWdMU0F4S1NBcUlIQmhaMlZUYVhwbExGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjBieUE5SUdaeWIyMGdLeUJ3WVdkbFUybDZaU0F0SURFN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQm1jbTl0SUNzZ0p5MG5JQ3NnZEc4N1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2ZUdGNibHh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNkU1lXNW5aUzExYm1sMEp6b2dKMmwwWlcxekp5eGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSjFKaGJtZGxKem9nZEc5U1lXNW5aU2dwWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZlR0Y2JpQWdJQ0FnSUNBZ0lDQWdJSDBzWEc1Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIQmhaMlZUYVhwbElEMGdiUzV3Y205d0tERXdLU3hjYmx4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2JtRnRaVTl3ZEdsdmJuTWdQU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdkWEpzT2lBbkx5Y2dLeUJ1WVcxbFhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlMRnh1WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCblpYUlBjSFJwYjI1eklEMGdLR1JoZEdFc0lIQmhaMlVzSUhCaFoyVlRhWHBsTENCdmNIUnBiMjV6TENCb1pXRmtaWEp6SUQwZ2UzMHBJRDArSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JqYjI1emRDQmxlSFJ5WVVobFlXUmxjbk1nUFNCZkxtVjRkR1Z1WkNoN2ZTd2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FuVUhKbFptVnlKem9nSjJOdmRXNTBQVzV2Ym1VblhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZlN3Z2FHVmhaR1Z5Y3l3Z2NHRm5hVzVoZEdsdmJraGxZV1JsY25Nb2NHRm5aU3dnY0dGblpWTnBlbVVwS1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdZV1JrUTI5dVptbG5TR1ZoWkdWeWN5aGxlSFJ5WVVobFlXUmxjbk1zSUY4dVpYaDBaVzVrS0h0OUxDQnZjSFJwYjI1ekxDQnVZVzFsVDNCMGFXOXVjeXdnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCdFpYUm9iMlE2SUNkSFJWUW5MRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JrWVhSaE9pQmtZWFJoWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmU2twTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2ZTeGNibHh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnY1hWbGNubHpkSEpwYm1jZ1BTQW9abWxzZEdWeWN5d2diM0IwYVc5dWN5a2dQVDRnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJRzl3ZEdsdmJuTXVkWEpzSUNzOUlDYy9KeUFySUcwdWNtOTFkR1V1WW5WcGJHUlJkV1Z5ZVZOMGNtbHVaeWhtYVd4MFpYSnpLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z2IzQjBhVzl1Y3p0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIMHNYRzVjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUc5d2RHbHZibk1nUFNBb2IzQjBhVzl1Y3lrZ1BUNGdlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCd2IzTjBaM0psYzNRdWNtVnhkV1Z6ZENoZkxtVjRkR1Z1WkNoN2ZTd2diM0IwYVc5dWN5d2dibUZ0WlU5d2RHbHZibk1zSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2JXVjBhRzlrT2lBblQxQlVTVTlPVXlkY2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0I5S1NrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlMRnh1WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCd2IzTjBUM0IwYVc5dWN5QTlJQ2hoZEhSeWFXSjFkR1Z6TENCdmNIUnBiMjV6TENCb1pXRmtaWEp6SUQwZ2UzMHBJRDArSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JqYjI1emRDQmxlSFJ5WVVobFlXUmxjbk1nUFNCZkxtVjRkR1Z1WkNoN2ZTd2djbVZ3Y21WelpXNTBZWFJwYjI1SVpXRmtaWElzSUdobFlXUmxjbk1wTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQmhaR1JEYjI1bWFXZElaV0ZrWlhKektGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQmxlSFJ5WVVobFlXUmxjbk1zWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUY4dVpYaDBaVzVrS0h0OUxGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnZjSFJwYjI1ekxGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnVZVzFsVDNCMGFXOXVjeXdnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdiV1YwYUc5a09pQW5VRTlUVkNjc1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JrWVhSaE9pQmhkSFJ5YVdKMWRHVnpYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FwWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUgwc1hHNWNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR1JsYkdWMFpVOXdkR2x2Ym5NZ1BTQW9abWxzZEdWeWN5d2diM0IwYVc5dWN5d2dhR1ZoWkdWeWN5QTlJSHQ5S1NBOVBpQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1kyOXVjM1FnWlhoMGNtRklaV0ZrWlhKeklEMGdYeTVsZUhSbGJtUW9lMzBzSUhKbGNISmxjMlZ1ZEdGMGFXOXVTR1ZoWkdWeUxDQm9aV0ZrWlhKektUdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCeVpYUjFjbTRnY1hWbGNubHpkSEpwYm1jb1ptbHNkR1Z5Y3l3Z1lXUmtRMjl1Wm1sblNHVmhaR1Z5Y3lobGVIUnlZVWhsWVdSbGNuTXNJRjh1WlhoMFpXNWtLSHQ5TENCdmNIUnBiMjV6TENCdVlXMWxUM0IwYVc5dWN5d2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J0WlhSb2IyUTZJQ2RFUlV4RlZFVW5YRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2ZTa3BLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUgwc1hHNWNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEJoZEdOb1QzQjBhVzl1Y3lBOUlDaG1hV3gwWlhKekxDQmhkSFJ5YVdKMWRHVnpMQ0J2Y0hScGIyNXpMQ0JvWldGa1pYSnpJRDBnZTMwcElEMCtJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQmpiMjV6ZENCbGVIUnlZVWhsWVdSbGNuTWdQU0JmTG1WNGRHVnVaQ2g3ZlN3Z2NtVndjbVZ6Wlc1MFlYUnBiMjVJWldGa1pYSXNJR2hsWVdSbGNuTXBPMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCeGRXVnllWE4wY21sdVp5aGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdabWxzZEdWeWN5eGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdZV1JrUTI5dVptbG5TR1ZoWkdWeWN5aGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdWNGRISmhTR1ZoWkdWeWN5eGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUY4dVpYaDBaVzVrS0h0OUxGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYjNCMGFXOXVjeXhjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHNWhiV1ZQY0hScGIyNXpMQ0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYldWMGFHOWtPaUFuVUVGVVEwZ25MRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR1JoZEdFNklHRjBkSEpwWW5WMFpYTmNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdLVnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FwWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUgwc1hHNWNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR2RsZEZCaFoyVlBjSFJwYjI1eklEMGdLR1JoZEdFc0lIQmhaMlVzSUc5d2RHbHZibk1zSUdobFlXUmxjbk1nUFNCN2ZTa2dQVDRnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQm5aWFJQY0hScGIyNXpLR1JoZEdFc0lDaHdZV2RsSUh4OElERXBMQ0J3WVdkbFUybDZaU2dwTENCdmNIUnBiMjV6TENCb1pXRmtaWEp6S1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIMHNYRzVjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdkbGRGSnZkMDl3ZEdsdmJuTWdQU0FvWkdGMFlTd2diM0IwYVc5dWN5d2dhR1ZoWkdWeWN5QTlJSHQ5S1NBOVBpQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2NtVjBkWEp1SUdkbGRFOXdkR2x2Ym5Nb1pHRjBZU3dnTVN3Z01Td2diM0IwYVc5dWN5d2dhR1ZoWkdWeWN5azdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0I5TzF4dVhHNGdJQ0FnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEJoWjJWVGFYcGxPaUJ3WVdkbFUybDZaU3hjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JuWlhSUVlXZGxUM0IwYVc5dWN6b2daMlYwVUdGblpVOXdkR2x2Ym5Nc1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1oyVjBVbTkzVDNCMGFXOXVjem9nWjJWMFVtOTNUM0IwYVc5dWN5eGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQndZWFJqYUU5d2RHbHZibk02SUhCaGRHTm9UM0IwYVc5dWN5eGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQndiM04wVDNCMGFXOXVjem9nY0c5emRFOXdkR2x2Ym5Nc1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1pHVnNaWFJsVDNCMGFXOXVjem9nWkdWc1pYUmxUM0IwYVc5dWN5eGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQm5aWFJRWVdkbE9pQmZMbU52YlhCdmMyVW9jRzl6ZEdkeVpYTjBMbkpsY1hWbGMzUXNJR2RsZEZCaFoyVlBjSFJwYjI1ektTeGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQm5aWFJTYjNjNklGOHVZMjl0Y0c5elpTaHdiM04wWjNKbGMzUXVjbVZ4ZFdWemRDd2daMlYwVW05M1QzQjBhVzl1Y3lrc1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2NHRjBZMmc2SUY4dVkyOXRjRzl6WlNod2IzTjBaM0psYzNRdWNtVnhkV1Z6ZEN3Z2NHRjBZMmhQY0hScGIyNXpLU3hjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J3YjNOME9pQmZMbU52YlhCdmMyVW9jRzl6ZEdkeVpYTjBMbkpsY1hWbGMzUXNJSEJ2YzNSUGNIUnBiMjV6S1N4Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCa1pXeGxkR1ZTWlhGMVpYTjBPaUJmTG1OdmJYQnZjMlVvY0c5emRHZHlaWE4wTG5KbGNYVmxjM1FzSUdSbGJHVjBaVTl3ZEdsdmJuTXBMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR2RsZEZCaFoyVlhhWFJvVkc5clpXNDZJRjh1WTI5dGNHOXpaU2h3YjNOMFozSmxjM1F1Y21WeGRXVnpkRmRwZEdoVWIydGxiaXdnWjJWMFVHRm5aVTl3ZEdsdmJuTXBMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR2RsZEZKdmQxZHBkR2hVYjJ0bGJqb2dYeTVqYjIxd2IzTmxLSEJ2YzNSbmNtVnpkQzV5WlhGMVpYTjBWMmwwYUZSdmEyVnVMQ0JuWlhSU2IzZFBjSFJwYjI1ektTeGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQndZWFJqYUZkcGRHaFViMnRsYmpvZ1h5NWpiMjF3YjNObEtIQnZjM1JuY21WemRDNXlaWEYxWlhOMFYybDBhRlJ2YTJWdUxDQndZWFJqYUU5d2RHbHZibk1wTEZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhCdmMzUlhhWFJvVkc5clpXNDZJRjh1WTI5dGNHOXpaU2h3YjNOMFozSmxjM1F1Y21WeGRXVnpkRmRwZEdoVWIydGxiaXdnY0c5emRFOXdkR2x2Ym5NcExGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHUmxiR1YwWlZkcGRHaFViMnRsYmpvZ1h5NWpiMjF3YjNObEtIQnZjM1JuY21WemRDNXlaWEYxWlhOMFYybDBhRlJ2YTJWdUxDQmtaV3hsZEdWUGNIUnBiMjV6S1N4Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCdmNIUnBiMjV6T2lCdmNIUnBiMjV6WEc0Z0lDQWdJQ0FnSUNBZ0lDQjlPMXh1SUNBZ0lDQWdJQ0I5TzF4dVhHNGdJQ0FnSUNBZ0lISmxkSFZ5YmlCd2IzTjBaM0psYzNRN1hHNGdJQ0FnZlR0Y2JseHVJQ0FnSUhCdmMzUm5jbVZ6ZEM1bWFXeDBaWEp6VmswZ1BTQm1hV3gwWlhKelZrMDdYRzRnSUNBZ2NHOXpkR2R5WlhOMExuQmhaMmx1WVhScGIyNVdUU0E5SUhCaFoybHVZWFJwYjI1V1RUdGNiaUFnWEc0Z0lDQWdjbVYwZFhKdUlIQnZjM1JuY21WemREdGNibjFjYmx4dVpYaHdiM0owSUdSbFptRjFiSFFnVUc5emRHZHlaWE4wTzF4dUlsMHNJbTVoYldWeklqcGJJbVpwYkhSbGNuTldUU0lzSW1GMGRISnBZblYwWlhNaUxDSnVaWGRXVFNJc0ltWnBiSFJsY2lJc0luQnliM0FpTENKdElpd2labWxzZEdWeVVISnZjQ0lzSW5aaGJIVmxJaXdpWVhKbmRXMWxiblJ6SWl3aWJHVnVaM1JvSWl3aWRHOUdhV3gwWlhJaUxDSmZJaXdpYVhOVGRISnBibWNpTENKMGNtbHRJaXdpWjJWMGRHVnljeUlzSW5KbFpIVmpaU0lzSW0xbGJXOGlMQ0p2Y0dWeVlYUnZjaUlzSW1GMGRISWlMQ0p3WVhKaGJXVjBaWEp6VjJsMGFHOTFkRTl5WkdWeUlpd2laMlYwZEdWeUlpd2lhWE5HZFc1amRHbHZiaUlzSW5WdVpHVm1hVzVsWkNJc0luSmxjR3hoWTJVaUxDSnNkR1VpTENKbmRHVWlMQ0p3ZFhOb0lpd2ljR0Z5WVcxbGRHVnljeUlzSW05eVpHVnlJaXdpWkdseVpXTjBhVzl1SWl3aWFtOXBiaUlzSW05eVpHVnlVR0Z5WVcxbGRHVnlJaXdpWlhoMFpXNWtJaXdpY0dGbmFXNWhkR2x2YmxaTklpd2liVzlrWld3aUxDSmxlSFJ5WVVobFlXUmxjbk1pTENKaGRYUm9aVzUwYVdOaGRHVWlMQ0pqYjJ4c1pXTjBhVzl1SWl3aVpHVm1ZWFZzZEU5eVpHVnlJaXdpWm1sc2RHVnljeUlzSW1selRHOWhaR2x1WnlJc0luQmhaMlVpTENKeVpYTjFiSFJ6UTI5MWJuUWlMQ0p3WVdkbFVtVnhkV1Z6ZENJc0ltZGxkRkJoWjJWWGFYUm9WRzlyWlc0aUxDSm5aWFJRWVdkbElpd2lkRzkwWVd3aUxDSm1aWFJqYUNJc0ltUWlMQ0prWldabGNuSmxaQ0lzSW1kbGRGUnZkR0ZzSWl3aWVHaHlJaXdpYzNSaGRIVnpJaXdpU2xOUFRpSXNJbk4wY21sdVoybG1lU0lzSW5KaGJtZGxTR1ZoWkdWeUlpd2laMlYwVW1WemNHOXVjMlZJWldGa1pYSWlMQ0p6Y0d4cGRDSXNJbWhsWVdSbGNsTnBlbVVpTENKb1pXRmtaWEpEYjNWdWRDSXNJbWhsWVdSbGNrWnliMjBpTENKb1pXRmtaWEpVYnlJc0luUnZJaXdpY0dGeWMyVkpiblFpTENKbWNtOXRJaXdpY21WemNHOXVjMlZVWlhoMElpd2laWGdpTENKMGFHVnVJaXdpWkdGMFlTSXNJblZ1YVc5dUlpd2ljbVZ6YjJ4MlpTSXNJbkpsWkhKaGR5SXNJbVZ5Y205eUlpd2ljbVZxWldOMElpd2ljSEp2YldselpTSXNJbVpwY25OMFVHRm5aU0lzSW1selRHRnpkRkJoWjJVaUxDSndZV2RsVTJsNlpTSXNJbTVsZUhSUVlXZGxJaXdpVUc5emRHZHlaWE4wSWl3aWNHOXpkR2R5WlhOMElpd2lkRzlyWlc0aUxDSnRaWEpuWlVOdmJtWnBaeUlzSW1OdmJtWnBaeUlzSW05d2RHbHZibk1pTENKamIyMXdiM05sSWl3aVlXUmtTR1ZoWkdWeWN5SXNJbWhsWVdSbGNuTWlMQ0psWVdOb0lpd2lhMlY1SWl3aWMyVjBVbVZ4ZFdWemRFaGxZV1JsY2lJc0ltRmtaRU52Ym1acFowaGxZV1JsY25NaUxDSmpjbVZoZEdWTWIyRmtaWElpTENKeVpYRjFaWE4wUm5WdVkzUnBiMjRpTENKa1pXWmhkV3gwVTNSaGRHVWlMQ0pzYjJGa1pYSWlMQ0pzYjJGa0lpd2ljbVZ3Y21WelpXNTBZWFJwYjI1SVpXRmtaWElpTENKcGJtbDBJaXdpWVhCcFVISmxabWw0SWl3aVlYVjBhR1Z1ZEdsallYUnBiMjVQY0hScGIyNXpJaXdpWjJ4dlltRnNTR1ZoWkdWeUlpd2ljbVZ4ZFdWemRDSXNJbVZ5Y205eVNHRnVaR3hsY2lJc0ltVjRkSEpoWTNRaUxDSjFjbXdpTENKaGRYUm9aVzUwYVdOaGRHbHZibEpsY1hWbGMzUmxaQ0lzSW1SbGJHVm5ZWFJsWkVSbFptVnljbVZrSWl3aVkyRjBZMmdpTENKeVpYRjFaWE4wVjJsMGFGUnZhMlZ1SWl3aWNHRnlkR2xoYkNJc0lteHZZV1JsY2xkcGRHaFViMnRsYmlJc0ltNWhiV1VpTENKd1lXZHBibUYwYVc5dVNHVmhaR1Z5Y3lJc0luUnZVbUZ1WjJVaUxDSnVZVzFsVDNCMGFXOXVjeUlzSW1kbGRFOXdkR2x2Ym5NaUxDSnhkV1Z5ZVhOMGNtbHVaeUlzSW5KdmRYUmxJaXdpWW5WcGJHUlJkV1Z5ZVZOMGNtbHVaeUlzSW5CdmMzUlBjSFJwYjI1eklpd2laR1ZzWlhSbFQzQjBhVzl1Y3lJc0luQmhkR05vVDNCMGFXOXVjeUlzSW1kbGRGQmhaMlZQY0hScGIyNXpJaXdpWjJWMFVtOTNUM0IwYVc5dWN5SmRMQ0p0WVhCd2FXNW5jeUk2SWpzN096czdPMEZCUjBFc1NVRkJUVUVzV1VGQldTeFRRVUZhUVN4VFFVRlpMRU5CUVVORExGVkJRVVFzUlVGQlowSTdVVUZETVVKRExGRkJRVkVzUlVGQldqdFJRVU5KUXl4VFFVRlRMRk5CUVZSQkxFMUJRVk1zUjBGQlRUdFpRVU5NUXl4UFFVRlBReXhGUVVGRlJDeEpRVUZHTEVOQlFVOHNSVUZCVUN4RFFVRmlPMWxCUTBsRkxHRkJRV0VzVTBGQllrRXNWVUZCWVN4RFFVRlZReXhMUVVGV0xFVkJRV2xDTzJkQ1FVTjBRa01zVlVGQlZVTXNUVUZCVml4SFFVRnRRaXhEUVVGMlFpeEZRVUV3UWp0eFFrRkRha0pHTEV0QlFVdzdkVUpCUTA5TUxFdEJRVkE3TzIxQ1FVVkhSU3hOUVVGUU8xTkJUbEk3TzIxQ1FWTlhUU3hSUVVGWUxFZEJRWE5DTEZsQlFVMDdiVUpCUTJwQ1F5eEZRVUZGUXl4UlFVRkdMRU5CUVZkT0xGbEJRVmdzU1VGQk1rSkJMR0ZCUVdGUExFbEJRV0lzUlVGQk0wSXNSMEZCYVVSUUxGbEJRWGhFTzFOQlJFbzdaVUZIVDBFc1ZVRkJVRHRMUVdSU08xRkJhVUpKVVN4VlFVRlZTQ3hGUVVGRlNTeE5RVUZHTEVOQlEwNWtMRlZCUkUwc1JVRkRUU3hWUVVGRFpTeEpRVUZFTEVWQlFVOURMRkZCUVZBc1JVRkJhVUpETEVsQlFXcENMRVZCUVRCQ096czdPMWxCU1RsQ1JDeGhRVUZoTEZOQlFXcENMRVZCUVRSQ08ybENRVU51UWtNc1NVRkJUQ3hKUVVGaE8zRkNRVU5LWml4UlFVUkpPM0ZDUVVWS1FUdGhRVVpVTzFOQlJFb3NUVUZMVHp0cFFrRkRSV1VzU1VGQlRDeEpRVUZoWml4UlFVRmlPenRsUVVWSFlTeEpRVUZRTzB0QllrVXNSVUZqU0R0bFFVTlJZanRMUVdaTUxFTkJha0prTzFGQmIwTkpaMElzZVVKQlFYbENMRk5CUVhwQ1FTeHpRa0ZCZVVJc1IwRkJUVHRsUVVOd1FsSXNSVUZCUlVrc1RVRkJSaXhEUVVOSVJDeFBRVVJITEVWQlEwMHNWVUZCUTBVc1NVRkJSQ3hGUVVGUFNTeE5RVUZRTEVWQlFXVkdMRWxCUVdZc1JVRkJkMEk3WjBKQlEzcENRU3hUUVVGVExFOUJRV0lzUlVGQmMwSTdiMEpCUTFwRUxGZEJRVmRvUWl4WFFVRlhhVUlzU1VGQldDeERRVUZxUWpzN2IwSkJSVWxRTEVWQlFVVlZMRlZCUVVZc1EwRkJZVVFzVDBGQlQxWXNVVUZCY0VJc1RVRkJhME5WTEU5QlFVOVdMRkZCUVZBc1QwRkJjMEpaTEZOQlFYUkNMRWxCUVcxRFJpeFBRVUZQVml4UlFVRlFMRTlCUVhOQ0xFVkJRVE5HTEVOQlFVb3NSVUZCYjBjN01rSkJRM3BHVFN4SlFVRlFPenM3T3pzN2IwSkJUVUZETEdGQlFXRXNUMEZCWWl4SlFVRjNRa0VzWVVGQllTeE5RVUY2UXl4RlFVRnBSRHQ1UWtGRGVFTkRMRWxCUVV3c1NVRkJZVVFzVjBGQlZ5eEpRVUZZTEVkQlFXdENSeXhQUVVGUFZpeFJRVUZRTEVWQlFXeENMRWRCUVhORExFZEJRVzVFTzJsQ1FVUktMRTFCUlU4c1NVRkJTVThzWVVGQllTeEpRVUZxUWl4RlFVRjFRanQ1UWtGRGNrSkRMRWxCUVV3c1NVRkJZVVFzVjBGQlZ5eEhRVUZZTEVkQlFXbENSeXhQUVVGUFZpeFJRVUZRTEVkQlFXdENZU3hQUVVGc1FpeERRVUV3UWl4TlFVRXhRaXhGUVVGclF5eEhRVUZzUXl4RFFVRTVRanRwUWtGRVJ5eE5RVVZCTEVsQlFVbE9MR0ZCUVdFc1UwRkJha0lzUlVGQk5FSTdkMEpCUXpOQ0xFTkJRVU5ITEU5QlFVOUpMRWRCUVZBc1EwRkJWMlFzVVVGQldDeEZRVUZFTEVsQlFUQkNMRU5CUVVOVkxFOUJRVTlMTEVkQlFWQXNRMEZCVjJZc1VVRkJXQ3hGUVVFdlFpeEZRVUZ6UkRzclFrRkRNME5OTEVsQlFWQTdPM2xDUVVWRFJTeEpRVUZNTEVsQlFXRXNSVUZCWWp0M1FrRkRTVVVzVDBGQlQwc3NSMEZCVUN4RlFVRktMRVZCUVd0Q096WkNRVU5VVUN4SlFVRk1MRVZCUVZkUkxFbEJRVmdzUTBGQlowSXNVMEZCVTA0c1QwRkJUMHNzUjBGQlVDeERRVUZYWml4UlFVRllMRVZCUVhwQ096dDNRa0ZGUVZVc1QwRkJUMGtzUjBGQlVDeEZRVUZLTEVWQlFXdENPelpDUVVOVVRpeEpRVUZNTEVWQlFWZFJMRWxCUVZnc1EwRkJaMElzVTBGQlUwNHNUMEZCVDBrc1IwRkJVQ3hEUVVGWFpDeFJRVUZZTEVWQlFYcENPenRwUWtGVVJDeE5RVmRCTEVsQlFVbFBMR0ZCUVdFc1UwRkJha0lzUlVGQk5FSTdlVUpCUXpGQ1F5eEpRVUZNTEVsQlFXRkZMRTlCUVU5V0xGRkJRVkFzVDBGQmMwSXNTVUZCZEVJc1IwRkJOa0lzVTBGQk4wSXNSMEZCZVVNc1lVRkJkRVE3YVVKQlJFY3NUVUZGUVR0NVFrRkRSVkVzU1VGQlRDeEpRVUZoUkN4WFFVRlhMRWRCUVZnc1IwRkJhVUpITEU5QlFVOVdMRkZCUVZBc1JVRkJPVUk3T3p0dFFrRkhSRTBzU1VGQlVEdFRRV3BEUkN4RlFXdERRU3hGUVd4RFFTeERRVUZRTzB0QmNrTlNPMUZCTWtWSlZ5eGhRVUZoTEZOQlFXSkJMRlZCUVdFc1IwRkJUVHM3TzFsQlIxUkRMRkZCUVZFc1UwRkJVa0VzUzBGQlVTeEhRVUZOTzIxQ1FVTlVaQ3hSUVVGUll5eExRVUZTTEUxQlFXMUNha0lzUlVGQlJVa3NUVUZCUml4RFFVTjBRa1FzVVVGQlVXTXNTMEZCVWl4RlFVUnpRaXhGUVVOTUxGVkJRVU5hTEVsQlFVUXNSVUZCVDJFc1UwRkJVQ3hGUVVGclFsZ3NTVUZCYkVJc1JVRkJNa0k3Y1VKQlEyNURVU3hKUVVGTUxFTkJRVlZTTEU5QlFVOHNSMEZCVUN4SFFVRmhWeXhUUVVGMlFqdDFRa0ZEVDJJc1NVRkJVRHRoUVVoclFpeEZRVWx1UWl4RlFVcHRRaXhGUVV0NFFtTXNTVUZNZDBJc1EwRkxia0lzUjBGTWJVSXNRMEZCTVVJN1UwRkVTanRaUVZOSlF5eHBRa0ZCYVVKSUxGVkJRVlU3YlVKQlEyaENRVHRUUVVSTkxFZEJSV0lzUlVGWVVqczdaVUZoVDJwQ0xFVkJRVVZ4UWl4TlFVRkdMRU5CUVZNc1JVRkJWQ3hGUVVGaFJDeGpRVUZpTEVWQlFUWkNXaXgzUWtGQk4wSXNRMEZCVUR0TFFUTkdVanM3VjBFclJrOVNMRVZCUVVWeFFpeE5RVUZHTEVOQlFWTTVRaXhMUVVGVUxFVkJRV2RDV1N4UFFVRm9RaXhGUVVGNVFqdHZRa0ZEYUVKaExGVkJSR2RDTzJkRFFVVktVanRMUVVaeVFpeERRVUZRTzBOQmFFZEtPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN08wRkRRVUVzU1VGQlRXTXNaVUZCWlN4VFFVRm1RU3haUVVGbExFTkJRVU5ETEV0QlFVUXNSVUZCVVU0c1MwRkJVaXhGUVVFd1JEdFJRVUV6UTA4c1dVRkJNa01zZFVWQlFUVkNMRVZCUVRSQ08xRkJRWGhDUXl4WlFVRjNRaXgxUlVGQlZDeEpRVUZUT3p0UlFVTjJSVU1zWVVGQllXaERMRVZCUVVWRUxFbEJRVVlzUTBGQlR5eEZRVUZRTEVOQlFXcENPMUZCUTBsclF5eGxRVUZsVml4VFFVRlRMRk5CUkRWQ08xRkJSVWxYTEZWQlFWVnNReXhGUVVGRlJDeEpRVUZHTEVOQlFVODdaVUZEVG10RE8wdEJSRVFzUTBGR1pEdFJRVXRKUlN4WlFVRlpia01zUlVGQlJVUXNTVUZCUml4RFFVRlBMRXRCUVZBc1EwRk1hRUk3VVVGTlNYRkRMRTlCUVU5d1F5eEZRVUZGUkN4SlFVRkdMRU5CUVU4c1EwRkJVQ3hEUVU1WU8xRkJUMGx6UXl4bFFVRmxja01zUlVGQlJVUXNTVUZCUml4RlFWQnVRanRSUVZGSmRVTXNZMEZCWTFBc1pVRkJaVVlzVFVGQlRWVXNaMEpCUVhKQ0xFZEJRWGREVml4TlFVRk5WeXhQUVZKb1JUdFJRVk5KUXl4UlFVRlJla01zUlVGQlJVUXNTVUZCUml4RlFWUmFPenRSUVZkTk1rTXNVVUZCVVN4VFFVRlNRU3hMUVVGUkxFZEJRVTA3V1VGRFdrTXNTVUZCU1RORExFVkJRVVUwUXl4UlFVRkdMRVZCUVZJN1dVRkRUVU1zVjBGQlZ5eFRRVUZZUVN4UlFVRlhMRU5CUVVORExFZEJRVVFzUlVGQlV6dG5Ra0ZEYkVJc1EwRkJRMEVzUjBGQlJDeEpRVUZSUVN4SlFVRkpReXhOUVVGS0xFdEJRV1VzUTBGQk0wSXNSVUZCT0VJN2RVSkJRMjVDUXl4TFFVRkxReXhUUVVGTUxFTkJRV1U3TUVKQlExb3NTVUZFV1RzMlFrRkZWQ3hKUVVaVE96QkNRVWRhTEVOQlNGazdOa0pCU1ZRN2FVSkJTazRzUTBGQlVEczdaMEpCVDBGRExHTkJRV05LTEVsQlFVbExMR2xDUVVGS0xFTkJRWE5DTEdWQlFYUkNMRU5CUVd4Q08yZENRVU5KTjBNc1JVRkJSVU1zVVVGQlJpeERRVUZYTWtNc1YwRkJXQ3hEUVVGS0xFVkJRVFpDTzNsRFFVTlBRU3haUVVGWlJTeExRVUZhTEVOQlFXdENMRWRCUVd4Q0xFTkJSRkE3TzI5Q1FVTndRa01zVlVGRWIwSTdiMEpCUTFKRExGZEJSRkU3ZDBOQlJVbEVMRmRCUVZkRUxFdEJRVmdzUTBGQmFVSXNSMEZCYWtJc1EwRkdTanM3YjBKQlJYQkNSeXhWUVVadlFqdHZRa0ZGVWtNc1VVRkdVVHR2UWtGSGNrSkRMRVZCU0hGQ0xFZEJSMmhDUXl4VFFVRlRSaXhSUVVGVUxFbEJRWEZDTEVOQlFYSkNMRWxCUVRCQ0xFTkJTRlk3YjBKQlNYSkNSeXhKUVVweFFpeEhRVWxrUkN4VFFVRlRTQ3hWUVVGVUxFdEJRWGxDTEVOQlNsZzdPM05DUVUxdVFrY3NVMEZCVTBvc1YwRkJWQ3hEUVVGT096WkNRVU5oUnl4TFFVRkxSU3hKUVVGc1FqczdaMEpCUlVFN2RVSkJSVTlpTEVsQlFVbGpMRmxCUVZnN1lVRkdTaXhEUVVkRkxFOUJRVTlETEVWQlFWQXNSVUZCVnp0MVFrRkRSbUlzUzBGQlMwTXNVMEZCVEN4RFFVRmxPekJDUVVOYUxFbEJSRms3TmtKQlJWUXNTVUZHVXpzd1FrRkhXaXhEUVVoWk96WkNRVWxVU0N4SlFVRkpZenRwUWtGS1ZpeERRVUZRT3p0VFFYWkNVanRyUWtFclFsVXNTVUZCVmp0dlFrRkRXVEZDTEZOQlFWb3NSVUZCZFVKRkxFMUJRWFpDTEVWQlFTdENPM2RDUVVObUxFbEJSR1U3Y1VKQlJXeENVenRUUVVaaUxFVkJSMGRtTEZsQlNFZ3NSVUZIYVVKblF5eEpRVWhxUWl4RFFVZHpRaXhWUVVGRFF5eEpRVUZFTEVWQlFWVTdkVUpCUTJwQ2VrUXNSVUZCUlRCRUxFdEJRVVlzUTBGQlVXaERMRmxCUVZJc1JVRkJjMElyUWl4SlFVRjBRaXhEUVVGWU8zTkNRVU5WTEV0QlFWWTdZMEZEUlVVc1QwRkJSaXhEUVVGVmFrTXNXVUZCVmp0alFVTkZhME1zVFVGQlJqdFRRVkJLTEVWQlVVY3NWVUZCUTBNc1MwRkJSQ3hGUVVGWE8zTkNRVU5CTEV0QlFWWTdhMEpCUTAwc1EwRkJUanRqUVVORlF5eE5RVUZHTEVOQlFWTkVMRXRCUVZRN1kwRkRSVVFzVFVGQlJqdFRRVnBLTzJWQlkwOTJRaXhGUVVGRk1FSXNUMEZCVkR0TFFXaEVTanRSUVcxRVFVTXNXVUZCV1N4VFFVRmFRU3hUUVVGWkxFTkJRVU5vUkN4VlFVRkVMRVZCUVdkQ08yZENRVU5vUW1oQ0xFVkJRVVZ4UWl4TlFVRkdMRU5CUVZNN2JVSkJRMDVOTzFOQlJFZ3NSVUZGVEZnc1ZVRkdTeXhEUVVGU08yMUNRVWRYTEVWQlFWZzdZVUZEU3l4RFFVRk1PMlZCUTA5dlFpeFBRVUZRTzB0QmVrUktPMUZCTkVSQk5rSXNZVUZCWVN4VFFVRmlRU3hWUVVGaExFZEJRVTA3WlVGRFVERkRMRTFCUVUweVF5eFJRVUZPTEV0QlFXMUNia01zWTBGQk0wSTdTMEUzUkVvN1VVRm5SVUZ2UXl4WFFVRlhMRk5CUVZoQkxGRkJRVmNzUjBGQlRUdGhRVU5TY2tNc1UwRkJVeXhEUVVGa08yVkJRMDlOTEU5QlFWQTdTMEZzUlVvN08xZEJjVVZQTzI5Q1FVTlRWaXhWUVVSVU8yMUNRVVZSYzBNc1UwRkdVanR0UWtGSFVXNURMRk5CU0ZJN2EwSkJTVTl6UXl4UlFVcFFPMjlDUVV0VFJpeFZRVXhVTzJWQlRVazVRaXhMUVU1S08zTkNRVTlYU2p0TFFWQnNRanREUVdwR1NqczdRVU5GUVN4VFFVRlRjVU1zVTBGQlZDeEhRVUZ6UWp0UlFVTmtReXhaUVVGWkxFVkJRV2hDT3p0UlFVVk5ReXhSUVVGUk5VVXNSVUZCUlVRc1NVRkJSaXhGUVVGa08xRkJSVTA0UlN4alFVRmpMRk5CUVdSQkxGZEJRV01zUTBGQlEwTXNUVUZCUkN4RlFVRlRReXhQUVVGVUxFVkJRWEZDTzJWQlEzaENRU3hYUVVGWGVrVXNSVUZCUlZVc1ZVRkJSaXhEUVVGaEswUXNVVUZCVVVRc1RVRkJja0lzUTBGQldDeEhRVUV3UTNoRkxFVkJRVVV3UlN4UFFVRkdMRU5CUVZWRUxGRkJRVkZFTEUxQlFXeENMRVZCUVRCQ1FTeE5RVUV4UWl4RFFVRXhReXhIUVVFNFJVRXNUVUZCY2tZN1MwRklWanRSUVUxTlJ5eGhRVUZoTEZOQlFXSkJMRlZCUVdFc1EwRkJRME1zVDBGQlJDeEZRVUZoTzJWQlEyWXNWVUZCUTNCRExFZEJRVVFzUlVGQlV6dGpRVU5XY1VNc1NVRkJSaXhEUVVGUFJDeFBRVUZRTEVWQlFXZENMRlZCUVVOb1JpeExRVUZFTEVWQlFWRnJSaXhIUVVGU0xFVkJRV2RDTzI5Q1FVTjRRa01zWjBKQlFVb3NRMEZCY1VKRUxFZEJRWEpDTEVWQlFUQkNiRVlzUzBGQk1VSTdZVUZFU2p0dFFrRkhUelJETEVkQlFWQTdVMEZLU2p0TFFWQldPMUZCWlUxM1F5eHRRa0ZCYlVJc1UwRkJia0pCTEdkQ1FVRnRRaXhEUVVGRFNpeFBRVUZFTEVWQlFWVklMRTlCUVZZc1JVRkJjMEk3WlVGRE9VSjZSU3hGUVVGRmNVSXNUVUZCUml4RFFVRlRMRVZCUVZRc1JVRkJZVzlFTEU5QlFXSXNSVUZCYzBJN2IwSkJRMnBDUml4WlFVRlpTU3hYUVVGWFF5eFBRVUZZTEVOQlFWb3NSVUZCYVVOSUxFOUJRV3BETzFOQlJFd3NRMEZCVUR0TFFXaENWanRSUVhGQ1RWRXNaVUZCWlN4VFFVRm1RU3haUVVGbExFTkJRVU5ETEdWQlFVUXNSVUZCYTBKVUxFOUJRV3hDTEVWQlFXOUVPMWxCUVhwQ1ZTeFpRVUY1UWl4MVJVRkJWaXhMUVVGVk96dFpRVU42UkVNc1UwRkJVekZHTEVWQlFVVkVMRWxCUVVZc1EwRkJUekJHTEZsQlFWQXNRMEZCWmp0WlFVTk5PVU1zU1VGQlNUTkRMRVZCUVVVMFF5eFJRVUZHTEVWQlJGWTdaVUZGVHl0RExFbEJRVkFzUjBGQll5eFpRVUZOTzIxQ1FVTlVMRWxCUVZBN1kwRkRSWHBDTEUxQlFVWTdORUpCUTJkQ05VUXNSVUZCUlhGQ0xFMUJRVVlzUTBGQlV5eEZRVUZVTEVWQlFXRnZSQ3hQUVVGaUxFVkJRWE5DT3pSQ1FVTjBRanRoUVVSQkxFTkJRV2hDTEVWQlJVbHFRaXhKUVVaS0xFTkJSVk1zVlVGQlEwTXNTVUZCUkN4RlFVRlZPM1ZDUVVOU0xFdEJRVkE3YTBKQlEwVkZMRTlCUVVZc1EwRkJWVVlzU1VGQlZqdHJRa0ZEUlVjc1RVRkJSanRoUVV4S0xFVkJUVWNzVlVGQlEwTXNTMEZCUkN4RlFVRlhPM1ZDUVVOSUxFdEJRVkE3YTBKQlEwVkRMRTFCUVVZc1EwRkJVMFFzUzBGQlZEdHJRa0ZEUlVRc1RVRkJSanRoUVZSS08yMUNRVmRQZGtJc1JVRkJSVEJDTEU5QlFWUTdVMEZrU2p0bFFXZENUM0ZDTEUxQlFWQTdTMEY0UTFZN1VVRXlRMDFGTEhWQ1FVRjFRanRyUWtGRFZEdExRVFZEY0VJN08yTkJLME5WYUVJc1MwRkJWaXhIUVVGclFrRXNTMEZCYkVJN08yTkJSVlZwUWl4SlFVRldMRWRCUVdsQ0xGVkJRVU5ETEZOQlFVUXNSVUZCV1VNc2NVSkJRVm9zUlVGQmVVUTdXVUZCZEVKRExGbEJRWE5DTEhWRlFVRlFMRVZCUVU4N08ydENRVU0xUkVNc1QwRkJWaXhIUVVGdlFpeFZRVUZEYkVJc1QwRkJSQ3hGUVVGaE8yZENRVU4yUW0xQ0xHVkJRV1VzVTBGQlprRXNXVUZCWlN4RFFVRkRjRVFzUjBGQlJDeEZRVUZUTzI5Q1FVTjBRanN5UWtGRlQwRXNTVUZCU1dNc1dVRkJXRHRwUWtGR1NpeERRVWRGTEU5QlFVOURMRVZCUVZBc1JVRkJWenN5UWtGRFJtSXNTMEZCUzBNc1UwRkJUQ3hEUVVGbE96aENRVU5hTEVsQlJGazdhVU5CUlZRc1NVRkdVenM0UWtGSFdpeERRVWhaTzJsRFFVbFVTQ3hKUVVGSll6dHhRa0ZLVml4RFFVRlFPenRoUVV4U08yMUNRV0ZQTlVRc1JVRkJSV2xITEU5QlFVWXNRMEZEU0Znc2FVSkJRV2xDVlN4WlFVRnFRaXhGUVVOSk1VWXNSVUZCUlhGQ0xFMUJRVVlzUTBGQlV5eEZRVUZEZDBVc1UwRkJVMFFzV1VGQlZpeEZRVUZVTEVWQlFXdERia0lzVDBGQmJFTXNSVUZCTWtNN2NVSkJRMnhEWlN4WlFVRlpaaXhSUVVGUmNVSTdZVUZFTjBJc1EwRkVTaXhEUVVSSExFTkJRVkE3VTBGa1NqczdXVUYxUWsxRExEQkNRVUV3UW5KSExFVkJRVVZFTEVsQlFVWXNRMEZCVHl4TFFVRlFMRU5CUVdoRE8ydENRVU5WWjBNc1dVRkJWaXhIUVVGNVFpeFZRVUZEZFVVc2FVSkJRVVFzUlVGQmRVSTdaMEpCUTNSRE1VUXNWMEZCVnpCRUxIRkNRVUZ4UW5SSExFVkJRVVUwUXl4UlFVRkdMRVZCUVhSRE8yZENRVU5KWjBNc1QwRkJTaXhGUVVGaE8zbENRVU5CV0N4UFFVRlVMRU5CUVdsQ096SkNRVU5PVnp0cFFrRkVXRHRoUVVSS0xFMUJTVThzU1VGQlNTeERRVUZEZVVJc2VVSkJRVXdzUlVGQlowTTdkME5CUTFnc1NVRkJlRUk3TzJ0Q1FVVkZTaXhQUVVGR0xFTkJRVlV6Uml4RlFVRkZjVUlzVFVGQlJpeERRVUZUTEVWQlFWUXNSVUZCWVc5RkxIRkNRVUZpTEVOQlFWWXNSVUZCSzBOcVF5eEpRVUV2UXl4RFFVRnZSQ3hWUVVGRFF5eEpRVUZFTEVWQlFWVTdORU5CUTJ4RExFdEJRWGhDT3pCQ1FVTk5RU3hMUVVGTFlTeExRVUZZT3paQ1FVTlRXQ3hQUVVGVUxFTkJRV2xDT3l0Q1FVTk9WenR4UWtGRVdEdHBRa0ZJU2l4RlFVMUhNa0lzUzBGT1NDeERRVTFUTEZWQlFVTjRReXhKUVVGRUxFVkJRVlU3TkVOQlExTXNTMEZCZUVJN05rSkJRMU5MTEUxQlFWUXNRMEZCWjBKTUxFbEJRV2hDTzJsQ1FWSktPMkZCU0Vjc1RVRmhRVHN5UWtGRFVUc3lRa0ZCVFZrc1ZVRkJWVFZETEZsQlFWWXNRMEZCZFVKaExGRkJRWFpDTEVOQlFVNDdhVUpCUVZnc1JVRkJiVVFzUjBGQmJrUTdPMjFDUVVWSFFTeFRRVUZUZVVJc1QwRkJhRUk3VTBGMFFrbzdPMnRDUVhsQ1ZXMURMR2RDUVVGV0xFZEJRVFpDTEZWQlFVTjZRaXhQUVVGRUxFVkJRV0U3YlVKQlF5OUNTaXhWUVVGVk5VTXNXVUZCVml4SFFVRjVRaXRDTEVsQlFYcENMRU5CUTBnc1dVRkJUVHQxUWtGRFMyRXNWVUZCVlhOQ0xFOUJRVllzUTBGQmEwSllMR2xDUVVGcFFqdHhRMEZEY2tJc1dVRkJXVlk3YVVKQlJGSXNSVUZGZEVKSExFOUJSbk5DTEVOQlFXeENMRU5CUVZBN1lVRkdSQ3hGUVV0QkxGbEJRVTA3ZFVKQlEwVktMRlZCUVZWelFpeFBRVUZXTEVOQlFXdENiRUlzVDBGQmJFSXNRMEZCVUR0aFFVNUVMRU5CUVZBN1UwRkVTanM3YTBKQldWVlhMRTFCUVZZc1IwRkJiVUp3Uml4RlFVRkZiVWNzVDBGQlJpeERRVUZWYkVJc1dVRkJWaXhGUVVGM1Fsb3NWVUZCVlhOQ0xFOUJRV3hETEVOQlFXNUNPenRyUWtGRlZWTXNaVUZCVml4SFFVRTBRbkJITEVWQlFVVnRSeXhQUVVGR0xFTkJRVlZzUWl4WlFVRldMRVZCUVhkQ1dpeFZRVUZWTmtJc1owSkJRV3hETEVOQlFUVkNPenRyUWtGRlZUTkZMRXRCUVZZc1IwRkJhMElzVlVGQlF6aEZMRWxCUVVRc1JVRkJWVHRuUWtGRGJFSkRMRzlDUVVGdlFpeFRRVUZ3UWtFc2FVSkJRVzlDTEVOQlFVTjRSU3hKUVVGRUxFVkJRVTl2UXl4UlFVRlFMRVZCUVc5Q08yOUNRVU4wUXl4RFFVRkRRU3hSUVVGTUxFVkJRV1U3T3pzN2IwSkJTVlJ4UXl4VlFVRlZMRk5CUVZaQkxFOUJRVlVzUjBGQlRUdDNRa0ZEV214RUxFOUJRVThzUTBGQlEzWkNMRTlCUVU4c1EwRkJVaXhKUVVGaGIwTXNVVUZCTVVJN2QwSkJRMDFtTEV0QlFVdEZMRTlCUVU5aExGRkJRVkFzUjBGQmEwSXNRMEZFTjBJN01rSkJSVTlpTEU5QlFVOHNSMEZCVUN4SFFVRmhSaXhGUVVGd1FqdHBRa0ZJU2pzN2RVSkJUVTg3YTBOQlExY3NUMEZFV0RzMlFrRkZUVzlFTzJsQ1FVWmlPMkZCV0VvN1owSkJhVUpOY2tNc1YwRkJWM2hGTEVWQlFVVkVMRWxCUVVZc1EwRkJUeXhGUVVGUUxFTkJha0pxUWp0blFrRnRRazByUnl4alFVRmpPM0ZDUVVOTUxFMUJRVTFJTzJGQmNFSnlRanRuUWtGMVFrMUpMR0ZCUVdFc1UwRkJZa0VzVlVGQllTeERRVUZEYUVRc1NVRkJSQ3hGUVVGUE0wSXNTVUZCVUN4RlFVRmhiME1zVVVGQllpeEZRVUYxUWs4c1QwRkJka0lzUlVGQmFVUTdiMEpCUVdwQ1J5eFBRVUZwUWl4MVJVRkJVQ3hGUVVGUE96dHZRa0ZEY0VSd1JDeGxRVUZsZUVJc1JVRkJSWEZDTEUxQlFVWXNRMEZCVXl4RlFVRlVMRVZCUVdFN09FSkJRM0JDTzJsQ1FVUlBMRVZCUld4Q2RVUXNUMEZHYTBJc1JVRkZWREJDTEd0Q1FVRnJRbmhGTEVsQlFXeENMRVZCUVhkQ2IwTXNVVUZCZUVJc1EwRkdVeXhEUVVGeVFqdDFRa0ZIVDJNc2FVSkJRV2xDZUVRc1dVRkJha0lzUlVGQkswSjRRaXhGUVVGRmNVSXNUVUZCUml4RFFVRlRMRVZCUVZRc1JVRkJZVzlFTEU5QlFXSXNSVUZCYzBJclFpeFhRVUYwUWl4RlFVRnRRenMwUWtGRE4wUXNTMEZFTmtRN01FSkJSUzlFTDBNN2FVSkJSalJDTEVOQlFTOUNMRU5CUVZBN1lVRXpRbFk3WjBKQmFVTk5hVVFzWTBGQll5eFRRVUZrUVN4WFFVRmpMRU5CUVVNNVJTeFBRVUZFTEVWQlFWVTJReXhQUVVGV0xFVkJRWE5DTzNkQ1FVTjRRbkZDTEVkQlFWSXNTVUZCWlN4TlFVRk5jRWNzUlVGQlJXbElMRXRCUVVZc1EwRkJVVU1zWjBKQlFWSXNRMEZCZVVKb1JpeFBRVUY2UWl4RFFVRnlRanQxUWtGRFR6WkRMRTlCUVZBN1lVRnVRMVk3WjBKQmMwTk5RU3hWUVVGVkxHbENRVUZEUVN4UlFVRkVMRVZCUVdFN2RVSkJRMXBLTEZWQlFWVnpRaXhQUVVGV0xFTkJRV3RDTTBZc1JVRkJSWEZDTEUxQlFVWXNRMEZCVXl4RlFVRlVMRVZCUVdGdlJDeFJRVUZpTEVWQlFYTkNLMElzVjBGQmRFSXNSVUZCYlVNN05FSkJRMmhFTzJsQ1FVUmhMRU5CUVd4Q0xFTkJRVkE3WVVGMlExWTdaMEpCTkVOTlN5eGpRVUZqTEZOQlFXUkJMRmRCUVdNc1EwRkJRM1pJTEZWQlFVUXNSVUZCWVcxR0xFOUJRV0lzUlVGQmRVTTdiMEpCUVdwQ1J5eFBRVUZwUWl4MVJVRkJVQ3hGUVVGUE96dHZRa0ZETTBOd1JDeGxRVUZsZUVJc1JVRkJSWEZDTEUxQlFVWXNRMEZCVXl4RlFVRlVMRVZCUVdGcFJTeHZRa0ZCWWl4RlFVRnRRMVlzVDBGQmJrTXNRMEZCY2tJN2RVSkJRMDlKTEdsQ1FVTkllRVFzV1VGRVJ5eEZRVVZJZUVJc1JVRkJSWEZDTEUxQlFVWXNRMEZCVXl4RlFVRlVMRVZCUTFOdlJDeFBRVVJVTEVWQlJWTXJRaXhYUVVaVUxFVkJSWE5DT3pSQ1FVTkVMRTFCUkVNN01FSkJSVWhzU0R0cFFrRktia0lzUTBGR1J5eERRVUZRTzJGQk9VTldPMmRDUVRCRVRYZElMR2RDUVVGblFpeFRRVUZvUWtFc1lVRkJaMElzUTBGQlEyeEdMRTlCUVVRc1JVRkJWVFpETEU5QlFWWXNSVUZCYjBNN2IwSkJRV3BDUnl4UFFVRnBRaXgxUlVGQlVDeEZRVUZQT3p0dlFrRkRNVU53UkN4bFFVRmxlRUlzUlVGQlJYRkNMRTFCUVVZc1EwRkJVeXhGUVVGVUxFVkJRV0ZwUlN4dlFrRkJZaXhGUVVGdFExWXNUMEZCYmtNc1EwRkJja0k3ZFVKQlEwODRRaXhaUVVGWk9VVXNUMEZCV2l4RlFVRnhRbTlFTEdsQ1FVRnBRbmhFTEZsQlFXcENMRVZCUVN0Q2VFSXNSVUZCUlhGQ0xFMUJRVVlzUTBGQlV5eEZRVUZVTEVWQlFXRnZSQ3hQUVVGaUxFVkJRWE5DSzBJc1YwRkJkRUlzUlVGQmJVTTdORUpCUTJ4R08ybENRVVFyUXl4RFFVRXZRaXhEUVVGeVFpeERRVUZRTzJGQk5VUldPMmRDUVdsRlRVOHNaVUZCWlN4VFFVRm1RU3haUVVGbExFTkJRVU51Uml4UFFVRkVMRVZCUVZWMFF5eFZRVUZXTEVWQlFYTkNiVVlzVDBGQmRFSXNSVUZCWjBRN2IwSkJRV3BDUnl4UFFVRnBRaXgxUlVGQlVDeEZRVUZQT3p0dlFrRkRja1J3UkN4bFFVRmxlRUlzUlVGQlJYRkNMRTFCUVVZc1EwRkJVeXhGUVVGVUxFVkJRV0ZwUlN4dlFrRkJZaXhGUVVGdFExWXNUMEZCYmtNc1EwRkJja0k3ZFVKQlEwODRRaXhaUVVOSU9VVXNUMEZFUnl4RlFVVkliMFFzYVVKQlEwbDRSQ3haUVVSS0xFVkJSVWw0UWl4RlFVRkZjVUlzVFVGQlJpeERRVUZUTEVWQlFWUXNSVUZEVTI5RUxFOUJSRlFzUlVGRlV5dENMRmRCUmxRc1JVRkZjMEk3TkVKQlEwUXNUMEZFUXpzd1FrRkZTR3hJTzJsQ1FVcHVRaXhEUVVaS0xFTkJSa2NzUTBGQlVEdGhRVzVGVmp0blFrRnJSazB3U0N4cFFrRkJhVUlzVTBGQmFrSkJMR05CUVdsQ0xFTkJRVU4yUkN4SlFVRkVMRVZCUVU4elFpeEpRVUZRTEVWQlFXRXlReXhQUVVGaUxFVkJRWFZETzI5Q1FVRnFRa2NzVDBGQmFVSXNkVVZCUVZBc1JVRkJUenM3ZFVKQlF6ZEROa0lzVjBGQlYyaEVMRWxCUVZnc1JVRkJhMEl6UWl4UlFVRlJMRU5CUVRGQ0xFVkJRVGhDYjBNc1ZVRkJPVUlzUlVGQk1FTlBMRTlCUVRGRExFVkJRVzFFUnl4UFFVRnVSQ3hEUVVGUU8yRkJia1pXTzJkQ1FYTkdUWEZETEdkQ1FVRm5RaXhUUVVGb1FrRXNZVUZCWjBJc1EwRkJRM2hFTEVsQlFVUXNSVUZCVDJkQ0xFOUJRVkFzUlVGQmFVTTdiMEpCUVdwQ1J5eFBRVUZwUWl4MVJVRkJVQ3hGUVVGUE96dDFRa0ZEZEVNMlFpeFhRVUZYYUVRc1NVRkJXQ3hGUVVGcFFpeERRVUZxUWl4RlFVRnZRaXhEUVVGd1FpeEZRVUYxUW1kQ0xFOUJRWFpDTEVWQlFXZERSeXhQUVVGb1F5eERRVUZRTzJGQmRrWldPenR0UWtFd1JrODdNRUpCUTA5V0xGRkJSRkE3WjBOQlJXRTRReXhqUVVaaU95dENRVWRaUXl4aFFVaGFPemhDUVVsWFJpeFpRVXBZT3paQ1FVdFZSaXhYUVV4V095dENRVTFaUXl4aFFVNWFPM2xDUVU5Tk9VY3NSVUZCUlRCRkxFOUJRVVlzUTBGQlZVd3NWVUZCVlhOQ0xFOUJRWEJDTEVWQlFUWkNjVUlzWTBGQk4wSXNRMEZRVGp0M1FrRlJTMmhJTEVWQlFVVXdSU3hQUVVGR0xFTkJRVlZNTEZWQlFWVnpRaXhQUVVGd1FpeEZRVUUyUW5OQ0xHRkJRVGRDTEVOQlVrdzdkVUpCVTBscVNDeEZRVUZGTUVVc1QwRkJSaXhEUVVGVlRDeFZRVUZWYzBJc1QwRkJjRUlzUlVGQk5rSnZRaXhaUVVFM1FpeERRVlJLTzNOQ1FWVkhMMGNzUlVGQlJUQkZMRTlCUVVZc1EwRkJWVXdzVlVGQlZYTkNMRTlCUVhCQ0xFVkJRVFpDYTBJc1YwRkJOMElzUTBGV1NEc3JRa0ZYV1RkSExFVkJRVVV3UlN4UFFVRkdMRU5CUVZWTUxGVkJRVlZ6UWl4UFFVRndRaXhGUVVFMlFtMUNMR0ZCUVRkQ0xFTkJXRm83YTBOQldXVTVSeXhGUVVGRk1FVXNUMEZCUml4RFFVRlZUQ3hWUVVGVk5rSXNaMEpCUVhCQ0xFVkJRWE5EWXl4alFVRjBReXhEUVZwbU8ybERRV0ZqYUVnc1JVRkJSVEJGTEU5QlFVWXNRMEZCVlV3c1ZVRkJWVFpDTEdkQ1FVRndRaXhGUVVGelEyVXNZVUZCZEVNc1EwRmlaRHRuUTBGallXcElMRVZCUVVVd1JTeFBRVUZHTEVOQlFWVk1MRlZCUVZVMlFpeG5Ra0ZCY0VJc1JVRkJjME5oTEZsQlFYUkRMRU5CWkdJN0swSkJaVmt2Unl4RlFVRkZNRVVzVDBGQlJpeERRVUZWVEN4VlFVRlZOa0lzWjBKQlFYQkNMRVZCUVhORFZ5eFhRVUYwUXl4RFFXWmFPMmxEUVdkQ1l6ZEhMRVZCUVVVd1JTeFBRVUZHTEVOQlFWVk1MRlZCUVZVMlFpeG5Ra0ZCY0VJc1JVRkJjME5aTEdGQlFYUkRMRU5CYUVKa08zbENRV2xDVFhKRE8yRkJha0ppTzFOQk0wWktPenRsUVdkSVQwb3NVMEZCVUR0TFFXeE1TanM3WTBGeFRGVm9SaXhUUVVGV0xFZEJRWE5DUVN4VFFVRjBRanRqUVVOVmFVTXNXVUZCVml4SFFVRjVRa0VzV1VGQmVrSTdPMWRCUlU4clF5eFRRVUZRT3pzN096czdPenM3SW4wPSJ9
