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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjLyoqLyouanMiLCJzb3VyY2VzIjpbInNyYy92bXMvZmlsdGVyc1ZNLmpzIiwic3JjL3Ztcy9wYWdpbmF0aW9uVk0uanMiLCJzcmMvcG9zdGdyZXN0LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBtIGZyb20gJ21pdGhyaWwnO1xuaW1wb3J0IF8gZnJvbSAndW5kZXJzY29yZSc7XG5cbmNvbnN0IGZpbHRlcnNWTSA9IChhdHRyaWJ1dGVzKSA9PiB7XG4gICAgbGV0IG5ld1ZNID0ge30sXG4gICAgICAgIGZpbHRlciA9ICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHByb3AgPSBtLnByb3AoJycpLFxuICAgICAgICAgICAgICAgIGZpbHRlclByb3AgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wKHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXdWTTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcHJvcCgpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAvLyBKdXN0IHNvIHdlIGNhbiBoYXZlIGEgZGVmYXVsdCB0b19maWx0ZXIgYW5kIGF2b2lkIGlmIF8uaXNGdW5jdGlvbiBjYWxsc1xuICAgICAgICAgICAgZmlsdGVyUHJvcC50b0ZpbHRlciA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gXy5pc1N0cmluZyhmaWx0ZXJQcm9wKCkpID8gZmlsdGVyUHJvcCgpLnRyaW0oKSA6IGZpbHRlclByb3AoKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXR1cm4gZmlsdGVyUHJvcDtcbiAgICAgICAgfSxcblxuICAgICAgICBnZXR0ZXJzID0gXy5yZWR1Y2UoXG4gICAgICAgICAgICBhdHRyaWJ1dGVzLCAobWVtbywgb3BlcmF0b3IsIGF0dHIpID0+IHtcbiAgICAgICAgICAgICAgICAvLyBUaGUgb3BlcmF0b3IgYmV0d2VlbiBpcyBpbXBsZW1lbnRlZCB3aXRoIHR3byBwcm9wZXJ0aWVzLCBvbmUgZm9yIGdyZWF0ZXIgdGhhbiB2YWx1ZSBhbmQgYW5vdGhlciBmb3IgbGVzc2VyIHRoYW4gdmFsdWUuXG4gICAgICAgICAgICAgICAgLy8gQm90aCBwcm9wZXJ0aWVzIGFyZSBzZW50IGluIHRoZSBxdWV1cnlzdHJpbmcgd2l0aCB0aGUgc2FtZSBuYW1lLFxuICAgICAgICAgICAgICAgIC8vIHRoYXQncyB3aHkgd2UgbmVlZCB0aGUgc3BlY2lhbCBjYXNlIGhlcmUsIHNvIHdlIGNhbiB1c2UgYSBzaW1wbGUgbWFwIGFzIGFyZ3VtZW50IHRvIGZpbHRlcnNWTS5cbiAgICAgICAgICAgICAgICBpZiAob3BlcmF0b3IgPT09ICdiZXR3ZWVuJykge1xuICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbHRlOiBmaWx0ZXIoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGd0ZTogZmlsdGVyKClcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gZmlsdGVyKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICAgIG9yZGVyOiBmaWx0ZXIoKVxuICAgICAgICAgICAgfVxuICAgICAgICApLFxuXG4gICAgICAgIHBhcmFtZXRlcnNXaXRob3V0T3JkZXIgPSAoKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gXy5yZWR1Y2UoXG4gICAgICAgICAgICAgICAgZ2V0dGVycywgKG1lbW8sIGdldHRlciwgYXR0cikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXR0ciAhPT0gJ29yZGVyJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3BlcmF0b3IgPSBhdHRyaWJ1dGVzW2F0dHJdO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoXy5pc0Z1bmN0aW9uKGdldHRlci50b0ZpbHRlcikgJiYgKGdldHRlci50b0ZpbHRlcigpID09PSB1bmRlZmluZWQgfHwgZ2V0dGVyLnRvRmlsdGVyKCkgPT09ICcnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBCZWxsb3cgd2UgdXNlIGRpZmZlcmVudCBmb3JtYXR0aW5nIHJ1bGVzIGZvciB0aGUgdmFsdWUgZGVwZW5kaW5nIG9uIHRoZSBvcGVyYXRvclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVGhlc2UgcnVsZXMgYXJlIHVzZWQgcmVnYXJkbGVzcyBvZiB0aGUgdG9GaWx0ZXIgZnVuY3Rpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBzbyB0aGUgdXNlciBjYW4gdXNlIGEgY3VzdG9tIHRvRmlsdGVyIHdpdGhvdXQgaGF2aW5nIHRvIHdvcnJ5IHdpdGggYmFzaWMgZmlsdGVyIHN5bnRheFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9wZXJhdG9yID09PSAnaWxpa2UnIHx8IG9wZXJhdG9yID09PSAnbGlrZScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gb3BlcmF0b3IgKyAnLionICsgZ2V0dGVyLnRvRmlsdGVyKCkgKyAnKic7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG9wZXJhdG9yID09PSAnQEAnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IG9wZXJhdG9yICsgJy4nICsgZ2V0dGVyLnRvRmlsdGVyKCkucmVwbGFjZSgvXFxzKy9nLCAnJicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChvcGVyYXRvciA9PT0gJ2JldHdlZW4nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFnZXR0ZXIubHRlLnRvRmlsdGVyKCkgJiYgIWdldHRlci5ndGUudG9GaWx0ZXIoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChnZXR0ZXIuZ3RlKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXS5wdXNoKCdndGUuJyArIGdldHRlci5ndGUudG9GaWx0ZXIoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChnZXR0ZXIubHRlKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXS5wdXNoKCdsdGUuJyArIGdldHRlci5sdGUudG9GaWx0ZXIoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChvcGVyYXRvciA9PT0gJ2lzLm51bGwnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IGdldHRlci50b0ZpbHRlcigpID09PSBudWxsID8gJ2lzLm51bGwnIDogJ25vdC5pcy5udWxsJztcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IG9wZXJhdG9yICsgJy4nICsgZ2V0dGVyLnRvRmlsdGVyKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgICAgICAgICAgfSwge31cbiAgICAgICAgICAgICk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgcGFyYW1ldGVycyA9ICgpID0+IHtcbiAgICAgICAgICAgIC8vIFRoZSBvcmRlciBwYXJhbWV0ZXJzIGhhdmUgYSBzcGVjaWFsIHN5bnRheCAoanVzdCBsaWtlIGFuIG9yZGVyIGJ5IFNRTCBjbGF1c2UpXG4gICAgICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vYmVncmlmZnMvcG9zdGdyZXN0L3dpa2kvUm91dGluZyNmaWx0ZXJpbmctYW5kLW9yZGVyaW5nXG4gICAgICAgICAgICBjb25zdCBvcmRlciA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZ2V0dGVycy5vcmRlcigpICYmIF8ucmVkdWNlKFxuICAgICAgICAgICAgICAgICAgICBnZXR0ZXJzLm9yZGVyKCksIChtZW1vLCBkaXJlY3Rpb24sIGF0dHIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lbW8ucHVzaChhdHRyICsgJy4nICsgZGlyZWN0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgICAgICAgICB9LCBbXVxuICAgICAgICAgICAgICAgICkuam9pbignLCcpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgIG9yZGVyUGFyYW1ldGVyID0gb3JkZXIoKSA/IHtcbiAgICAgICAgICAgICAgICAgICAgb3JkZXI6IG9yZGVyKClcbiAgICAgICAgICAgICAgICB9IDoge307XG5cbiAgICAgICAgICAgIHJldHVybiBfLmV4dGVuZCh7fSwgb3JkZXJQYXJhbWV0ZXIsIHBhcmFtZXRlcnNXaXRob3V0T3JkZXIoKSk7XG5cbiAgICAgICAgfTtcblxuICAgIHJldHVybiBfLmV4dGVuZChuZXdWTSwgZ2V0dGVycywge1xuICAgICAgICBwYXJhbWV0ZXJzOiBwYXJhbWV0ZXJzLFxuICAgICAgICBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyOiBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyXG4gICAgfSk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBmaWx0ZXJzVk07XG4iLCJpbXBvcnQgbSBmcm9tICdtaXRocmlsJztcbmltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuXG5jb25zdCBwYWdpbmF0aW9uVk0gPSAobW9kZWwsIG9yZGVyLCBleHRyYUhlYWRlcnMgPSB7fSwgYXV0aGVudGljYXRlID0gdHJ1ZSkgPT4ge1xuICAgIGxldCBjb2xsZWN0aW9uID0gbS5wcm9wKFtdKSxcbiAgICAgICAgZGVmYXVsdE9yZGVyID0gb3JkZXIgfHwgJ2lkLmRlc2MnLFxuICAgICAgICBmaWx0ZXJzID0gbS5wcm9wKHtcbiAgICAgICAgICAgIG9yZGVyOiBkZWZhdWx0T3JkZXJcbiAgICAgICAgfSksXG4gICAgICAgIGlzTG9hZGluZyA9IG0ucHJvcChmYWxzZSksXG4gICAgICAgIHBhZ2UgPSBtLnByb3AoMSksXG4gICAgICAgIHJlc3VsdHNDb3VudCA9IG0ucHJvcCgpLFxuICAgICAgICBwYWdlUmVxdWVzdCA9IGF1dGhlbnRpY2F0ZSA/IG1vZGVsLmdldFBhZ2VXaXRoVG9rZW4gOiBtb2RlbC5nZXRQYWdlLFxuICAgICAgICB0b3RhbCA9IG0ucHJvcCgpO1xuXG4gICAgY29uc3QgZmV0Y2ggPSAoKSA9PiB7XG4gICAgICAgIGxldCBkID0gbS5kZWZlcnJlZCgpO1xuICAgICAgICBjb25zdCBnZXRUb3RhbCA9ICh4aHIpID0+IHtcbiAgICAgICAgICAgIGlmICgheGhyIHx8IHhoci5zdGF0dXMgPT09IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICBoaW50OiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBkZXRhaWxzOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBjb2RlOiAwLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnQ29ubmVjdGlvbiBlcnJvcidcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCByYW5nZUhlYWRlciA9IHhoci5nZXRSZXNwb25zZUhlYWRlcignQ29udGVudC1SYW5nZScpO1xuICAgICAgICAgICAgaWYgKF8uaXNTdHJpbmcocmFuZ2VIZWFkZXIpKSB7XG4gICAgICAgICAgICAgICAgbGV0IFtoZWFkZXJTaXplLCBoZWFkZXJDb3VudF0gPSByYW5nZUhlYWRlci5zcGxpdCgnLycpLFxuICAgICAgICAgICAgICAgICAgICBbaGVhZGVyRnJvbSwgaGVhZGVyVG9dID0gaGVhZGVyU2l6ZS5zcGxpdCgnLScpLFxuICAgICAgICAgICAgICAgICAgICB0byA9IHBhcnNlSW50KGhlYWRlclRvKSArIDEgfHwgMCxcbiAgICAgICAgICAgICAgICAgICAgZnJvbSA9IHBhcnNlSW50KGhlYWRlckZyb20pICB8fCAwO1xuXG4gICAgICAgICAgICAgICAgdG90YWwocGFyc2VJbnQoaGVhZGVyQ291bnQpKTtcbiAgICAgICAgICAgICAgICByZXN1bHRzQ291bnQodG8gLSBmcm9tKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgSlNPTi5wYXJzZSh4aHIucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICByZXR1cm4geGhyLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgaGludDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgZGV0YWlsczogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgY29kZTogMCxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogeGhyLnJlc3BvbnNlVGV4dFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBpc0xvYWRpbmcodHJ1ZSk7XG4gICAgICAgIHBhZ2VSZXF1ZXN0KGZpbHRlcnMoKSwgcGFnZSgpLCB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cnVlLFxuICAgICAgICAgICAgZXh0cmFjdDogZ2V0VG90YWxcbiAgICAgICAgfSwgZXh0cmFIZWFkZXJzKS50aGVuKChkYXRhKSA9PiB7XG4gICAgICAgICAgICBjb2xsZWN0aW9uKF8udW5pb24oY29sbGVjdGlvbigpLCBkYXRhKSk7XG4gICAgICAgICAgICBpc0xvYWRpbmcoZmFsc2UpO1xuICAgICAgICAgICAgZC5yZXNvbHZlKGNvbGxlY3Rpb24oKSk7XG4gICAgICAgICAgICBtLnJlZHJhdygpO1xuICAgICAgICB9LCAoZXJyb3IpID0+IHtcbiAgICAgICAgICAgIGlzTG9hZGluZyhmYWxzZSk7XG4gICAgICAgICAgICB0b3RhbCgwKTtcbiAgICAgICAgICAgIGQucmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgIG0ucmVkcmF3KCk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZC5wcm9taXNlO1xuICAgIH0sXG5cbiAgICBmaXJzdFBhZ2UgPSAocGFyYW1ldGVycykgPT4ge1xuICAgICAgICBmaWx0ZXJzKF8uZXh0ZW5kKHtcbiAgICAgICAgICAgIG9yZGVyOiBkZWZhdWx0T3JkZXJcbiAgICAgICAgfSwgcGFyYW1ldGVycykpO1xuICAgICAgICBjb2xsZWN0aW9uKFtdKTtcbiAgICAgICAgcGFnZSgxKTtcbiAgICAgICAgcmV0dXJuIGZldGNoKCk7XG4gICAgfSxcblxuICAgIGlzTGFzdFBhZ2UgPSAoKSA9PiB7XG4gICAgICAgIHJldHVybiAobW9kZWwucGFnZVNpemUoKSA+IHJlc3VsdHNDb3VudCgpKTtcbiAgICB9LFxuXG4gICAgbmV4dFBhZ2UgPSAoKSA9PiB7XG4gICAgICAgIHBhZ2UocGFnZSgpICsgMSk7XG4gICAgICAgIHJldHVybiBmZXRjaCgpO1xuICAgIH07XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uLFxuICAgICAgICBmaXJzdFBhZ2U6IGZpcnN0UGFnZSxcbiAgICAgICAgaXNMb2FkaW5nOiBpc0xvYWRpbmcsXG4gICAgICAgIG5leHRQYWdlOiBuZXh0UGFnZSxcbiAgICAgICAgaXNMYXN0UGFnZTogaXNMYXN0UGFnZSxcbiAgICAgICAgdG90YWw6IHRvdGFsLFxuICAgICAgICByZXN1bHRzQ291bnQ6IHJlc3VsdHNDb3VudFxuICAgIH07XG59O1xuXG5leHBvcnQgZGVmYXVsdCBwYWdpbmF0aW9uVk07XG4iLCJpbXBvcnQgbSBmcm9tICdtaXRocmlsJztcbmltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuaW1wb3J0IGZpbHRlcnNWTSBmcm9tICcuL3Ztcy9maWx0ZXJzVk0nO1xuaW1wb3J0IHBhZ2luYXRpb25WTSBmcm9tICcuL3Ztcy9wYWdpbmF0aW9uVk0nO1xuXG5mdW5jdGlvbiBQb3N0Z3Jlc3QgKCkge1xuICAgIGxldCBwb3N0Z3Jlc3QgPSB7fTtcblxuICAgIGNvbnN0IHRva2VuID0gbS5wcm9wKCksXG5cbiAgICAgICAgICBtZXJnZUNvbmZpZyA9IChjb25maWcsIG9wdGlvbnMpID0+IHtcbiAgICAgICAgICAgICAgcmV0dXJuIG9wdGlvbnMgJiYgXy5pc0Z1bmN0aW9uKG9wdGlvbnMuY29uZmlnKSA/IF8uY29tcG9zZShvcHRpb25zLmNvbmZpZywgY29uZmlnKSA6IGNvbmZpZztcbiAgICAgICAgICB9LFxuXG4gICAgICAgICAgYWRkSGVhZGVycyA9IChoZWFkZXJzKSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiAoeGhyKSA9PiB7XG4gICAgICAgICAgICAgICAgICBfLmVhY2goaGVhZGVycywgKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihrZXksIHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHhocjtcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICB9LFxuXG4gICAgICAgICAgYWRkQ29uZmlnSGVhZGVycyA9IChoZWFkZXJzLCBvcHRpb25zKSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiBfLmV4dGVuZCh7fSwgb3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgY29uZmlnOiBtZXJnZUNvbmZpZyhhZGRIZWFkZXJzKGhlYWRlcnMpLCBvcHRpb25zKVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICB9LFxuXG4gICAgICAgICAgY3JlYXRlTG9hZGVyID0gKHJlcXVlc3RGdW5jdGlvbiwgb3B0aW9ucywgZGVmYXVsdFN0YXRlID0gZmFsc2UpID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgbG9hZGVyID0gbS5wcm9wKGRlZmF1bHRTdGF0ZSksXG4gICAgICAgICAgICAgICAgICAgIGQgPSBtLmRlZmVycmVkKCk7XG4gICAgICAgICAgICAgIGxvYWRlci5sb2FkID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgbG9hZGVyKHRydWUpO1xuICAgICAgICAgICAgICAgICAgbS5yZWRyYXcoKTtcbiAgICAgICAgICAgICAgICAgIHJlcXVlc3RGdW5jdGlvbihfLmV4dGVuZCh7fSwgb3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6IHRydWVcbiAgICAgICAgICAgICAgICAgIH0pKS50aGVuKChkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgbG9hZGVyKGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgICBkLnJlc29sdmUoZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgbS5yZWRyYXcoKTtcbiAgICAgICAgICAgICAgICAgIH0sIChlcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIGxvYWRlcihmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgIG0ucmVkcmF3KCk7XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBkLnByb21pc2U7XG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgIHJldHVybiBsb2FkZXI7XG4gICAgICAgICAgfSxcblxuICAgICAgICAgIHJlcHJlc2VudGF0aW9uSGVhZGVyID0ge1xuICAgICAgICAgICAgICAnUHJlZmVyJzogJ3JldHVybj1yZXByZXNlbnRhdGlvbidcbiAgICAgICAgICB9O1xuXG4gICAgcG9zdGdyZXN0LnRva2VuID0gdG9rZW47XG5cbiAgICBwb3N0Z3Jlc3QuaW5pdCA9IChhcGlQcmVmaXgsIGF1dGhlbnRpY2F0aW9uT3B0aW9ucywgZ2xvYmFsSGVhZGVyID0ge30pID0+IHtcbiAgICAgICAgcG9zdGdyZXN0LnJlcXVlc3QgPSAob3B0aW9ucykgPT4ge1xuICAgICAgICAgICAgY29uc3QgZXJyb3JIYW5kbGVyID0gKHhocikgPT4ge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIEpTT04ucGFyc2UoeGhyLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB4aHIucmVzcG9uc2VUZXh0O1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBoaW50OiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGV0YWlsczogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGU6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiB4aHIucmVzcG9uc2VUZXh0XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXR1cm4gbS5yZXF1ZXN0KFxuICAgICAgICAgICAgICAgIGFkZENvbmZpZ0hlYWRlcnMoZ2xvYmFsSGVhZGVyLFxuICAgICAgICAgICAgICAgICAgICBfLmV4dGVuZCh7ZXh0cmFjdDogZXJyb3JIYW5kbGVyfSwgb3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICAgICAgdXJsOiBhcGlQcmVmaXggKyBvcHRpb25zLnVybFxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICk7XG4gICAgICAgIH07XG5cbiAgICAgICAgcG9zdGdyZXN0LmF1dGhlbnRpY2F0ZSA9ICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGRlZmVycmVkID0gbS5kZWZlcnJlZCgpO1xuICAgICAgICAgICAgaWYgKHRva2VuKCkpIHtcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHtcbiAgICAgICAgICAgICAgICAgICAgdG9rZW46IHRva2VuKClcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbS5yZXF1ZXN0KF8uZXh0ZW5kKHt9LCBhdXRoZW50aWNhdGlvbk9wdGlvbnMpKS50aGVuKChkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRva2VuKGRhdGEudG9rZW4pO1xuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRva2VuOiB0b2tlbigpXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0sIChkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChkYXRhKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgICAgICB9O1xuXG4gICAgICAgIHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuID0gKG9wdGlvbnMpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBwb3N0Z3Jlc3QuYXV0aGVudGljYXRlKCkudGhlbihcbiAgICAgICAgICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwb3N0Z3Jlc3QucmVxdWVzdChhZGRDb25maWdIZWFkZXJzKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICdBdXRob3JpemF0aW9uJzogJ0JlYXJlciAnICsgdG9rZW4oKVxuICAgICAgICAgICAgICAgICAgICB9LCBvcHRpb25zKSk7XG4gICAgICAgICAgICAgICAgfSwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcG9zdGdyZXN0LnJlcXVlc3Qob3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfTtcblxuICAgICAgICBwb3N0Z3Jlc3QubG9hZGVyID0gXy5wYXJ0aWFsKGNyZWF0ZUxvYWRlciwgcG9zdGdyZXN0LnJlcXVlc3QpO1xuICAgICAgICBcbiAgICAgICAgcG9zdGdyZXN0LmxvYWRlcldpdGhUb2tlbiA9IF8ucGFydGlhbChjcmVhdGVMb2FkZXIsIHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuKTtcblxuICAgICAgICBwb3N0Z3Jlc3QubW9kZWwgPSAobmFtZSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgcGFnaW5hdGlvbkhlYWRlcnMgPSAocGFnZSwgcGFnZVNpemUpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIXBhZ2VTaXplKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCB0b1JhbmdlID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmcm9tID0gKHBhZ2UgLSAxKSAqIHBhZ2VTaXplLFxuICAgICAgICAgICAgICAgICAgICAgICAgICB0byA9IGZyb20gKyBwYWdlU2l6ZSAtIDE7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmcm9tICsgJy0nICsgdG87XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICdSYW5nZS11bml0JzogJ2l0ZW1zJyxcbiAgICAgICAgICAgICAgICAgICAgJ1JhbmdlJzogdG9SYW5nZSgpXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgIHBhZ2VTaXplID0gbS5wcm9wKDEwKSxcblxuICAgICAgICAgICAgICAgICAgbmFtZU9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgdXJsOiAnLycgKyBuYW1lXG4gICAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgICBnZXRPcHRpb25zID0gKGRhdGEsIHBhZ2UsIHBhZ2VTaXplLCBvcHRpb25zLCBoZWFkZXJzID0ge30pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBleHRyYUhlYWRlcnMgPSBfLmV4dGVuZCh7fSwge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAnUHJlZmVyJzogJ2NvdW50PW5vbmUnXG4gICAgICAgICAgICAgICAgICAgICAgfSwgaGVhZGVycywgcGFnaW5hdGlvbkhlYWRlcnMocGFnZSwgcGFnZVNpemUpKTtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWRkQ29uZmlnSGVhZGVycyhleHRyYUhlYWRlcnMsIF8uZXh0ZW5kKHt9LCBvcHRpb25zLCBuYW1lT3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiBkYXRhXG4gICAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgcXVlcnlzdHJpbmcgPSAoZmlsdGVycywgb3B0aW9ucykgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMudXJsICs9ICc/JyArIG0ucm91dGUuYnVpbGRRdWVyeVN0cmluZyhmaWx0ZXJzKTtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gb3B0aW9ucztcbiAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgIG9wdGlvbnMgPSAob3B0aW9ucykgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwb3N0Z3Jlc3QucmVxdWVzdChfLmV4dGVuZCh7fSwgb3B0aW9ucywgbmFtZU9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnT1BUSU9OUydcbiAgICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgICBwb3N0T3B0aW9ucyA9IChhdHRyaWJ1dGVzLCBvcHRpb25zLCBoZWFkZXJzID0ge30pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBleHRyYUhlYWRlcnMgPSBfLmV4dGVuZCh7fSwgcmVwcmVzZW50YXRpb25IZWFkZXIsIGhlYWRlcnMpO1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBhZGRDb25maWdIZWFkZXJzKFxuICAgICAgICAgICAgICAgICAgICAgICAgICBleHRyYUhlYWRlcnMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIF8uZXh0ZW5kKHt9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lT3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiBhdHRyaWJ1dGVzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgIGRlbGV0ZU9wdGlvbnMgPSAoZmlsdGVycywgb3B0aW9ucywgaGVhZGVycyA9IHt9KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgZXh0cmFIZWFkZXJzID0gXy5leHRlbmQoe30sIHJlcHJlc2VudGF0aW9uSGVhZGVyLCBoZWFkZXJzKTtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcXVlcnlzdHJpbmcoZmlsdGVycywgYWRkQ29uZmlnSGVhZGVycyhleHRyYUhlYWRlcnMsIF8uZXh0ZW5kKHt9LCBvcHRpb25zLCBuYW1lT3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdERUxFVEUnXG4gICAgICAgICAgICAgICAgICAgICAgfSkpKTtcbiAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgIHBhdGNoT3B0aW9ucyA9IChmaWx0ZXJzLCBhdHRyaWJ1dGVzLCBvcHRpb25zLCBoZWFkZXJzID0ge30pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBleHRyYUhlYWRlcnMgPSBfLmV4dGVuZCh7fSwgcmVwcmVzZW50YXRpb25IZWFkZXIsIGhlYWRlcnMpO1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBxdWVyeXN0cmluZyhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsdGVycyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkQ29uZmlnSGVhZGVycyhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4dHJhSGVhZGVycyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF8uZXh0ZW5kKHt9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWVPcHRpb25zLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnUEFUQ0gnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IGF0dHJpYnV0ZXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgIGdldFBhZ2VPcHRpb25zID0gKGRhdGEsIHBhZ2UsIG9wdGlvbnMsIGhlYWRlcnMgPSB7fSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBnZXRPcHRpb25zKGRhdGEsIChwYWdlIHx8IDEpLCBwYWdlU2l6ZSgpLCBvcHRpb25zLCBoZWFkZXJzKTtcbiAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgIGdldFJvd09wdGlvbnMgPSAoZGF0YSwgb3B0aW9ucywgaGVhZGVycyA9IHt9KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGdldE9wdGlvbnMoZGF0YSwgMSwgMSwgb3B0aW9ucywgaGVhZGVycyk7XG4gICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHBhZ2VTaXplOiBwYWdlU2l6ZSxcbiAgICAgICAgICAgICAgICBnZXRQYWdlT3B0aW9uczogZ2V0UGFnZU9wdGlvbnMsXG4gICAgICAgICAgICAgICAgZ2V0Um93T3B0aW9uczogZ2V0Um93T3B0aW9ucyxcbiAgICAgICAgICAgICAgICBwYXRjaE9wdGlvbnM6IHBhdGNoT3B0aW9ucyxcbiAgICAgICAgICAgICAgICBwb3N0T3B0aW9uczogcG9zdE9wdGlvbnMsXG4gICAgICAgICAgICAgICAgZGVsZXRlT3B0aW9uczogZGVsZXRlT3B0aW9ucyxcbiAgICAgICAgICAgICAgICBnZXRQYWdlOiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIGdldFBhZ2VPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBnZXRSb3c6IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgZ2V0Um93T3B0aW9ucyksXG4gICAgICAgICAgICAgICAgcGF0Y2g6IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgcGF0Y2hPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBwb3N0OiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIHBvc3RPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBkZWxldGVSZXF1ZXN0OiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3QsIGRlbGV0ZU9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIGdldFBhZ2VXaXRoVG9rZW46IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgZ2V0UGFnZU9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIGdldFJvd1dpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBnZXRSb3dPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBwYXRjaFdpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBwYXRjaE9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIHBvc3RXaXRoVG9rZW46IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdFdpdGhUb2tlbiwgcG9zdE9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIGRlbGV0ZVdpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBkZWxldGVPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBvcHRpb25zOiBvcHRpb25zXG4gICAgICAgICAgICB9O1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiBwb3N0Z3Jlc3Q7XG4gICAgfTtcblxuICAgIHBvc3RncmVzdC5maWx0ZXJzVk0gPSBmaWx0ZXJzVk07XG4gICAgcG9zdGdyZXN0LnBhZ2luYXRpb25WTSA9IHBhZ2luYXRpb25WTTtcbiAgXG4gICAgcmV0dXJuIHBvc3RncmVzdDtcbn1cblxuZXhwb3J0IGRlZmF1bHQgUG9zdGdyZXN0O1xuIl0sIm5hbWVzIjpbImZpbHRlcnNWTSIsImF0dHJpYnV0ZXMiLCJuZXdWTSIsImZpbHRlciIsInByb3AiLCJtIiwiZmlsdGVyUHJvcCIsInZhbHVlIiwiYXJndW1lbnRzIiwibGVuZ3RoIiwidG9GaWx0ZXIiLCJfIiwiaXNTdHJpbmciLCJ0cmltIiwiZ2V0dGVycyIsInJlZHVjZSIsIm1lbW8iLCJvcGVyYXRvciIsImF0dHIiLCJwYXJhbWV0ZXJzV2l0aG91dE9yZGVyIiwiZ2V0dGVyIiwiaXNGdW5jdGlvbiIsInVuZGVmaW5lZCIsInJlcGxhY2UiLCJsdGUiLCJndGUiLCJwdXNoIiwicGFyYW1ldGVycyIsIm9yZGVyIiwiZGlyZWN0aW9uIiwiam9pbiIsIm9yZGVyUGFyYW1ldGVyIiwiZXh0ZW5kIiwicGFnaW5hdGlvblZNIiwibW9kZWwiLCJleHRyYUhlYWRlcnMiLCJhdXRoZW50aWNhdGUiLCJjb2xsZWN0aW9uIiwiZGVmYXVsdE9yZGVyIiwiZmlsdGVycyIsImlzTG9hZGluZyIsInBhZ2UiLCJyZXN1bHRzQ291bnQiLCJwYWdlUmVxdWVzdCIsImdldFBhZ2VXaXRoVG9rZW4iLCJnZXRQYWdlIiwidG90YWwiLCJmZXRjaCIsImQiLCJkZWZlcnJlZCIsImdldFRvdGFsIiwieGhyIiwic3RhdHVzIiwiSlNPTiIsInN0cmluZ2lmeSIsInJhbmdlSGVhZGVyIiwiZ2V0UmVzcG9uc2VIZWFkZXIiLCJzcGxpdCIsImhlYWRlclNpemUiLCJoZWFkZXJDb3VudCIsImhlYWRlckZyb20iLCJoZWFkZXJUbyIsInRvIiwicGFyc2VJbnQiLCJmcm9tIiwicmVzcG9uc2VUZXh0IiwiZXgiLCJ0aGVuIiwiZGF0YSIsInVuaW9uIiwicmVzb2x2ZSIsInJlZHJhdyIsImVycm9yIiwicmVqZWN0IiwicHJvbWlzZSIsImZpcnN0UGFnZSIsImlzTGFzdFBhZ2UiLCJwYWdlU2l6ZSIsIm5leHRQYWdlIiwiUG9zdGdyZXN0IiwicG9zdGdyZXN0IiwidG9rZW4iLCJtZXJnZUNvbmZpZyIsImNvbmZpZyIsIm9wdGlvbnMiLCJjb21wb3NlIiwiYWRkSGVhZGVycyIsImhlYWRlcnMiLCJlYWNoIiwia2V5Iiwic2V0UmVxdWVzdEhlYWRlciIsImFkZENvbmZpZ0hlYWRlcnMiLCJjcmVhdGVMb2FkZXIiLCJyZXF1ZXN0RnVuY3Rpb24iLCJkZWZhdWx0U3RhdGUiLCJsb2FkZXIiLCJsb2FkIiwicmVwcmVzZW50YXRpb25IZWFkZXIiLCJpbml0IiwiYXBpUHJlZml4IiwiYXV0aGVudGljYXRpb25PcHRpb25zIiwiZ2xvYmFsSGVhZGVyIiwicmVxdWVzdCIsImVycm9ySGFuZGxlciIsImV4dHJhY3QiLCJ1cmwiLCJyZXF1ZXN0V2l0aFRva2VuIiwicGFydGlhbCIsImxvYWRlcldpdGhUb2tlbiIsIm5hbWUiLCJwYWdpbmF0aW9uSGVhZGVycyIsInRvUmFuZ2UiLCJuYW1lT3B0aW9ucyIsImdldE9wdGlvbnMiLCJxdWVyeXN0cmluZyIsInJvdXRlIiwiYnVpbGRRdWVyeVN0cmluZyIsInBvc3RPcHRpb25zIiwiZGVsZXRlT3B0aW9ucyIsInBhdGNoT3B0aW9ucyIsImdldFBhZ2VPcHRpb25zIiwiZ2V0Um93T3B0aW9ucyJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBR0EsSUFBTUEsWUFBWSxTQUFaQSxTQUFZLENBQUNDLFVBQUQsRUFBZ0I7UUFDMUJDLFFBQVEsRUFBWjtRQUNJQyxTQUFTLFNBQVRBLE1BQVMsR0FBTTtZQUNMQyxPQUFPQyxFQUFFRCxJQUFGLENBQU8sRUFBUCxDQUFiO1lBQ0lFLGFBQWEsU0FBYkEs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QUFVTCxVQUFVMEIsZ0JBQXBCLEVBQXNDYSxZQUF0QyxDQWRiOytCQWVZNUcsRUFBRTBFLE9BQUYsQ0FBVUwsVUFBVTBCLGdCQUFwQixFQUFzQ1csV0FBdEMsQ0FmWjtpQ0FnQmMxRyxFQUFFMEUsT0FBRixDQUFVTCxVQUFVMEIsZ0JBQXBCLEVBQXNDWSxhQUF0QyxDQWhCZDt5QkFpQk1sQzthQWpCYjtTQTNGSjs7ZUFnSE9KLFNBQVA7S0EzS0o7O2NBOEtVaEYsU0FBVixHQUFzQkEsU0FBdEI7Y0FDVWlDLFlBQVYsR0FBeUJBLFlBQXpCOztXQUVPK0MsU0FBUDs7Ozs7Ozs7OyIsInByZUV4aXN0aW5nQ29tbWVudCI6Ii8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0PXV0Zi04O2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKbWFXeGxJanB1ZFd4c0xDSnpiM1Z5WTJWeklqcGJJaTlWYzJWeWN5OTBiMjR2UTI5a1pTOXRhWFJvY21sc0xYQnZjM1JuY21WemRDOXpjbU12ZG0xekwyWnBiSFJsY25OV1RTNXFjeUlzSWk5VmMyVnljeTkwYjI0dlEyOWtaUzl0YVhSb2NtbHNMWEJ2YzNSbmNtVnpkQzl6Y21NdmRtMXpMM0JoWjJsdVlYUnBiMjVXVFM1cWN5SXNJaTlWYzJWeWN5OTBiMjR2UTI5a1pTOXRhWFJvY21sc0xYQnZjM1JuY21WemRDOXpjbU12Y0c5emRHZHlaWE4wTG1weklsMHNJbk52ZFhKalpYTkRiMjUwWlc1MElqcGJJbWx0Y0c5eWRDQnRJR1p5YjIwZ0oyMXBkR2h5YVd3bk8xeHVhVzF3YjNKMElGOGdabkp2YlNBbmRXNWtaWEp6WTI5eVpTYzdYRzVjYm1OdmJuTjBJR1pwYkhSbGNuTldUU0E5SUNoaGRIUnlhV0oxZEdWektTQTlQaUI3WEc0Z0lDQWdiR1YwSUc1bGQxWk5JRDBnZTMwc1hHNGdJQ0FnSUNBZ0lHWnBiSFJsY2lBOUlDZ3BJRDArSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJR052Ym5OMElIQnliM0FnUFNCdExuQnliM0FvSnljcExGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHWnBiSFJsY2xCeWIzQWdQU0JtZFc1amRHbHZiaUFvZG1Gc2RXVXBJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2FXWWdLR0Z5WjNWdFpXNTBjeTVzWlc1bmRHZ2dQaUF3S1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCd2NtOXdLSFpoYkhWbEtUdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCdVpYZFdUVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdjSEp2Y0NncE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIMDdYRzRnSUNBZ0lDQWdJQ0FnSUNBdkx5QktkWE4wSUhOdklIZGxJR05oYmlCb1lYWmxJR0VnWkdWbVlYVnNkQ0IwYjE5bWFXeDBaWElnWVc1a0lHRjJiMmxrSUdsbUlGOHVhWE5HZFc1amRHbHZiaUJqWVd4c2MxeHVJQ0FnSUNBZ0lDQWdJQ0FnWm1sc2RHVnlVSEp2Y0M1MGIwWnBiSFJsY2lBOUlDZ3BJRDArSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCeVpYUjFjbTRnWHk1cGMxTjBjbWx1WnlobWFXeDBaWEpRY205d0tDa3BJRDhnWm1sc2RHVnlVSEp2Y0NncExuUnlhVzBvS1NBNklHWnBiSFJsY2xCeWIzQW9LVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lIMDdYRzRnSUNBZ0lDQWdJQ0FnSUNCeVpYUjFjbTRnWm1sc2RHVnlVSEp2Y0R0Y2JpQWdJQ0FnSUNBZ2ZTeGNibHh1SUNBZ0lDQWdJQ0JuWlhSMFpYSnpJRDBnWHk1eVpXUjFZMlVvWEc0Z0lDQWdJQ0FnSUNBZ0lDQmhkSFJ5YVdKMWRHVnpMQ0FvYldWdGJ5d2diM0JsY21GMGIzSXNJR0YwZEhJcElEMCtJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0F2THlCVWFHVWdiM0JsY21GMGIzSWdZbVYwZDJWbGJpQnBjeUJwYlhCc1pXMWxiblJsWkNCM2FYUm9JSFIzYnlCd2NtOXdaWEowYVdWekxDQnZibVVnWm05eUlHZHlaV0YwWlhJZ2RHaGhiaUIyWVd4MVpTQmhibVFnWVc1dmRHaGxjaUJtYjNJZ2JHVnpjMlZ5SUhSb1lXNGdkbUZzZFdVdVhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0x5OGdRbTkwYUNCd2NtOXdaWEowYVdWeklHRnlaU0J6Wlc1MElHbHVJSFJvWlNCeGRXVjFjbmx6ZEhKcGJtY2dkMmwwYUNCMGFHVWdjMkZ0WlNCdVlXMWxMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQzh2SUhSb1lYUW5jeUIzYUhrZ2QyVWdibVZsWkNCMGFHVWdjM0JsWTJsaGJDQmpZWE5sSUdobGNtVXNJSE52SUhkbElHTmhiaUIxYzJVZ1lTQnphVzF3YkdVZ2JXRndJR0Z6SUdGeVozVnRaVzUwSUhSdklHWnBiSFJsY25OV1RTNWNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnBaaUFvYjNCbGNtRjBiM0lnUFQwOUlDZGlaWFIzWldWdUp5a2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCdFpXMXZXMkYwZEhKZElEMGdlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdiSFJsT2lCbWFXeDBaWElvS1N4Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdkMFpUb2dabWxzZEdWeUtDbGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZlR0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCOUlHVnNjMlVnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnRaVzF2VzJGMGRISmRJRDBnWm1sc2RHVnlLQ2s3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUJ0Wlcxdk8xeHVJQ0FnSUNBZ0lDQWdJQ0FnZlN3Z2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHOXlaR1Z5T2lCbWFXeDBaWElvS1Z4dUlDQWdJQ0FnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0FwTEZ4dVhHNGdJQ0FnSUNBZ0lIQmhjbUZ0WlhSbGNuTlhhWFJvYjNWMFQzSmtaWElnUFNBb0tTQTlQaUI3WEc0Z0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z1h5NXlaV1IxWTJVb1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1oyVjBkR1Z5Y3l3Z0tHMWxiVzhzSUdkbGRIUmxjaXdnWVhSMGNpa2dQVDRnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnBaaUFvWVhSMGNpQWhQVDBnSjI5eVpHVnlKeWtnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnWTI5dWMzUWdiM0JsY21GMGIzSWdQU0JoZEhSeWFXSjFkR1Z6VzJGMGRISmRPMXh1WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JwWmlBb1h5NXBjMFoxYm1OMGFXOXVLR2RsZEhSbGNpNTBiMFpwYkhSbGNpa2dKaVlnS0dkbGRIUmxjaTUwYjBacGJIUmxjaWdwSUQwOVBTQjFibVJsWm1sdVpXUWdmSHdnWjJWMGRHVnlMblJ2Um1sc2RHVnlLQ2tnUFQwOUlDY25LU2tnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCdFpXMXZPMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmVnh1WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0F2THlCQ1pXeHNiM2NnZDJVZ2RYTmxJR1JwWm1abGNtVnVkQ0JtYjNKdFlYUjBhVzVuSUhKMWJHVnpJR1p2Y2lCMGFHVWdkbUZzZFdVZ1pHVndaVzVrYVc1bklHOXVJSFJvWlNCdmNHVnlZWFJ2Y2x4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnTHk4Z1ZHaGxjMlVnY25Wc1pYTWdZWEpsSUhWelpXUWdjbVZuWVhKa2JHVnpjeUJ2WmlCMGFHVWdkRzlHYVd4MFpYSWdablZ1WTNScGIyNHNYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQXZMeUJ6YnlCMGFHVWdkWE5sY2lCallXNGdkWE5sSUdFZ1kzVnpkRzl0SUhSdlJtbHNkR1Z5SUhkcGRHaHZkWFFnYUdGMmFXNW5JSFJ2SUhkdmNuSjVJSGRwZEdnZ1ltRnphV01nWm1sc2RHVnlJSE41Ym5SaGVGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2FXWWdLRzl3WlhKaGRHOXlJRDA5UFNBbmFXeHBhMlVuSUh4OElHOXdaWEpoZEc5eUlEMDlQU0FuYkdsclpTY3BJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCdFpXMXZXMkYwZEhKZElEMGdiM0JsY21GMGIzSWdLeUFuTGlvbklDc2daMlYwZEdWeUxuUnZSbWxzZEdWeUtDa2dLeUFuS2ljN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCOUlHVnNjMlVnYVdZZ0tHOXdaWEpoZEc5eUlEMDlQU0FuUUVBbktTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYldWdGIxdGhkSFJ5WFNBOUlHOXdaWEpoZEc5eUlDc2dKeTRuSUNzZ1oyVjBkR1Z5TG5SdlJtbHNkR1Z5S0NrdWNtVndiR0ZqWlNndlhGeHpLeTluTENBbkppY3BPMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmU0JsYkhObElHbG1JQ2h2Y0dWeVlYUnZjaUE5UFQwZ0oySmxkSGRsWlc0bktTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYVdZZ0tDRm5aWFIwWlhJdWJIUmxMblJ2Um1sc2RHVnlLQ2tnSmlZZ0lXZGxkSFJsY2k1bmRHVXVkRzlHYVd4MFpYSW9LU2tnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdiV1Z0Ynp0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYldWdGIxdGhkSFJ5WFNBOUlGdGRPMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdsbUlDaG5aWFIwWlhJdVozUmxLQ2twSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYldWdGIxdGhkSFJ5WFM1d2RYTm9LQ2RuZEdVdUp5QXJJR2RsZEhSbGNpNW5kR1V1ZEc5R2FXeDBaWElvS1NrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdsbUlDaG5aWFIwWlhJdWJIUmxLQ2twSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYldWdGIxdGhkSFJ5WFM1d2RYTm9LQ2RzZEdVdUp5QXJJR2RsZEhSbGNpNXNkR1V1ZEc5R2FXeDBaWElvS1NrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmU0JsYkhObElHbG1JQ2h2Y0dWeVlYUnZjaUE5UFQwZ0oybHpMbTUxYkd3bktTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYldWdGIxdGhkSFJ5WFNBOUlHZGxkSFJsY2k1MGIwWnBiSFJsY2lncElEMDlQU0J1ZFd4c0lEOGdKMmx6TG01MWJHd25JRG9nSjI1dmRDNXBjeTV1ZFd4c0p6dGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIMGdaV3h6WlNCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdiV1Z0YjF0aGRIUnlYU0E5SUc5d1pYSmhkRzl5SUNzZ0p5NG5JQ3NnWjJWMGRHVnlMblJ2Um1sc2RHVnlLQ2s3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnY21WMGRYSnVJRzFsYlc4N1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2ZTd2dlMzFjYmlBZ0lDQWdJQ0FnSUNBZ0lDazdYRzRnSUNBZ0lDQWdJSDBzWEc1Y2JpQWdJQ0FnSUNBZ2NHRnlZVzFsZEdWeWN5QTlJQ2dwSUQwK0lIdGNiaUFnSUNBZ0lDQWdJQ0FnSUM4dklGUm9aU0J2Y21SbGNpQndZWEpoYldWMFpYSnpJR2hoZG1VZ1lTQnpjR1ZqYVdGc0lITjViblJoZUNBb2FuVnpkQ0JzYVd0bElHRnVJRzl5WkdWeUlHSjVJRk5SVENCamJHRjFjMlVwWEc0Z0lDQWdJQ0FnSUNBZ0lDQXZMeUJvZEhSd2N6b3ZMMmRwZEdoMVlpNWpiMjB2WW1WbmNtbG1abk12Y0c5emRHZHlaWE4wTDNkcGEya3ZVbTkxZEdsdVp5Tm1hV3gwWlhKcGJtY3RZVzVrTFc5eVpHVnlhVzVuWEc0Z0lDQWdJQ0FnSUNBZ0lDQmpiMjV6ZENCdmNtUmxjaUE5SUNncElEMCtJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdaMlYwZEdWeWN5NXZjbVJsY2lncElDWW1JRjh1Y21Wa2RXTmxLRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCblpYUjBaWEp6TG05eVpHVnlLQ2tzSUNodFpXMXZMQ0JrYVhKbFkzUnBiMjRzSUdGMGRISXBJRDArSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUcxbGJXOHVjSFZ6YUNoaGRIUnlJQ3NnSnk0bklDc2daR2x5WldOMGFXOXVLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQnRaVzF2TzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlMQ0JiWFZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNrdWFtOXBiaWduTENjcE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnZlN4Y2JseHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHOXlaR1Z5VUdGeVlXMWxkR1Z5SUQwZ2IzSmtaWElvS1NBL0lIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYjNKa1pYSTZJRzl5WkdWeUtDbGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlJRG9nZTMwN1hHNWNiaUFnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUJmTG1WNGRHVnVaQ2g3ZlN3Z2IzSmtaWEpRWVhKaGJXVjBaWElzSUhCaGNtRnRaWFJsY25OWGFYUm9iM1YwVDNKa1pYSW9LU2s3WEc1Y2JpQWdJQ0FnSUNBZ2ZUdGNibHh1SUNBZ0lISmxkSFZ5YmlCZkxtVjRkR1Z1WkNodVpYZFdUU3dnWjJWMGRHVnljeXdnZTF4dUlDQWdJQ0FnSUNCd1lYSmhiV1YwWlhKek9pQndZWEpoYldWMFpYSnpMRnh1SUNBZ0lDQWdJQ0J3WVhKaGJXVjBaWEp6VjJsMGFHOTFkRTl5WkdWeU9pQndZWEpoYldWMFpYSnpWMmwwYUc5MWRFOXlaR1Z5WEc0Z0lDQWdmU2s3WEc1OU8xeHVYRzVsZUhCdmNuUWdaR1ZtWVhWc2RDQm1hV3gwWlhKelZrMDdYRzRpTENKcGJYQnZjblFnYlNCbWNtOXRJQ2R0YVhSb2NtbHNKenRjYm1sdGNHOXlkQ0JmSUdaeWIyMGdKM1Z1WkdWeWMyTnZjbVVuTzF4dVhHNWpiMjV6ZENCd1lXZHBibUYwYVc5dVZrMGdQU0FvYlc5a1pXd3NJRzl5WkdWeUxDQmxlSFJ5WVVobFlXUmxjbk1nUFNCN2ZTd2dZWFYwYUdWdWRHbGpZWFJsSUQwZ2RISjFaU2tnUFQ0Z2UxeHVJQ0FnSUd4bGRDQmpiMnhzWldOMGFXOXVJRDBnYlM1d2NtOXdLRnRkS1N4Y2JpQWdJQ0FnSUNBZ1pHVm1ZWFZzZEU5eVpHVnlJRDBnYjNKa1pYSWdmSHdnSjJsa0xtUmxjMk1uTEZ4dUlDQWdJQ0FnSUNCbWFXeDBaWEp6SUQwZ2JTNXdjbTl3S0h0Y2JpQWdJQ0FnSUNBZ0lDQWdJRzl5WkdWeU9pQmtaV1poZFd4MFQzSmtaWEpjYmlBZ0lDQWdJQ0FnZlNrc1hHNGdJQ0FnSUNBZ0lHbHpURzloWkdsdVp5QTlJRzB1Y0hKdmNDaG1ZV3h6WlNrc1hHNGdJQ0FnSUNBZ0lIQmhaMlVnUFNCdExuQnliM0FvTVNrc1hHNGdJQ0FnSUNBZ0lISmxjM1ZzZEhORGIzVnVkQ0E5SUcwdWNISnZjQ2dwTEZ4dUlDQWdJQ0FnSUNCd1lXZGxVbVZ4ZFdWemRDQTlJR0YxZEdobGJuUnBZMkYwWlNBL0lHMXZaR1ZzTG1kbGRGQmhaMlZYYVhSb1ZHOXJaVzRnT2lCdGIyUmxiQzVuWlhSUVlXZGxMRnh1SUNBZ0lDQWdJQ0IwYjNSaGJDQTlJRzB1Y0hKdmNDZ3BPMXh1WEc0Z0lDQWdZMjl1YzNRZ1ptVjBZMmdnUFNBb0tTQTlQaUI3WEc0Z0lDQWdJQ0FnSUd4bGRDQmtJRDBnYlM1a1pXWmxjbkpsWkNncE8xeHVJQ0FnSUNBZ0lDQmpiMjV6ZENCblpYUlViM1JoYkNBOUlDaDRhSElwSUQwK0lIdGNiaUFnSUNBZ0lDQWdJQ0FnSUdsbUlDZ2hlR2h5SUh4OElIaG9jaTV6ZEdGMGRYTWdQVDA5SURBcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z1NsTlBUaTV6ZEhKcGJtZHBabmtvZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQm9hVzUwT2lCdWRXeHNMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCa1pYUmhhV3h6T2lCdWRXeHNMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCamIyUmxPaUF3TEZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnRaWE56WVdkbE9pQW5RMjl1Ym1WamRHbHZiaUJsY25KdmNpZGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdJQ0FnSUd4bGRDQnlZVzVuWlVobFlXUmxjaUE5SUhob2NpNW5aWFJTWlhOd2IyNXpaVWhsWVdSbGNpZ25RMjl1ZEdWdWRDMVNZVzVuWlNjcE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnYVdZZ0tGOHVhWE5UZEhKcGJtY29jbUZ1WjJWSVpXRmtaWElwS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2JHVjBJRnRvWldGa1pYSlRhWHBsTENCb1pXRmtaWEpEYjNWdWRGMGdQU0J5WVc1blpVaGxZV1JsY2k1emNHeHBkQ2duTHljcExGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JiYUdWaFpHVnlSbkp2YlN3Z2FHVmhaR1Z5Vkc5ZElEMGdhR1ZoWkdWeVUybDZaUzV6Y0d4cGRDZ25MU2NwTEZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjBieUE5SUhCaGNuTmxTVzUwS0dobFlXUmxjbFJ2S1NBcklERWdmSHdnTUN4Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdabkp2YlNBOUlIQmhjbk5sU1c1MEtHaGxZV1JsY2taeWIyMHBJQ0I4ZkNBd08xeHVYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdkRzkwWVd3b2NHRnljMlZKYm5Rb2FHVmhaR1Z5UTI5MWJuUXBLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J5WlhOMWJIUnpRMjkxYm5Rb2RHOGdMU0JtY205dEtUdGNiaUFnSUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ0lDQWdJSFJ5ZVNCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1NsTlBUaTV3WVhKelpTaDRhSEl1Y21WemNHOXVjMlZVWlhoMEtUdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z2VHaHlMbkpsYzNCdmJuTmxWR1Y0ZER0Y2JpQWdJQ0FnSUNBZ0lDQWdJSDBnWTJGMFkyZ2dLR1Y0S1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2NtVjBkWEp1SUVwVFQwNHVjM1J5YVc1bmFXWjVLSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2FHbHVkRG9nYm5Wc2JDeGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnWkdWMFlXbHNjem9nYm5Wc2JDeGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnWTI5a1pUb2dNQ3hjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2JXVnpjMkZuWlRvZ2VHaHlMbkpsYzNCdmJuTmxWR1Y0ZEZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUgwcE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNCOU8xeHVJQ0FnSUNBZ0lDQnBjMHh2WVdScGJtY29kSEoxWlNrN1hHNGdJQ0FnSUNBZ0lIQmhaMlZTWlhGMVpYTjBLR1pwYkhSbGNuTW9LU3dnY0dGblpTZ3BMQ0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQmlZV05yWjNKdmRXNWtPaUIwY25WbExGeHVJQ0FnSUNBZ0lDQWdJQ0FnWlhoMGNtRmpkRG9nWjJWMFZHOTBZV3hjYmlBZ0lDQWdJQ0FnZlN3Z1pYaDBjbUZJWldGa1pYSnpLUzUwYUdWdUtDaGtZWFJoS1NBOVBpQjdYRzRnSUNBZ0lDQWdJQ0FnSUNCamIyeHNaV04wYVc5dUtGOHVkVzVwYjI0b1kyOXNiR1ZqZEdsdmJpZ3BMQ0JrWVhSaEtTazdYRzRnSUNBZ0lDQWdJQ0FnSUNCcGMweHZZV1JwYm1jb1ptRnNjMlVwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdaQzV5WlhOdmJIWmxLR052Ykd4bFkzUnBiMjRvS1NrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0J0TG5KbFpISmhkeWdwTzF4dUlDQWdJQ0FnSUNCOUxDQW9aWEp5YjNJcElEMCtJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lHbHpURzloWkdsdVp5aG1ZV3h6WlNrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0IwYjNSaGJDZ3dLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lHUXVjbVZxWldOMEtHVnljbTl5S1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJRzB1Y21Wa2NtRjNLQ2s3WEc0Z0lDQWdJQ0FnSUgwcE8xeHVJQ0FnSUNBZ0lDQnlaWFIxY200Z1pDNXdjbTl0YVhObE8xeHVJQ0FnSUgwc1hHNWNiaUFnSUNCbWFYSnpkRkJoWjJVZ1BTQW9jR0Z5WVcxbGRHVnljeWtnUFQ0Z2UxeHVJQ0FnSUNBZ0lDQm1hV3gwWlhKektGOHVaWGgwWlc1a0tIdGNiaUFnSUNBZ0lDQWdJQ0FnSUc5eVpHVnlPaUJrWldaaGRXeDBUM0prWlhKY2JpQWdJQ0FnSUNBZ2ZTd2djR0Z5WVcxbGRHVnljeWtwTzF4dUlDQWdJQ0FnSUNCamIyeHNaV04wYVc5dUtGdGRLVHRjYmlBZ0lDQWdJQ0FnY0dGblpTZ3hLVHRjYmlBZ0lDQWdJQ0FnY21WMGRYSnVJR1psZEdOb0tDazdYRzRnSUNBZ2ZTeGNibHh1SUNBZ0lHbHpUR0Z6ZEZCaFoyVWdQU0FvS1NBOVBpQjdYRzRnSUNBZ0lDQWdJSEpsZEhWeWJpQW9iVzlrWld3dWNHRm5aVk5wZW1Vb0tTQStJSEpsYzNWc2RITkRiM1Z1ZENncEtUdGNiaUFnSUNCOUxGeHVYRzRnSUNBZ2JtVjRkRkJoWjJVZ1BTQW9LU0E5UGlCN1hHNGdJQ0FnSUNBZ0lIQmhaMlVvY0dGblpTZ3BJQ3NnTVNrN1hHNGdJQ0FnSUNBZ0lISmxkSFZ5YmlCbVpYUmphQ2dwTzF4dUlDQWdJSDA3WEc1Y2JpQWdJQ0J5WlhSMWNtNGdlMXh1SUNBZ0lDQWdJQ0JqYjJ4c1pXTjBhVzl1T2lCamIyeHNaV04wYVc5dUxGeHVJQ0FnSUNBZ0lDQm1hWEp6ZEZCaFoyVTZJR1pwY25OMFVHRm5aU3hjYmlBZ0lDQWdJQ0FnYVhOTWIyRmthVzVuT2lCcGMweHZZV1JwYm1jc1hHNGdJQ0FnSUNBZ0lHNWxlSFJRWVdkbE9pQnVaWGgwVUdGblpTeGNiaUFnSUNBZ0lDQWdhWE5NWVhOMFVHRm5aVG9nYVhOTVlYTjBVR0ZuWlN4Y2JpQWdJQ0FnSUNBZ2RHOTBZV3c2SUhSdmRHRnNMRnh1SUNBZ0lDQWdJQ0J5WlhOMWJIUnpRMjkxYm5RNklISmxjM1ZzZEhORGIzVnVkRnh1SUNBZ0lIMDdYRzU5TzF4dVhHNWxlSEJ2Y25RZ1pHVm1ZWFZzZENCd1lXZHBibUYwYVc5dVZrMDdYRzRpTENKcGJYQnZjblFnYlNCbWNtOXRJQ2R0YVhSb2NtbHNKenRjYm1sdGNHOXlkQ0JmSUdaeWIyMGdKM1Z1WkdWeWMyTnZjbVVuTzF4dWFXMXdiM0owSUdacGJIUmxjbk5XVFNCbWNtOXRJQ2N1TDNadGN5OW1hV3gwWlhKelZrMG5PMXh1YVcxd2IzSjBJSEJoWjJsdVlYUnBiMjVXVFNCbWNtOXRJQ2N1TDNadGN5OXdZV2RwYm1GMGFXOXVWazBuTzF4dVhHNW1kVzVqZEdsdmJpQlFiM04wWjNKbGMzUWdLQ2tnZTF4dUlDQWdJR3hsZENCd2IzTjBaM0psYzNRZ1BTQjdmVHRjYmx4dUlDQWdJR052Ym5OMElIUnZhMlZ1SUQwZ2JTNXdjbTl3S0Nrc1hHNWNiaUFnSUNBZ0lDQWdJQ0J0WlhKblpVTnZibVpwWnlBOUlDaGpiMjVtYVdjc0lHOXdkR2x2Ym5NcElEMCtJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdjbVYwZFhKdUlHOXdkR2x2Ym5NZ0ppWWdYeTVwYzBaMWJtTjBhVzl1S0c5d2RHbHZibk11WTI5dVptbG5LU0EvSUY4dVkyOXRjRzl6WlNodmNIUnBiMjV6TG1OdmJtWnBaeXdnWTI5dVptbG5LU0E2SUdOdmJtWnBaenRjYmlBZ0lDQWdJQ0FnSUNCOUxGeHVYRzRnSUNBZ0lDQWdJQ0FnWVdSa1NHVmhaR1Z5Y3lBOUlDaG9aV0ZrWlhKektTQTlQaUI3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQW9lR2h5S1NBOVBpQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JmTG1WaFkyZ29hR1ZoWkdWeWN5d2dLSFpoYkhWbExDQnJaWGtwSUQwK0lIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCNGFISXVjMlYwVW1WeGRXVnpkRWhsWVdSbGNpaHJaWGtzSUhaaGJIVmxLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUgwcE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdjbVYwZFhKdUlIaG9janRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdmVHRjYmlBZ0lDQWdJQ0FnSUNCOUxGeHVYRzRnSUNBZ0lDQWdJQ0FnWVdSa1EyOXVabWxuU0dWaFpHVnljeUE5SUNob1pXRmtaWEp6TENCdmNIUnBiMjV6S1NBOVBpQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCZkxtVjRkR1Z1WkNoN2ZTd2diM0IwYVc5dWN5d2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnWTI5dVptbG5PaUJ0WlhKblpVTnZibVpwWnloaFpHUklaV0ZrWlhKektHaGxZV1JsY25NcExDQnZjSFJwYjI1ektWeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNCOUtUdGNiaUFnSUNBZ0lDQWdJQ0I5TEZ4dVhHNGdJQ0FnSUNBZ0lDQWdZM0psWVhSbFRHOWhaR1Z5SUQwZ0tISmxjWFZsYzNSR2RXNWpkR2x2Yml3Z2IzQjBhVzl1Y3l3Z1pHVm1ZWFZzZEZOMFlYUmxJRDBnWm1Gc2MyVXBJRDArSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnWTI5dWMzUWdiRzloWkdWeUlEMGdiUzV3Y205d0tHUmxabUYxYkhSVGRHRjBaU2tzWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHUWdQU0J0TG1SbFptVnljbVZrS0NrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUd4dllXUmxjaTVzYjJGa0lEMGdLQ2tnUFQ0Z2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdiRzloWkdWeUtIUnlkV1VwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2JTNXlaV1J5WVhjb0tUdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEpsY1hWbGMzUkdkVzVqZEdsdmJpaGZMbVY0ZEdWdVpDaDdmU3dnYjNCMGFXOXVjeXdnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR0poWTJ0bmNtOTFibVE2SUhSeWRXVmNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDBwS1M1MGFHVnVLQ2hrWVhSaEtTQTlQaUI3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdiRzloWkdWeUtHWmhiSE5sS1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JrTG5KbGMyOXNkbVVvWkdGMFlTazdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2JTNXlaV1J5WVhjb0tUdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDBzSUNobGNuSnZjaWtnUFQ0Z2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUd4dllXUmxjaWhtWVd4elpTazdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1pDNXlaV3BsWTNRb1pYSnliM0lwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJRzB1Y21Wa2NtRjNLQ2s3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCOUtUdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQmtMbkJ5YjIxcGMyVTdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lIMDdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCc2IyRmtaWEk3WEc0Z0lDQWdJQ0FnSUNBZ2ZTeGNibHh1SUNBZ0lDQWdJQ0FnSUhKbGNISmxjMlZ1ZEdGMGFXOXVTR1ZoWkdWeUlEMGdlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQW5VSEpsWm1WeUp6b2dKM0psZEhWeWJqMXlaWEJ5WlhObGJuUmhkR2x2YmlkY2JpQWdJQ0FnSUNBZ0lDQjlPMXh1WEc0Z0lDQWdjRzl6ZEdkeVpYTjBMblJ2YTJWdUlEMGdkRzlyWlc0N1hHNWNiaUFnSUNCd2IzTjBaM0psYzNRdWFXNXBkQ0E5SUNoaGNHbFFjbVZtYVhnc0lHRjFkR2hsYm5ScFkyRjBhVzl1VDNCMGFXOXVjeXdnWjJ4dlltRnNTR1ZoWkdWeUlEMGdlMzBwSUQwK0lIdGNiaUFnSUNBZ0lDQWdjRzl6ZEdkeVpYTjBMbkpsY1hWbGMzUWdQU0FvYjNCMGFXOXVjeWtnUFQ0Z2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnWTI5dWMzUWdaWEp5YjNKSVlXNWtiR1Z5SUQwZ0tIaG9jaWtnUFQ0Z2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIUnllU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lFcFRUMDR1Y0dGeWMyVW9lR2h5TG5KbGMzQnZibk5sVkdWNGRDazdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUI0YUhJdWNtVnpjRzl1YzJWVVpYaDBPMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDBnWTJGMFkyZ2dLR1Y0S1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQktVMDlPTG5OMGNtbHVaMmxtZVNoN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCb2FXNTBPaUJ1ZFd4c0xGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1pHVjBZV2xzY3pvZ2JuVnNiQ3hjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR052WkdVNklEQXNYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnRaWE56WVdkbE9pQjRhSEl1Y21WemNHOXVjMlZVWlhoMFhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDBwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ0lDQWdJSDA3WEc0Z0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z2JTNXlaWEYxWlhOMEtGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHRmtaRU52Ym1acFowaGxZV1JsY25Nb1oyeHZZbUZzU0dWaFpHVnlMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCZkxtVjRkR1Z1WkNoN1pYaDBjbUZqZERvZ1pYSnliM0pJWVc1a2JHVnlmU3dnYjNCMGFXOXVjeXdnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZFhKc09pQmhjR2xRY21WbWFYZ2dLeUJ2Y0hScGIyNXpMblZ5YkZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlLVnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ2xjYmlBZ0lDQWdJQ0FnSUNBZ0lDazdYRzRnSUNBZ0lDQWdJSDA3WEc1Y2JpQWdJQ0FnSUNBZ2NHOXpkR2R5WlhOMExtRjFkR2hsYm5ScFkyRjBaU0E5SUNncElEMCtJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lHTnZibk4wSUdSbFptVnljbVZrSUQwZ2JTNWtaV1psY25KbFpDZ3BPMXh1SUNBZ0lDQWdJQ0FnSUNBZ2FXWWdLSFJ2YTJWdUtDa3BJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JrWldabGNuSmxaQzV5WlhOdmJIWmxLSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2RHOXJaVzQ2SUhSdmEyVnVLQ2xjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0I5S1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJSDBnWld4elpTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdiUzV5WlhGMVpYTjBLRjh1WlhoMFpXNWtLSHQ5TENCaGRYUm9aVzUwYVdOaGRHbHZiazl3ZEdsdmJuTXBLUzUwYUdWdUtDaGtZWFJoS1NBOVBpQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhSdmEyVnVLR1JoZEdFdWRHOXJaVzRwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQmtaV1psY25KbFpDNXlaWE52YkhabEtIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIUnZhMlZ1T2lCMGIydGxiaWdwWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIMHBPMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDBzSUNoa1lYUmhLU0E5UGlCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR1JsWm1WeWNtVmtMbkpsYW1WamRDaGtZWFJoS1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCOUtUdGNiaUFnSUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQmtaV1psY25KbFpDNXdjbTl0YVhObE8xeHVJQ0FnSUNBZ0lDQjlPMXh1WEc0Z0lDQWdJQ0FnSUhCdmMzUm5jbVZ6ZEM1eVpYRjFaWE4wVjJsMGFGUnZhMlZ1SUQwZ0tHOXdkR2x2Ym5NcElEMCtJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCd2IzTjBaM0psYzNRdVlYVjBhR1Z1ZEdsallYUmxLQ2t1ZEdobGJpaGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQW9LU0E5UGlCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQndiM04wWjNKbGMzUXVjbVZ4ZFdWemRDaGhaR1JEYjI1bWFXZElaV0ZrWlhKektIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDZEJkWFJvYjNKcGVtRjBhVzl1SnpvZ0owSmxZWEpsY2lBbklDc2dkRzlyWlc0b0tWeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0I5TENCdmNIUnBiMjV6S1NrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2ZTd2dLQ2tnUFQ0Z2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdjRzl6ZEdkeVpYTjBMbkpsY1hWbGMzUW9iM0IwYVc5dWN5azdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0FnSUNBZ0tUdGNiaUFnSUNBZ0lDQWdmVHRjYmx4dUlDQWdJQ0FnSUNCd2IzTjBaM0psYzNRdWJHOWhaR1Z5SUQwZ1h5NXdZWEowYVdGc0tHTnlaV0YwWlV4dllXUmxjaXdnY0c5emRHZHlaWE4wTG5KbGNYVmxjM1FwTzF4dUlDQWdJQ0FnSUNCY2JpQWdJQ0FnSUNBZ2NHOXpkR2R5WlhOMExteHZZV1JsY2xkcGRHaFViMnRsYmlBOUlGOHVjR0Z5ZEdsaGJDaGpjbVZoZEdWTWIyRmtaWElzSUhCdmMzUm5jbVZ6ZEM1eVpYRjFaWE4wVjJsMGFGUnZhMlZ1S1R0Y2JseHVJQ0FnSUNBZ0lDQndiM04wWjNKbGMzUXViVzlrWld3Z1BTQW9ibUZ0WlNrZ1BUNGdlMXh1SUNBZ0lDQWdJQ0FnSUNBZ1kyOXVjM1FnY0dGbmFXNWhkR2x2YmtobFlXUmxjbk1nUFNBb2NHRm5aU3dnY0dGblpWTnBlbVVwSUQwK0lIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnBaaUFvSVhCaFoyVlRhWHBsS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJqdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlYRzVjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JqYjI1emRDQjBiMUpoYm1kbElEMGdLQ2tnUFQ0Z2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JqYjI1emRDQm1jbTl0SUQwZ0tIQmhaMlVnTFNBeEtTQXFJSEJoWjJWVGFYcGxMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0IwYnlBOUlHWnliMjBnS3lCd1lXZGxVMmw2WlNBdElERTdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUJtY205dElDc2dKeTBuSUNzZ2RHODdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmVHRjYmx4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUI3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDZFNZVzVuWlMxMWJtbDBKem9nSjJsMFpXMXpKeXhjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0oxSmhibWRsSnpvZ2RHOVNZVzVuWlNncFhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2ZUdGNiaUFnSUNBZ0lDQWdJQ0FnSUgwc1hHNWNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEJoWjJWVGFYcGxJRDBnYlM1d2NtOXdLREV3S1N4Y2JseHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdibUZ0WlU5d2RHbHZibk1nUFNCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZFhKc09pQW5MeWNnS3lCdVlXMWxYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0I5TEZ4dVhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQm5aWFJQY0hScGIyNXpJRDBnS0dSaGRHRXNJSEJoWjJVc0lIQmhaMlZUYVhwbExDQnZjSFJwYjI1ekxDQm9aV0ZrWlhKeklEMGdlMzBwSUQwK0lIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCamIyNXpkQ0JsZUhSeVlVaGxZV1JsY25NZ1BTQmZMbVY0ZEdWdVpDaDdmU3dnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBblVISmxabVZ5SnpvZ0oyTnZkVzUwUFc1dmJtVW5YRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2ZTd2dhR1ZoWkdWeWN5d2djR0ZuYVc1aGRHbHZia2hsWVdSbGNuTW9jR0ZuWlN3Z2NHRm5aVk5wZW1VcEtUdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCeVpYUjFjbTRnWVdSa1EyOXVabWxuU0dWaFpHVnljeWhsZUhSeVlVaGxZV1JsY25Nc0lGOHVaWGgwWlc1a0tIdDlMQ0J2Y0hScGIyNXpMQ0J1WVcxbFQzQjBhVzl1Y3l3Z2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnRaWFJvYjJRNklDZEhSVlFuTEZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCa1lYUmhPaUJrWVhSaFhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZlNrcE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmU3hjYmx4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2NYVmxjbmx6ZEhKcGJtY2dQU0FvWm1sc2RHVnljeXdnYjNCMGFXOXVjeWtnUFQ0Z2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUc5d2RHbHZibk11ZFhKc0lDczlJQ2MvSnlBcklHMHVjbTkxZEdVdVluVnBiR1JSZFdWeWVWTjBjbWx1WnlobWFXeDBaWEp6S1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdiM0IwYVc5dWN6dGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDBzWEc1Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHOXdkR2x2Ym5NZ1BTQW9iM0IwYVc5dWN5a2dQVDRnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQndiM04wWjNKbGMzUXVjbVZ4ZFdWemRDaGZMbVY0ZEdWdVpDaDdmU3dnYjNCMGFXOXVjeXdnYm1GdFpVOXdkR2x2Ym5Nc0lIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdiV1YwYUc5a09pQW5UMUJVU1U5T1V5ZGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCOUtTazdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0I5TEZ4dVhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQndiM04wVDNCMGFXOXVjeUE5SUNoaGRIUnlhV0oxZEdWekxDQnZjSFJwYjI1ekxDQm9aV0ZrWlhKeklEMGdlMzBwSUQwK0lIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCamIyNXpkQ0JsZUhSeVlVaGxZV1JsY25NZ1BTQmZMbVY0ZEdWdVpDaDdmU3dnY21Wd2NtVnpaVzUwWVhScGIyNUlaV0ZrWlhJc0lHaGxZV1JsY25NcE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUJoWkdSRGIyNW1hV2RJWldGa1pYSnpLRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JsZUhSeVlVaGxZV1JsY25Nc1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lGOHVaWGgwWlc1a0tIdDlMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J2Y0hScGIyNXpMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J1WVcxbFQzQjBhVzl1Y3l3Z2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYldWMGFHOWtPaUFuVUU5VFZDY3NYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCa1lYUmhPaUJoZEhSeWFXSjFkR1Z6WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBcFhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnS1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIMHNYRzVjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdSbGJHVjBaVTl3ZEdsdmJuTWdQU0FvWm1sc2RHVnljeXdnYjNCMGFXOXVjeXdnYUdWaFpHVnljeUE5SUh0OUtTQTlQaUI3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdZMjl1YzNRZ1pYaDBjbUZJWldGa1pYSnpJRDBnWHk1bGVIUmxibVFvZTMwc0lISmxjSEpsYzJWdWRHRjBhVzl1U0dWaFpHVnlMQ0JvWldGa1pYSnpLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z2NYVmxjbmx6ZEhKcGJtY29abWxzZEdWeWN5d2dZV1JrUTI5dVptbG5TR1ZoWkdWeWN5aGxlSFJ5WVVobFlXUmxjbk1zSUY4dVpYaDBaVzVrS0h0OUxDQnZjSFJwYjI1ekxDQnVZVzFsVDNCMGFXOXVjeXdnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCdFpYUm9iMlE2SUNkRVJVeEZWRVVuWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmU2twS1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIMHNYRzVjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhCaGRHTm9UM0IwYVc5dWN5QTlJQ2htYVd4MFpYSnpMQ0JoZEhSeWFXSjFkR1Z6TENCdmNIUnBiMjV6TENCb1pXRmtaWEp6SUQwZ2UzMHBJRDArSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JqYjI1emRDQmxlSFJ5WVVobFlXUmxjbk1nUFNCZkxtVjRkR1Z1WkNoN2ZTd2djbVZ3Y21WelpXNTBZWFJwYjI1SVpXRmtaWElzSUdobFlXUmxjbk1wTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQnhkV1Z5ZVhOMGNtbHVaeWhjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnWm1sc2RHVnljeXhjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnWVdSa1EyOXVabWxuU0dWaFpHVnljeWhjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHVjRkSEpoU0dWaFpHVnljeXhjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lGOHVaWGgwWlc1a0tIdDlMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2IzQjBhVzl1Y3l4Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJRzVoYldWUGNIUnBiMjV6TENCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2JXVjBhRzlrT2lBblVFRlVRMGduTEZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdSaGRHRTZJR0YwZEhKcFluVjBaWE5jYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnS1Z4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBcFhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnS1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIMHNYRzVjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdkbGRGQmhaMlZQY0hScGIyNXpJRDBnS0dSaGRHRXNJSEJoWjJVc0lHOXdkR2x2Ym5Nc0lHaGxZV1JsY25NZ1BTQjdmU2tnUFQ0Z2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUJuWlhSUGNIUnBiMjV6S0dSaGRHRXNJQ2h3WVdkbElIeDhJREVwTENCd1lXZGxVMmw2WlNncExDQnZjSFJwYjI1ekxDQm9aV0ZrWlhKektUdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDBzWEc1Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHZGxkRkp2ZDA5d2RHbHZibk1nUFNBb1pHRjBZU3dnYjNCMGFXOXVjeXdnYUdWaFpHVnljeUE5SUh0OUtTQTlQaUI3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdjbVYwZFhKdUlHZGxkRTl3ZEdsdmJuTW9aR0YwWVN3Z01Td2dNU3dnYjNCMGFXOXVjeXdnYUdWaFpHVnljeWs3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCOU8xeHVYRzRnSUNBZ0lDQWdJQ0FnSUNCeVpYUjFjbTRnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhCaFoyVlRhWHBsT2lCd1lXZGxVMmw2WlN4Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCblpYUlFZV2RsVDNCMGFXOXVjem9nWjJWMFVHRm5aVTl3ZEdsdmJuTXNYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdaMlYwVW05M1QzQjBhVzl1Y3pvZ1oyVjBVbTkzVDNCMGFXOXVjeXhjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J3WVhSamFFOXdkR2x2Ym5NNklIQmhkR05vVDNCMGFXOXVjeXhjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J3YjNOMFQzQjBhVzl1Y3pvZ2NHOXpkRTl3ZEdsdmJuTXNYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdaR1ZzWlhSbFQzQjBhVzl1Y3pvZ1pHVnNaWFJsVDNCMGFXOXVjeXhjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JuWlhSUVlXZGxPaUJmTG1OdmJYQnZjMlVvY0c5emRHZHlaWE4wTG5KbGNYVmxjM1FzSUdkbGRGQmhaMlZQY0hScGIyNXpLU3hjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JuWlhSU2IzYzZJRjh1WTI5dGNHOXpaU2h3YjNOMFozSmxjM1F1Y21WeGRXVnpkQ3dnWjJWMFVtOTNUM0IwYVc5dWN5a3NYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdjR0YwWTJnNklGOHVZMjl0Y0c5elpTaHdiM04wWjNKbGMzUXVjbVZ4ZFdWemRDd2djR0YwWTJoUGNIUnBiMjV6S1N4Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCd2IzTjBPaUJmTG1OdmJYQnZjMlVvY0c5emRHZHlaWE4wTG5KbGNYVmxjM1FzSUhCdmMzUlBjSFJwYjI1ektTeGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQmtaV3hsZEdWU1pYRjFaWE4wT2lCZkxtTnZiWEJ2YzJVb2NHOXpkR2R5WlhOMExuSmxjWFZsYzNRc0lHUmxiR1YwWlU5d2RHbHZibk1wTEZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdkbGRGQmhaMlZYYVhSb1ZHOXJaVzQ2SUY4dVkyOXRjRzl6WlNod2IzTjBaM0psYzNRdWNtVnhkV1Z6ZEZkcGRHaFViMnRsYml3Z1oyVjBVR0ZuWlU5d2RHbHZibk1wTEZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdkbGRGSnZkMWRwZEdoVWIydGxiam9nWHk1amIyMXdiM05sS0hCdmMzUm5jbVZ6ZEM1eVpYRjFaWE4wVjJsMGFGUnZhMlZ1TENCblpYUlNiM2RQY0hScGIyNXpLU3hjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J3WVhSamFGZHBkR2hVYjJ0bGJqb2dYeTVqYjIxd2IzTmxLSEJ2YzNSbmNtVnpkQzV5WlhGMVpYTjBWMmwwYUZSdmEyVnVMQ0J3WVhSamFFOXdkR2x2Ym5NcExGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIQnZjM1JYYVhSb1ZHOXJaVzQ2SUY4dVkyOXRjRzl6WlNod2IzTjBaM0psYzNRdWNtVnhkV1Z6ZEZkcGRHaFViMnRsYml3Z2NHOXpkRTl3ZEdsdmJuTXBMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR1JsYkdWMFpWZHBkR2hVYjJ0bGJqb2dYeTVqYjIxd2IzTmxLSEJ2YzNSbmNtVnpkQzV5WlhGMVpYTjBWMmwwYUZSdmEyVnVMQ0JrWld4bGRHVlBjSFJwYjI1ektTeGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnZjSFJwYjI1ek9pQnZjSFJwYjI1elhHNGdJQ0FnSUNBZ0lDQWdJQ0I5TzF4dUlDQWdJQ0FnSUNCOU8xeHVYRzRnSUNBZ0lDQWdJSEpsZEhWeWJpQndiM04wWjNKbGMzUTdYRzRnSUNBZ2ZUdGNibHh1SUNBZ0lIQnZjM1JuY21WemRDNW1hV3gwWlhKelZrMGdQU0JtYVd4MFpYSnpWazA3WEc0Z0lDQWdjRzl6ZEdkeVpYTjBMbkJoWjJsdVlYUnBiMjVXVFNBOUlIQmhaMmx1WVhScGIyNVdUVHRjYmlBZ1hHNGdJQ0FnY21WMGRYSnVJSEJ2YzNSbmNtVnpkRHRjYm4xY2JseHVaWGh3YjNKMElHUmxabUYxYkhRZ1VHOXpkR2R5WlhOME8xeHVJbDBzSW01aGJXVnpJanBiSW1acGJIUmxjbk5XVFNJc0ltRjBkSEpwWW5WMFpYTWlMQ0p1WlhkV1RTSXNJbVpwYkhSbGNpSXNJbkJ5YjNBaUxDSnRJaXdpWm1sc2RHVnlVSEp2Y0NJc0luWmhiSFZsSWl3aVlYSm5kVzFsYm5Seklpd2liR1Z1WjNSb0lpd2lkRzlHYVd4MFpYSWlMQ0pmSWl3aWFYTlRkSEpwYm1jaUxDSjBjbWx0SWl3aVoyVjBkR1Z5Y3lJc0luSmxaSFZqWlNJc0ltMWxiVzhpTENKdmNHVnlZWFJ2Y2lJc0ltRjBkSElpTENKd1lYSmhiV1YwWlhKelYybDBhRzkxZEU5eVpHVnlJaXdpWjJWMGRHVnlJaXdpYVhOR2RXNWpkR2x2YmlJc0luVnVaR1ZtYVc1bFpDSXNJbkpsY0d4aFkyVWlMQ0pzZEdVaUxDSm5kR1VpTENKd2RYTm9JaXdpY0dGeVlXMWxkR1Z5Y3lJc0ltOXlaR1Z5SWl3aVpHbHlaV04wYVc5dUlpd2lhbTlwYmlJc0ltOXlaR1Z5VUdGeVlXMWxkR1Z5SWl3aVpYaDBaVzVrSWl3aWNHRm5hVzVoZEdsdmJsWk5JaXdpYlc5a1pXd2lMQ0psZUhSeVlVaGxZV1JsY25NaUxDSmhkWFJvWlc1MGFXTmhkR1VpTENKamIyeHNaV04wYVc5dUlpd2laR1ZtWVhWc2RFOXlaR1Z5SWl3aVptbHNkR1Z5Y3lJc0ltbHpURzloWkdsdVp5SXNJbkJoWjJVaUxDSnlaWE4xYkhSelEyOTFiblFpTENKd1lXZGxVbVZ4ZFdWemRDSXNJbWRsZEZCaFoyVlhhWFJvVkc5clpXNGlMQ0puWlhSUVlXZGxJaXdpZEc5MFlXd2lMQ0ptWlhSamFDSXNJbVFpTENKa1pXWmxjbkpsWkNJc0ltZGxkRlJ2ZEdGc0lpd2llR2h5SWl3aWMzUmhkSFZ6SWl3aVNsTlBUaUlzSW5OMGNtbHVaMmxtZVNJc0luSmhibWRsU0dWaFpHVnlJaXdpWjJWMFVtVnpjRzl1YzJWSVpXRmtaWElpTENKemNHeHBkQ0lzSW1obFlXUmxjbE5wZW1VaUxDSm9aV0ZrWlhKRGIzVnVkQ0lzSW1obFlXUmxja1p5YjIwaUxDSm9aV0ZrWlhKVWJ5SXNJblJ2SWl3aWNHRnljMlZKYm5RaUxDSm1jbTl0SWl3aWNtVnpjRzl1YzJWVVpYaDBJaXdpWlhnaUxDSjBhR1Z1SWl3aVpHRjBZU0lzSW5WdWFXOXVJaXdpY21WemIyeDJaU0lzSW5KbFpISmhkeUlzSW1WeWNtOXlJaXdpY21WcVpXTjBJaXdpY0hKdmJXbHpaU0lzSW1acGNuTjBVR0ZuWlNJc0ltbHpUR0Z6ZEZCaFoyVWlMQ0p3WVdkbFUybDZaU0lzSW01bGVIUlFZV2RsSWl3aVVHOXpkR2R5WlhOMElpd2ljRzl6ZEdkeVpYTjBJaXdpZEc5clpXNGlMQ0p0WlhKblpVTnZibVpwWnlJc0ltTnZibVpwWnlJc0ltOXdkR2x2Ym5NaUxDSmpiMjF3YjNObElpd2lZV1JrU0dWaFpHVnljeUlzSW1obFlXUmxjbk1pTENKbFlXTm9JaXdpYTJWNUlpd2ljMlYwVW1WeGRXVnpkRWhsWVdSbGNpSXNJbUZrWkVOdmJtWnBaMGhsWVdSbGNuTWlMQ0pqY21WaGRHVk1iMkZrWlhJaUxDSnlaWEYxWlhOMFJuVnVZM1JwYjI0aUxDSmtaV1poZFd4MFUzUmhkR1VpTENKc2IyRmtaWElpTENKc2IyRmtJaXdpY21Wd2NtVnpaVzUwWVhScGIyNUlaV0ZrWlhJaUxDSnBibWwwSWl3aVlYQnBVSEpsWm1sNElpd2lZWFYwYUdWdWRHbGpZWFJwYjI1UGNIUnBiMjV6SWl3aVoyeHZZbUZzU0dWaFpHVnlJaXdpY21WeGRXVnpkQ0lzSW1WeWNtOXlTR0Z1Wkd4bGNpSXNJbVY0ZEhKaFkzUWlMQ0oxY213aUxDSnlaWEYxWlhOMFYybDBhRlJ2YTJWdUlpd2ljR0Z5ZEdsaGJDSXNJbXh2WVdSbGNsZHBkR2hVYjJ0bGJpSXNJbTVoYldVaUxDSndZV2RwYm1GMGFXOXVTR1ZoWkdWeWN5SXNJblJ2VW1GdVoyVWlMQ0p1WVcxbFQzQjBhVzl1Y3lJc0ltZGxkRTl3ZEdsdmJuTWlMQ0p4ZFdWeWVYTjBjbWx1WnlJc0luSnZkWFJsSWl3aVluVnBiR1JSZFdWeWVWTjBjbWx1WnlJc0luQnZjM1JQY0hScGIyNXpJaXdpWkdWc1pYUmxUM0IwYVc5dWN5SXNJbkJoZEdOb1QzQjBhVzl1Y3lJc0ltZGxkRkJoWjJWUGNIUnBiMjV6SWl3aVoyVjBVbTkzVDNCMGFXOXVjeUpkTENKdFlYQndhVzVuY3lJNklqczdPenM3TzBGQlIwRXNTVUZCVFVFc1dVRkJXU3hUUVVGYVFTeFRRVUZaTEVOQlFVTkRMRlZCUVVRc1JVRkJaMEk3VVVGRE1VSkRMRkZCUVZFc1JVRkJXanRSUVVOSlF5eFRRVUZUTEZOQlFWUkJMRTFCUVZNc1IwRkJUVHRaUVVOTVF5eFBRVUZQUXl4RlFVRkZSQ3hKUVVGR0xFTkJRVThzUlVGQlVDeERRVUZpTzFsQlEwbEZMR0ZCUVdFc1UwRkJZa0VzVlVGQllTeERRVUZWUXl4TFFVRldMRVZCUVdsQ08yZENRVU4wUWtNc1ZVRkJWVU1zVFVGQlZpeEhRVUZ0UWl4RFFVRjJRaXhGUVVFd1FqdHhRa0ZEYWtKR0xFdEJRVXc3ZFVKQlEwOU1MRXRCUVZBN08yMUNRVVZIUlN4TlFVRlFPMU5CVGxJN08yMUNRVk5YVFN4UlFVRllMRWRCUVhOQ0xGbEJRVTA3YlVKQlEycENReXhGUVVGRlF5eFJRVUZHTEVOQlFWZE9MRmxCUVZnc1NVRkJNa0pCTEdGQlFXRlBMRWxCUVdJc1JVRkJNMElzUjBGQmFVUlFMRmxCUVhoRU8xTkJSRW83WlVGSFQwRXNWVUZCVUR0TFFXUlNPMUZCYVVKSlVTeFZRVUZWU0N4RlFVRkZTU3hOUVVGR0xFTkJRMDVrTEZWQlJFMHNSVUZEVFN4VlFVRkRaU3hKUVVGRUxFVkJRVTlETEZGQlFWQXNSVUZCYVVKRExFbEJRV3BDTEVWQlFUQkNPenM3TzFsQlNUbENSQ3hoUVVGaExGTkJRV3BDTEVWQlFUUkNPMmxDUVVOdVFrTXNTVUZCVEN4SlFVRmhPM0ZDUVVOS1ppeFJRVVJKTzNGQ1FVVktRVHRoUVVaVU8xTkJSRW9zVFVGTFR6dHBRa0ZEUldVc1NVRkJUQ3hKUVVGaFppeFJRVUZpT3p0bFFVVkhZU3hKUVVGUU8wdEJZa1VzUlVGalNEdGxRVU5SWWp0TFFXWk1MRU5CYWtKa08xRkJiME5KWjBJc2VVSkJRWGxDTEZOQlFYcENRU3h6UWtGQmVVSXNSMEZCVFR0bFFVTndRbElzUlVGQlJVa3NUVUZCUml4RFFVTklSQ3hQUVVSSExFVkJRMDBzVlVGQlEwVXNTVUZCUkN4RlFVRlBTU3hOUVVGUUxFVkJRV1ZHTEVsQlFXWXNSVUZCZDBJN1owSkJRM3BDUVN4VFFVRlRMRTlCUVdJc1JVRkJjMEk3YjBKQlExcEVMRmRCUVZkb1FpeFhRVUZYYVVJc1NVRkJXQ3hEUVVGcVFqczdiMEpCUlVsUUxFVkJRVVZWTEZWQlFVWXNRMEZCWVVRc1QwRkJUMVlzVVVGQmNFSXNUVUZCYTBOVkxFOUJRVTlXTEZGQlFWQXNUMEZCYzBKWkxGTkJRWFJDTEVsQlFXMURSaXhQUVVGUFZpeFJRVUZRTEU5QlFYTkNMRVZCUVROR0xFTkJRVW9zUlVGQmIwYzdNa0pCUTNwR1RTeEpRVUZRT3pzN096czdiMEpCVFVGRExHRkJRV0VzVDBGQllpeEpRVUYzUWtFc1lVRkJZU3hOUVVGNlF5eEZRVUZwUkR0NVFrRkRlRU5ETEVsQlFVd3NTVUZCWVVRc1YwRkJWeXhKUVVGWUxFZEJRV3RDUnl4UFFVRlBWaXhSUVVGUUxFVkJRV3hDTEVkQlFYTkRMRWRCUVc1RU8ybENRVVJLTEUxQlJVOHNTVUZCU1U4c1lVRkJZU3hKUVVGcVFpeEZRVUYxUWp0NVFrRkRja0pETEVsQlFVd3NTVUZCWVVRc1YwRkJWeXhIUVVGWUxFZEJRV2xDUnl4UFFVRlBWaXhSUVVGUUxFZEJRV3RDWVN4UFFVRnNRaXhEUVVFd1FpeE5RVUV4UWl4RlFVRnJReXhIUVVGc1F5eERRVUU1UWp0cFFrRkVSeXhOUVVWQkxFbEJRVWxPTEdGQlFXRXNVMEZCYWtJc1JVRkJORUk3ZDBKQlF6TkNMRU5CUVVOSExFOUJRVTlKTEVkQlFWQXNRMEZCVjJRc1VVRkJXQ3hGUVVGRUxFbEJRVEJDTEVOQlFVTlZMRTlCUVU5TExFZEJRVkFzUTBGQlYyWXNVVUZCV0N4RlFVRXZRaXhGUVVGelJEc3JRa0ZETTBOTkxFbEJRVkE3TzNsQ1FVVkRSU3hKUVVGTUxFbEJRV0VzUlVGQllqdDNRa0ZEU1VVc1QwRkJUMHNzUjBGQlVDeEZRVUZLTEVWQlFXdENPelpDUVVOVVVDeEpRVUZNTEVWQlFWZFJMRWxCUVZnc1EwRkJaMElzVTBGQlUwNHNUMEZCVDBzc1IwRkJVQ3hEUVVGWFppeFJRVUZZTEVWQlFYcENPenQzUWtGRlFWVXNUMEZCVDBrc1IwRkJVQ3hGUVVGS0xFVkJRV3RDT3paQ1FVTlVUaXhKUVVGTUxFVkJRVmRSTEVsQlFWZ3NRMEZCWjBJc1UwRkJVMDRzVDBGQlQwa3NSMEZCVUN4RFFVRlhaQ3hSUVVGWUxFVkJRWHBDT3p0cFFrRlVSQ3hOUVZkQkxFbEJRVWxQTEdGQlFXRXNVMEZCYWtJc1JVRkJORUk3ZVVKQlF6RkNReXhKUVVGTUxFbEJRV0ZGTEU5QlFVOVdMRkZCUVZBc1QwRkJjMElzU1VGQmRFSXNSMEZCTmtJc1UwRkJOMElzUjBGQmVVTXNZVUZCZEVRN2FVSkJSRWNzVFVGRlFUdDVRa0ZEUlZFc1NVRkJUQ3hKUVVGaFJDeFhRVUZYTEVkQlFWZ3NSMEZCYVVKSExFOUJRVTlXTEZGQlFWQXNSVUZCT1VJN096dHRRa0ZIUkUwc1NVRkJVRHRUUVdwRFJDeEZRV3REUVN4RlFXeERRU3hEUVVGUU8wdEJja05TTzFGQk1rVkpWeXhoUVVGaExGTkJRV0pCTEZWQlFXRXNSMEZCVFRzN08xbEJSMVJETEZGQlFWRXNVMEZCVWtFc1MwRkJVU3hIUVVGTk8yMUNRVU5VWkN4UlFVRlJZeXhMUVVGU0xFMUJRVzFDYWtJc1JVRkJSVWtzVFVGQlJpeERRVU4wUWtRc1VVRkJVV01zUzBGQlVpeEZRVVJ6UWl4RlFVTk1MRlZCUVVOYUxFbEJRVVFzUlVGQlQyRXNVMEZCVUN4RlFVRnJRbGdzU1VGQmJFSXNSVUZCTWtJN2NVSkJRMjVEVVN4SlFVRk1MRU5CUVZWU0xFOUJRVThzUjBGQlVDeEhRVUZoVnl4VFFVRjJRanQxUWtGRFQySXNTVUZCVUR0aFFVaHJRaXhGUVVsdVFpeEZRVXB0UWl4RlFVdDRRbU1zU1VGTWQwSXNRMEZMYmtJc1IwRk1iVUlzUTBGQk1VSTdVMEZFU2p0WlFWTkpReXhwUWtGQmFVSklMRlZCUVZVN2JVSkJRMmhDUVR0VFFVUk5MRWRCUldJc1JVRllVanM3WlVGaFQycENMRVZCUVVWeFFpeE5RVUZHTEVOQlFWTXNSVUZCVkN4RlFVRmhSQ3hqUVVGaUxFVkJRVFpDV2l4M1FrRkJOMElzUTBGQlVEdExRVE5HVWpzN1YwRXJSazlTTEVWQlFVVnhRaXhOUVVGR0xFTkJRVk01UWl4TFFVRlVMRVZCUVdkQ1dTeFBRVUZvUWl4RlFVRjVRanR2UWtGRGFFSmhMRlZCUkdkQ08yZERRVVZLVWp0TFFVWnlRaXhEUVVGUU8wTkJhRWRLT3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPMEZEUVVFc1NVRkJUV01zWlVGQlpTeFRRVUZtUVN4WlFVRmxMRU5CUVVORExFdEJRVVFzUlVGQlVVNHNTMEZCVWl4RlFVRXdSRHRSUVVFelEwOHNXVUZCTWtNc2RVVkJRVFZDTEVWQlFUUkNPMUZCUVhoQ1F5eFpRVUYzUWl4MVJVRkJWQ3hKUVVGVE96dFJRVU4yUlVNc1lVRkJZV2hETEVWQlFVVkVMRWxCUVVZc1EwRkJUeXhGUVVGUUxFTkJRV3BDTzFGQlEwbHJReXhsUVVGbFZpeFRRVUZUTEZOQlJEVkNPMUZCUlVsWExGVkJRVlZzUXl4RlFVRkZSQ3hKUVVGR0xFTkJRVTg3WlVGRFRtdERPMHRCUkVRc1EwRkdaRHRSUVV0SlJTeFpRVUZaYmtNc1JVRkJSVVFzU1VGQlJpeERRVUZQTEV0QlFWQXNRMEZNYUVJN1VVRk5TWEZETEU5QlFVOXdReXhGUVVGRlJDeEpRVUZHTEVOQlFVOHNRMEZCVUN4RFFVNVlPMUZCVDBselF5eGxRVUZsY2tNc1JVRkJSVVFzU1VGQlJpeEZRVkJ1UWp0UlFWRkpkVU1zWTBGQlkxQXNaVUZCWlVZc1RVRkJUVlVzWjBKQlFYSkNMRWRCUVhkRFZpeE5RVUZOVnl4UFFWSm9SVHRSUVZOSlF5eFJRVUZSZWtNc1JVRkJSVVFzU1VGQlJpeEZRVlJhT3p0UlFWZE5Na01zVVVGQlVTeFRRVUZTUVN4TFFVRlJMRWRCUVUwN1dVRkRXa01zU1VGQlNUTkRMRVZCUVVVMFF5eFJRVUZHTEVWQlFWSTdXVUZEVFVNc1YwRkJWeXhUUVVGWVFTeFJRVUZYTEVOQlFVTkRMRWRCUVVRc1JVRkJVenRuUWtGRGJFSXNRMEZCUTBFc1IwRkJSQ3hKUVVGUlFTeEpRVUZKUXl4TlFVRktMRXRCUVdVc1EwRkJNMElzUlVGQk9FSTdkVUpCUTI1Q1F5eExRVUZMUXl4VFFVRk1MRU5CUVdVN01FSkJRMW9zU1VGRVdUczJRa0ZGVkN4SlFVWlRPekJDUVVkYUxFTkJTRms3TmtKQlNWUTdhVUpCU2s0c1EwRkJVRHM3WjBKQlQwRkRMR05CUVdOS0xFbEJRVWxMTEdsQ1FVRktMRU5CUVhOQ0xHVkJRWFJDTEVOQlFXeENPMmRDUVVOSk4wTXNSVUZCUlVNc1VVRkJSaXhEUVVGWE1rTXNWMEZCV0N4RFFVRktMRVZCUVRaQ08zbERRVU5QUVN4WlFVRlpSU3hMUVVGYUxFTkJRV3RDTEVkQlFXeENMRU5CUkZBN08yOUNRVU53UWtNc1ZVRkViMEk3YjBKQlExSkRMRmRCUkZFN2QwTkJSVWxFTEZkQlFWZEVMRXRCUVZnc1EwRkJhVUlzUjBGQmFrSXNRMEZHU2pzN2IwSkJSWEJDUnl4VlFVWnZRanR2UWtGRlVrTXNVVUZHVVR0dlFrRkhja0pETEVWQlNIRkNMRWRCUjJoQ1F5eFRRVUZUUml4UlFVRlVMRWxCUVhGQ0xFTkJRWEpDTEVsQlFUQkNMRU5CU0ZZN2IwSkJTWEpDUnl4SlFVcHhRaXhIUVVsa1JDeFRRVUZUU0N4VlFVRlVMRXRCUVhsQ0xFTkJTbGc3TzNOQ1FVMXVRa2NzVTBGQlUwb3NWMEZCVkN4RFFVRk9PelpDUVVOaFJ5eExRVUZMUlN4SlFVRnNRanM3WjBKQlJVRTdkVUpCUlU5aUxFbEJRVWxqTEZsQlFWZzdZVUZHU2l4RFFVZEZMRTlCUVU5RExFVkJRVkFzUlVGQlZ6dDFRa0ZEUm1Jc1MwRkJTME1zVTBGQlRDeERRVUZsT3pCQ1FVTmFMRWxCUkZrN05rSkJSVlFzU1VGR1V6c3dRa0ZIV2l4RFFVaFpPelpDUVVsVVNDeEpRVUZKWXp0cFFrRktWaXhEUVVGUU96dFRRWFpDVWp0clFrRXJRbFVzU1VGQlZqdHZRa0ZEV1RGQ0xGTkJRVm9zUlVGQmRVSkZMRTFCUVhaQ0xFVkJRU3RDTzNkQ1FVTm1MRWxCUkdVN2NVSkJSV3hDVXp0VFFVWmlMRVZCUjBkbUxGbEJTRWdzUlVGSGFVSm5ReXhKUVVocVFpeERRVWR6UWl4VlFVRkRReXhKUVVGRUxFVkJRVlU3ZFVKQlEycENla1FzUlVGQlJUQkVMRXRCUVVZc1EwRkJVV2hETEZsQlFWSXNSVUZCYzBJclFpeEpRVUYwUWl4RFFVRllPM05DUVVOVkxFdEJRVlk3WTBGRFJVVXNUMEZCUml4RFFVRlZha01zV1VGQlZqdGpRVU5GYTBNc1RVRkJSanRUUVZCS0xFVkJVVWNzVlVGQlEwTXNTMEZCUkN4RlFVRlhPM05DUVVOQkxFdEJRVlk3YTBKQlEwMHNRMEZCVGp0alFVTkZReXhOUVVGR0xFTkJRVk5FTEV0QlFWUTdZMEZEUlVRc1RVRkJSanRUUVZwS08yVkJZMDkyUWl4RlFVRkZNRUlzVDBGQlZEdExRV2hFU2p0UlFXMUVRVU1zV1VGQldTeFRRVUZhUVN4VFFVRlpMRU5CUVVOb1JDeFZRVUZFTEVWQlFXZENPMmRDUVVOb1FtaENMRVZCUVVWeFFpeE5RVUZHTEVOQlFWTTdiVUpCUTA1Tk8xTkJSRWdzUlVGRlRGZ3NWVUZHU3l4RFFVRlNPMjFDUVVkWExFVkJRVmc3WVVGRFN5eERRVUZNTzJWQlEwOXZRaXhQUVVGUU8wdEJla1JLTzFGQk5FUkJOa0lzWVVGQllTeFRRVUZpUVN4VlFVRmhMRWRCUVUwN1pVRkRVREZETEUxQlFVMHlReXhSUVVGT0xFdEJRVzFDYmtNc1kwRkJNMEk3UzBFM1JFbzdVVUZuUlVGdlF5eFhRVUZYTEZOQlFWaEJMRkZCUVZjc1IwRkJUVHRoUVVOU2NrTXNVMEZCVXl4RFFVRmtPMlZCUTA5TkxFOUJRVkE3UzBGc1JVbzdPMWRCY1VWUE8yOUNRVU5UVml4VlFVUlVPMjFDUVVWUmMwTXNVMEZHVWp0dFFrRkhVVzVETEZOQlNGSTdhMEpCU1U5elF5eFJRVXBRTzI5Q1FVdFRSaXhWUVV4VU8yVkJUVWs1UWl4TFFVNUtPM05DUVU5WFNqdExRVkJzUWp0RFFXcEdTanM3UVVORlFTeFRRVUZUY1VNc1UwRkJWQ3hIUVVGelFqdFJRVU5rUXl4WlFVRlpMRVZCUVdoQ096dFJRVVZOUXl4UlFVRlJOVVVzUlVGQlJVUXNTVUZCUml4RlFVRmtPMUZCUlUwNFJTeGpRVUZqTEZOQlFXUkJMRmRCUVdNc1EwRkJRME1zVFVGQlJDeEZRVUZUUXl4UFFVRlVMRVZCUVhGQ08yVkJRM2hDUVN4WFFVRlhla1VzUlVGQlJWVXNWVUZCUml4RFFVRmhLMFFzVVVGQlVVUXNUVUZCY2tJc1EwRkJXQ3hIUVVFd1EzaEZMRVZCUVVVd1JTeFBRVUZHTEVOQlFWVkVMRkZCUVZGRUxFMUJRV3hDTEVWQlFUQkNRU3hOUVVFeFFpeERRVUV4UXl4SFFVRTRSVUVzVFVGQmNrWTdTMEZJVmp0UlFVMU5SeXhoUVVGaExGTkJRV0pCTEZWQlFXRXNRMEZCUTBNc1QwRkJSQ3hGUVVGaE8yVkJRMllzVlVGQlEzQkRMRWRCUVVRc1JVRkJVenRqUVVOV2NVTXNTVUZCUml4RFFVRlBSQ3hQUVVGUUxFVkJRV2RDTEZWQlFVTm9SaXhMUVVGRUxFVkJRVkZyUml4SFFVRlNMRVZCUVdkQ08yOUNRVU40UWtNc1owSkJRVW9zUTBGQmNVSkVMRWRCUVhKQ0xFVkJRVEJDYkVZc1MwRkJNVUk3WVVGRVNqdHRRa0ZIVHpSRExFZEJRVkE3VTBGS1NqdExRVkJXTzFGQlpVMTNReXh0UWtGQmJVSXNVMEZCYmtKQkxHZENRVUZ0UWl4RFFVRkRTaXhQUVVGRUxFVkJRVlZJTEU5QlFWWXNSVUZCYzBJN1pVRkRPVUo2UlN4RlFVRkZjVUlzVFVGQlJpeERRVUZUTEVWQlFWUXNSVUZCWVc5RUxFOUJRV0lzUlVGQmMwSTdiMEpCUTJwQ1JpeFpRVUZaU1N4WFFVRlhReXhQUVVGWUxFTkJRVm9zUlVGQmFVTklMRTlCUVdwRE8xTkJSRXdzUTBGQlVEdExRV2hDVmp0UlFYRkNUVkVzWlVGQlpTeFRRVUZtUVN4WlFVRmxMRU5CUVVORExHVkJRVVFzUlVGQmEwSlVMRTlCUVd4Q0xFVkJRVzlFTzFsQlFYcENWU3haUVVGNVFpeDFSVUZCVml4TFFVRlZPenRaUVVONlJFTXNVMEZCVXpGR0xFVkJRVVZFTEVsQlFVWXNRMEZCVHpCR0xGbEJRVkFzUTBGQlpqdFpRVU5OT1VNc1NVRkJTVE5ETEVWQlFVVTBReXhSUVVGR0xFVkJSRlk3WlVGRlR5dERMRWxCUVZBc1IwRkJZeXhaUVVGTk8yMUNRVU5VTEVsQlFWQTdZMEZEUlhwQ0xFMUJRVVk3TkVKQlEyZENOVVFzUlVGQlJYRkNMRTFCUVVZc1EwRkJVeXhGUVVGVUxFVkJRV0Z2UkN4UFFVRmlMRVZCUVhOQ096UkNRVU4wUWp0aFFVUkJMRU5CUVdoQ0xFVkJSVWxxUWl4SlFVWktMRU5CUlZNc1ZVRkJRME1zU1VGQlJDeEZRVUZWTzNWQ1FVTlNMRXRCUVZBN2EwSkJRMFZGTEU5QlFVWXNRMEZCVlVZc1NVRkJWanRyUWtGRFJVY3NUVUZCUmp0aFFVeEtMRVZCVFVjc1ZVRkJRME1zUzBGQlJDeEZRVUZYTzNWQ1FVTklMRXRCUVZBN2EwSkJRMFZETEUxQlFVWXNRMEZCVTBRc1MwRkJWRHRyUWtGRFJVUXNUVUZCUmp0aFFWUktPMjFDUVZkUGRrSXNSVUZCUlRCQ0xFOUJRVlE3VTBGa1NqdGxRV2RDVDNGQ0xFMUJRVkE3UzBGNFExWTdVVUV5UTAxRkxIVkNRVUYxUWp0clFrRkRWRHRMUVRWRGNFSTdPMk5CSzBOVmFFSXNTMEZCVml4SFFVRnJRa0VzUzBGQmJFSTdPMk5CUlZWcFFpeEpRVUZXTEVkQlFXbENMRlZCUVVORExGTkJRVVFzUlVGQldVTXNjVUpCUVZvc1JVRkJlVVE3V1VGQmRFSkRMRmxCUVhOQ0xIVkZRVUZRTEVWQlFVODdPMnRDUVVNMVJFTXNUMEZCVml4SFFVRnZRaXhWUVVGRGJFSXNUMEZCUkN4RlFVRmhPMmRDUVVOMlFtMUNMR1ZCUVdVc1UwRkJaa0VzV1VGQlpTeERRVUZEY0VRc1IwRkJSQ3hGUVVGVE8yOUNRVU4wUWpzeVFrRkZUMEVzU1VGQlNXTXNXVUZCV0R0cFFrRkdTaXhEUVVkRkxFOUJRVTlETEVWQlFWQXNSVUZCVnpzeVFrRkRSbUlzUzBGQlMwTXNVMEZCVEN4RFFVRmxPemhDUVVOYUxFbEJSRms3YVVOQlJWUXNTVUZHVXpzNFFrRkhXaXhEUVVoWk8ybERRVWxVU0N4SlFVRkpZenR4UWtGS1ZpeERRVUZRT3p0aFFVeFNPMjFDUVdGUE5VUXNSVUZCUldsSExFOUJRVVlzUTBGRFNGZ3NhVUpCUVdsQ1ZTeFpRVUZxUWl4RlFVTkpNVVlzUlVGQlJYRkNMRTFCUVVZc1EwRkJVeXhGUVVGRGQwVXNVMEZCVTBRc1dVRkJWaXhGUVVGVUxFVkJRV3REYmtJc1QwRkJiRU1zUlVGQk1rTTdjVUpCUTJ4RFpTeFpRVUZaWml4UlFVRlJjVUk3WVVGRU4wSXNRMEZFU2l4RFFVUkhMRU5CUVZBN1UwRmtTanM3YTBKQmRVSlZja1VzV1VGQlZpeEhRVUY1UWl4WlFVRk5PMmRDUVVOeVFtRXNWMEZCVnpWRExFVkJRVVUwUXl4UlFVRkdMRVZCUVdwQ08yZENRVU5KWjBNc1QwRkJTaXhGUVVGaE8zbENRVU5CV0N4UFFVRlVMRU5CUVdsQ096SkNRVU5PVnp0cFFrRkVXRHRoUVVSS0xFMUJTVTg3YTBKQlEwUnhRaXhQUVVGR0xFTkJRVlV6Uml4RlFVRkZjVUlzVFVGQlJpeERRVUZUTEVWQlFWUXNSVUZCWVc5RkxIRkNRVUZpTEVOQlFWWXNSVUZCSzBOcVF5eEpRVUV2UXl4RFFVRnZSQ3hWUVVGRFF5eEpRVUZFTEVWQlFWVTdNRUpCUTNCRVFTeExRVUZMWVN4TFFVRllPelpDUVVOVFdDeFBRVUZVTEVOQlFXbENPeXRDUVVOT1Z6dHhRa0ZFV0R0cFFrRkdTaXhGUVV0SExGVkJRVU5pTEVsQlFVUXNSVUZCVlRzMlFrRkRRVXNzVFVGQlZDeERRVUZuUWt3c1NVRkJhRUk3YVVKQlRrbzdPMjFDUVZOSGJrSXNVMEZCVTNsQ0xFOUJRV2hDTzFOQmFFSktPenRyUWtGdFFsVm5ReXhuUWtGQlZpeEhRVUUyUWl4VlFVRkRkRUlzVDBGQlJDeEZRVUZoTzIxQ1FVTXZRa29zVlVGQlZUVkRMRmxCUVZZc1IwRkJlVUlyUWl4SlFVRjZRaXhEUVVOSUxGbEJRVTA3ZFVKQlEwdGhMRlZCUVZWelFpeFBRVUZXTEVOQlFXdENXQ3hwUWtGQmFVSTdjVU5CUTNKQ0xGbEJRVmxXTzJsQ1FVUlNMRVZCUlhSQ1J5eFBRVVp6UWl4RFFVRnNRaXhEUVVGUU8yRkJSa1FzUlVGTFFTeFpRVUZOTzNWQ1FVTkZTaXhWUVVGVmMwSXNUMEZCVml4RFFVRnJRbXhDTEU5QlFXeENMRU5CUVZBN1lVRk9SQ3hEUVVGUU8xTkJSRW83TzJ0Q1FWbFZWeXhOUVVGV0xFZEJRVzFDY0VZc1JVRkJSV2RITEU5QlFVWXNRMEZCVldZc1dVRkJWaXhGUVVGM1Fsb3NWVUZCVlhOQ0xFOUJRV3hETEVOQlFXNUNPenRyUWtGRlZVMHNaVUZCVml4SFFVRTBRbXBITEVWQlFVVm5SeXhQUVVGR0xFTkJRVlZtTEZsQlFWWXNSVUZCZDBKYUxGVkJRVlV3UWl4blFrRkJiRU1zUTBGQk5VSTdPMnRDUVVWVmVFVXNTMEZCVml4SFFVRnJRaXhWUVVGRE1rVXNTVUZCUkN4RlFVRlZPMmRDUVVOc1FrTXNiMEpCUVc5Q0xGTkJRWEJDUVN4cFFrRkJiMElzUTBGQlEzSkZMRWxCUVVRc1JVRkJUMjlETEZGQlFWQXNSVUZCYjBJN2IwSkJRM1JETEVOQlFVTkJMRkZCUVV3c1JVRkJaVHM3T3p0dlFrRkpWR3RETEZWQlFWVXNVMEZCVmtFc1QwRkJWU3hIUVVGTk8zZENRVU5hTDBNc1QwRkJUeXhEUVVGRGRrSXNUMEZCVHl4RFFVRlNMRWxCUVdGdlF5eFJRVUV4UWp0M1FrRkRUV1lzUzBGQlMwVXNUMEZCVDJFc1VVRkJVQ3hIUVVGclFpeERRVVEzUWpzeVFrRkZUMklzVDBGQlR5eEhRVUZRTEVkQlFXRkdMRVZCUVhCQ08ybENRVWhLT3p0MVFrRk5UenRyUTBGRFZ5eFBRVVJZT3paQ1FVVk5hVVE3YVVKQlJtSTdZVUZZU2p0blFrRnBRazFzUXl4WFFVRlhlRVVzUlVGQlJVUXNTVUZCUml4RFFVRlBMRVZCUVZBc1EwRnFRbXBDTzJkQ1FXMUNUVFJITEdOQlFXTTdjVUpCUTB3c1RVRkJUVWc3WVVGd1FuSkNPMmRDUVhWQ1RVa3NZVUZCWVN4VFFVRmlRU3hWUVVGaExFTkJRVU0zUXl4SlFVRkVMRVZCUVU4elFpeEpRVUZRTEVWQlFXRnZReXhSUVVGaUxFVkJRWFZDVHl4UFFVRjJRaXhGUVVGcFJEdHZRa0ZCYWtKSExFOUJRV2xDTEhWRlFVRlFMRVZCUVU4N08yOUNRVU53UkhCRUxHVkJRV1Y0UWl4RlFVRkZjVUlzVFVGQlJpeERRVUZUTEVWQlFWUXNSVUZCWVRzNFFrRkRjRUk3YVVKQlJFOHNSVUZGYkVKMVJDeFBRVVpyUWl4RlFVVlVkVUlzYTBKQlFXdENja1VzU1VGQmJFSXNSVUZCZDBKdlF5eFJRVUY0UWl4RFFVWlRMRU5CUVhKQ08zVkNRVWRQWXl4cFFrRkJhVUo0UkN4WlFVRnFRaXhGUVVFclFuaENMRVZCUVVWeFFpeE5RVUZHTEVOQlFWTXNSVUZCVkN4RlFVRmhiMFFzVDBGQllpeEZRVUZ6UWpSQ0xGZEJRWFJDTEVWQlFXMURPelJDUVVNM1JDeExRVVEyUkRzd1FrRkZMMFExUXp0cFFrRkdORUlzUTBGQkwwSXNRMEZCVUR0aFFUTkNWanRuUWtGcFEwMDRReXhqUVVGakxGTkJRV1JCTEZkQlFXTXNRMEZCUXpORkxFOUJRVVFzUlVGQlZUWkRMRTlCUVZZc1JVRkJjMEk3ZDBKQlEzaENjVUlzUjBGQlVpeEpRVUZsTEUxQlFVMXdSeXhGUVVGRk9FY3NTMEZCUml4RFFVRlJReXhuUWtGQlVpeERRVUY1UWpkRkxFOUJRWHBDTEVOQlFYSkNPM1ZDUVVOUE5rTXNUMEZCVUR0aFFXNURWanRuUWtGelEwMUJMRlZCUVZVc2FVSkJRVU5CTEZGQlFVUXNSVUZCWVR0MVFrRkRXa29zVlVGQlZYTkNMRTlCUVZZc1EwRkJhMEl6Uml4RlFVRkZjVUlzVFVGQlJpeERRVUZUTEVWQlFWUXNSVUZCWVc5RUxGRkJRV0lzUlVGQmMwSTBRaXhYUVVGMFFpeEZRVUZ0UXpzMFFrRkRhRVE3YVVKQlJHRXNRMEZCYkVJc1EwRkJVRHRoUVhaRFZqdG5Ra0UwUTAxTExHTkJRV01zVTBGQlpFRXNWMEZCWXl4RFFVRkRjRWdzVlVGQlJDeEZRVUZoYlVZc1QwRkJZaXhGUVVGMVF6dHZRa0ZCYWtKSExFOUJRV2xDTEhWRlFVRlFMRVZCUVU4N08yOUNRVU16UTNCRUxHVkJRV1Y0UWl4RlFVRkZjVUlzVFVGQlJpeERRVUZUTEVWQlFWUXNSVUZCWVdsRkxHOUNRVUZpTEVWQlFXMURWaXhQUVVGdVF5eERRVUZ5UWp0MVFrRkRUMGtzYVVKQlEwaDRSQ3haUVVSSExFVkJSVWg0UWl4RlFVRkZjVUlzVFVGQlJpeERRVUZUTEVWQlFWUXNSVUZEVTI5RUxFOUJSRlFzUlVGRlV6UkNMRmRCUmxRc1JVRkZjMEk3TkVKQlEwUXNUVUZFUXpzd1FrRkZTQzlITzJsQ1FVcHVRaXhEUVVaSExFTkJRVkE3WVVFNVExWTdaMEpCTUVSTmNVZ3NaMEpCUVdkQ0xGTkJRV2hDUVN4aFFVRm5RaXhEUVVGREwwVXNUMEZCUkN4RlFVRlZOa01zVDBGQlZpeEZRVUZ2UXp0dlFrRkJha0pITEU5QlFXbENMSFZGUVVGUUxFVkJRVTg3TzI5Q1FVTXhRM0JFTEdWQlFXVjRRaXhGUVVGRmNVSXNUVUZCUml4RFFVRlRMRVZCUVZRc1JVRkJZV2xGTEc5Q1FVRmlMRVZCUVcxRFZpeFBRVUZ1UXl4RFFVRnlRanQxUWtGRFR6SkNMRmxCUVZrelJTeFBRVUZhTEVWQlFYRkNiMFFzYVVKQlFXbENlRVFzV1VGQmFrSXNSVUZCSzBKNFFpeEZRVUZGY1VJc1RVRkJSaXhEUVVGVExFVkJRVlFzUlVGQllXOUVMRTlCUVdJc1JVRkJjMEkwUWl4WFFVRjBRaXhGUVVGdFF6czBRa0ZEYkVZN2FVSkJSQ3RETEVOQlFTOUNMRU5CUVhKQ0xFTkJRVkE3WVVFMVJGWTdaMEpCYVVWTlR5eGxRVUZsTEZOQlFXWkJMRmxCUVdVc1EwRkJRMmhHTEU5QlFVUXNSVUZCVlhSRExGVkJRVllzUlVGQmMwSnRSaXhQUVVGMFFpeEZRVUZuUkR0dlFrRkJha0pITEU5QlFXbENMSFZGUVVGUUxFVkJRVTg3TzI5Q1FVTnlSSEJFTEdWQlFXVjRRaXhGUVVGRmNVSXNUVUZCUml4RFFVRlRMRVZCUVZRc1JVRkJZV2xGTEc5Q1FVRmlMRVZCUVcxRFZpeFBRVUZ1UXl4RFFVRnlRanQxUWtGRFR6SkNMRmxCUTBnelJTeFBRVVJITEVWQlJVaHZSQ3hwUWtGRFNYaEVMRmxCUkVvc1JVRkZTWGhDTEVWQlFVVnhRaXhOUVVGR0xFTkJRVk1zUlVGQlZDeEZRVU5UYjBRc1QwRkVWQ3hGUVVWVE5FSXNWMEZHVkN4RlFVVnpRanMwUWtGRFJDeFBRVVJET3pCQ1FVVklMMGM3YVVKQlNtNUNMRU5CUmtvc1EwRkdSeXhEUVVGUU8yRkJia1ZXTzJkQ1FXdEdUWFZJTEdsQ1FVRnBRaXhUUVVGcVFrRXNZMEZCYVVJc1EwRkJRM0JFTEVsQlFVUXNSVUZCVHpOQ0xFbEJRVkFzUlVGQllUSkRMRTlCUVdJc1JVRkJkVU03YjBKQlFXcENSeXhQUVVGcFFpeDFSVUZCVUN4RlFVRlBPenQxUWtGRE4wTXdRaXhYUVVGWE4wTXNTVUZCV0N4RlFVRnJRak5DTEZGQlFWRXNRMEZCTVVJc1JVRkJPRUp2UXl4VlFVRTVRaXhGUVVFd1EwOHNUMEZCTVVNc1JVRkJiVVJITEU5QlFXNUVMRU5CUVZBN1lVRnVSbFk3WjBKQmMwWk5hME1zWjBKQlFXZENMRk5CUVdoQ1FTeGhRVUZuUWl4RFFVRkRja1FzU1VGQlJDeEZRVUZQWjBJc1QwRkJVQ3hGUVVGcFF6dHZRa0ZCYWtKSExFOUJRV2xDTEhWRlFVRlFMRVZCUVU4N08zVkNRVU4wUXpCQ0xGZEJRVmMzUXl4SlFVRllMRVZCUVdsQ0xFTkJRV3BDTEVWQlFXOUNMRU5CUVhCQ0xFVkJRWFZDWjBJc1QwRkJka0lzUlVGQlowTkhMRTlCUVdoRExFTkJRVkE3WVVGMlJsWTdPMjFDUVRCR1R6c3dRa0ZEVDFZc1VVRkVVRHRuUTBGRllUSkRMR05CUm1JN0swSkJSMWxETEdGQlNGbzdPRUpCU1ZkR0xGbEJTbGc3TmtKQlMxVkdMRmRCVEZZN0swSkJUVmxETEdGQlRsbzdlVUpCVDAwelJ5eEZRVUZGTUVVc1QwRkJSaXhEUVVGVlRDeFZRVUZWYzBJc1QwRkJjRUlzUlVGQk5rSnJRaXhqUVVFM1FpeERRVkJPTzNkQ1FWRkxOMGNzUlVGQlJUQkZMRTlCUVVZc1EwRkJWVXdzVlVGQlZYTkNMRTlCUVhCQ0xFVkJRVFpDYlVJc1lVRkJOMElzUTBGU1REdDFRa0ZUU1RsSExFVkJRVVV3UlN4UFFVRkdMRU5CUVZWTUxGVkJRVlZ6UWl4UFFVRndRaXhGUVVFMlFtbENMRmxCUVRkQ0xFTkJWRW83YzBKQlZVYzFSeXhGUVVGRk1FVXNUMEZCUml4RFFVRlZUQ3hWUVVGVmMwSXNUMEZCY0VJc1JVRkJOa0psTEZkQlFUZENMRU5CVmtnN0swSkJWMWt4Unl4RlFVRkZNRVVzVDBGQlJpeERRVUZWVEN4VlFVRlZjMElzVDBGQmNFSXNSVUZCTmtKblFpeGhRVUUzUWl4RFFWaGFPMnREUVZsbE0wY3NSVUZCUlRCRkxFOUJRVVlzUTBGQlZVd3NWVUZCVlRCQ0xHZENRVUZ3UWl4RlFVRnpRMk1zWTBGQmRFTXNRMEZhWmp0cFEwRmhZemRITEVWQlFVVXdSU3hQUVVGR0xFTkJRVlZNTEZWQlFWVXdRaXhuUWtGQmNFSXNSVUZCYzBObExHRkJRWFJETEVOQlltUTdaME5CWTJFNVJ5eEZRVUZGTUVVc1QwRkJSaXhEUVVGVlRDeFZRVUZWTUVJc1owSkJRWEJDTEVWQlFYTkRZU3haUVVGMFF5eERRV1JpT3l0Q1FXVlpOVWNzUlVGQlJUQkZMRTlCUVVZc1EwRkJWVXdzVlVGQlZUQkNMR2RDUVVGd1FpeEZRVUZ6UTFjc1YwRkJkRU1zUTBGbVdqdHBRMEZuUW1NeFJ5eEZRVUZGTUVVc1QwRkJSaXhEUVVGVlRDeFZRVUZWTUVJc1owSkJRWEJDTEVWQlFYTkRXU3hoUVVGMFF5eERRV2hDWkR0NVFrRnBRazFzUXp0aFFXcENZanRUUVROR1NqczdaVUZuU0U5S0xGTkJRVkE3UzBFelMwbzdPMk5CT0V0VmFFWXNVMEZCVml4SFFVRnpRa0VzVTBGQmRFSTdZMEZEVldsRExGbEJRVllzUjBGQmVVSkJMRmxCUVhwQ096dFhRVVZQSzBNc1UwRkJVRHM3T3pzN096czdPeUo5In0=
