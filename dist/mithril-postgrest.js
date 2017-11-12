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

}(m,_));
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjLyoqLyouanMiLCJzb3VyY2VzIjpbInNyYy92bXMvZmlsdGVyc1ZNLmpzIiwic3JjL3Ztcy9wYWdpbmF0aW9uVk0uanMiLCJzcmMvcG9zdGdyZXN0LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBtIGZyb20gJ21pdGhyaWwnO1xuaW1wb3J0IF8gZnJvbSAndW5kZXJzY29yZSc7XG5cbmNvbnN0IGZpbHRlcnNWTSA9IChhdHRyaWJ1dGVzKSA9PiB7XG4gICAgbGV0IG5ld1ZNID0ge30sXG4gICAgICAgIGZpbHRlciA9ICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHByb3AgPSBtLnByb3AoJycpLFxuICAgICAgICAgICAgICAgIGZpbHRlclByb3AgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wKHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXdWTTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcHJvcCgpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAvLyBKdXN0IHNvIHdlIGNhbiBoYXZlIGEgZGVmYXVsdCB0b19maWx0ZXIgYW5kIGF2b2lkIGlmIF8uaXNGdW5jdGlvbiBjYWxsc1xuICAgICAgICAgICAgZmlsdGVyUHJvcC50b0ZpbHRlciA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gXy5pc1N0cmluZyhmaWx0ZXJQcm9wKCkpID8gZmlsdGVyUHJvcCgpLnRyaW0oKSA6IGZpbHRlclByb3AoKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXR1cm4gZmlsdGVyUHJvcDtcbiAgICAgICAgfSxcblxuICAgICAgICBnZXR0ZXJzID0gXy5yZWR1Y2UoXG4gICAgICAgICAgICBhdHRyaWJ1dGVzLCAobWVtbywgb3BlcmF0b3IsIGF0dHIpID0+IHtcbiAgICAgICAgICAgICAgICAvLyBUaGUgb3BlcmF0b3IgYmV0d2VlbiBpcyBpbXBsZW1lbnRlZCB3aXRoIHR3byBwcm9wZXJ0aWVzLCBvbmUgZm9yIGdyZWF0ZXIgdGhhbiB2YWx1ZSBhbmQgYW5vdGhlciBmb3IgbGVzc2VyIHRoYW4gdmFsdWUuXG4gICAgICAgICAgICAgICAgLy8gQm90aCBwcm9wZXJ0aWVzIGFyZSBzZW50IGluIHRoZSBxdWV1cnlzdHJpbmcgd2l0aCB0aGUgc2FtZSBuYW1lLFxuICAgICAgICAgICAgICAgIC8vIHRoYXQncyB3aHkgd2UgbmVlZCB0aGUgc3BlY2lhbCBjYXNlIGhlcmUsIHNvIHdlIGNhbiB1c2UgYSBzaW1wbGUgbWFwIGFzIGFyZ3VtZW50IHRvIGZpbHRlcnNWTS5cbiAgICAgICAgICAgICAgICBpZiAob3BlcmF0b3IgPT09ICdiZXR3ZWVuJykge1xuICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbHRlOiBmaWx0ZXIoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGd0ZTogZmlsdGVyKClcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gZmlsdGVyKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICAgIG9yZGVyOiBmaWx0ZXIoKVxuICAgICAgICAgICAgfVxuICAgICAgICApLFxuXG4gICAgICAgIHBhcmFtZXRlcnNXaXRob3V0T3JkZXIgPSAoKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gXy5yZWR1Y2UoXG4gICAgICAgICAgICAgICAgZ2V0dGVycywgKG1lbW8sIGdldHRlciwgYXR0cikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXR0ciAhPT0gJ29yZGVyJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3BlcmF0b3IgPSBhdHRyaWJ1dGVzW2F0dHJdO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoXy5pc0Z1bmN0aW9uKGdldHRlci50b0ZpbHRlcikgJiYgKGdldHRlci50b0ZpbHRlcigpID09PSB1bmRlZmluZWQgfHwgZ2V0dGVyLnRvRmlsdGVyKCkgPT09ICcnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBCZWxsb3cgd2UgdXNlIGRpZmZlcmVudCBmb3JtYXR0aW5nIHJ1bGVzIGZvciB0aGUgdmFsdWUgZGVwZW5kaW5nIG9uIHRoZSBvcGVyYXRvclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVGhlc2UgcnVsZXMgYXJlIHVzZWQgcmVnYXJkbGVzcyBvZiB0aGUgdG9GaWx0ZXIgZnVuY3Rpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBzbyB0aGUgdXNlciBjYW4gdXNlIGEgY3VzdG9tIHRvRmlsdGVyIHdpdGhvdXQgaGF2aW5nIHRvIHdvcnJ5IHdpdGggYmFzaWMgZmlsdGVyIHN5bnRheFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9wZXJhdG9yID09PSAnaWxpa2UnIHx8IG9wZXJhdG9yID09PSAnbGlrZScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZW1vW2F0dHJdID0gb3BlcmF0b3IgKyAnLionICsgZ2V0dGVyLnRvRmlsdGVyKCkgKyAnKic7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG9wZXJhdG9yID09PSAnQEAnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IG9wZXJhdG9yICsgJy4nICsgZ2V0dGVyLnRvRmlsdGVyKCkucmVwbGFjZSgvXFxzKy9nLCAnJicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChvcGVyYXRvciA9PT0gJ2JldHdlZW4nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFnZXR0ZXIubHRlLnRvRmlsdGVyKCkgJiYgIWdldHRlci5ndGUudG9GaWx0ZXIoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWVtbztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChnZXR0ZXIuZ3RlKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXS5wdXNoKCdndGUuJyArIGdldHRlci5ndGUudG9GaWx0ZXIoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChnZXR0ZXIubHRlKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXS5wdXNoKCdsdGUuJyArIGdldHRlci5sdGUudG9GaWx0ZXIoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChvcGVyYXRvciA9PT0gJ2lzLm51bGwnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IGdldHRlci50b0ZpbHRlcigpID09PSBudWxsID8gJ2lzLm51bGwnIDogJ25vdC5pcy5udWxsJztcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVtb1thdHRyXSA9IG9wZXJhdG9yICsgJy4nICsgZ2V0dGVyLnRvRmlsdGVyKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgICAgICAgICAgfSwge31cbiAgICAgICAgICAgICk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgcGFyYW1ldGVycyA9ICgpID0+IHtcbiAgICAgICAgICAgIC8vIFRoZSBvcmRlciBwYXJhbWV0ZXJzIGhhdmUgYSBzcGVjaWFsIHN5bnRheCAoanVzdCBsaWtlIGFuIG9yZGVyIGJ5IFNRTCBjbGF1c2UpXG4gICAgICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vYmVncmlmZnMvcG9zdGdyZXN0L3dpa2kvUm91dGluZyNmaWx0ZXJpbmctYW5kLW9yZGVyaW5nXG4gICAgICAgICAgICBjb25zdCBvcmRlciA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZ2V0dGVycy5vcmRlcigpICYmIF8ucmVkdWNlKFxuICAgICAgICAgICAgICAgICAgICBnZXR0ZXJzLm9yZGVyKCksIChtZW1vLCBkaXJlY3Rpb24sIGF0dHIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lbW8ucHVzaChhdHRyICsgJy4nICsgZGlyZWN0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgICAgICAgICAgICAgICB9LCBbXVxuICAgICAgICAgICAgICAgICkuam9pbignLCcpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgIG9yZGVyUGFyYW1ldGVyID0gb3JkZXIoKSA/IHtcbiAgICAgICAgICAgICAgICAgICAgb3JkZXI6IG9yZGVyKClcbiAgICAgICAgICAgICAgICB9IDoge307XG5cbiAgICAgICAgICAgIHJldHVybiBfLmV4dGVuZCh7fSwgb3JkZXJQYXJhbWV0ZXIsIHBhcmFtZXRlcnNXaXRob3V0T3JkZXIoKSk7XG5cbiAgICAgICAgfTtcblxuICAgIHJldHVybiBfLmV4dGVuZChuZXdWTSwgZ2V0dGVycywge1xuICAgICAgICBwYXJhbWV0ZXJzOiBwYXJhbWV0ZXJzLFxuICAgICAgICBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyOiBwYXJhbWV0ZXJzV2l0aG91dE9yZGVyXG4gICAgfSk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBmaWx0ZXJzVk07XG4iLCJpbXBvcnQgbSBmcm9tICdtaXRocmlsJztcbmltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuXG5jb25zdCBwYWdpbmF0aW9uVk0gPSAobW9kZWwsIG9yZGVyLCBleHRyYUhlYWRlcnMgPSB7fSwgYXV0aGVudGljYXRlID0gdHJ1ZSkgPT4ge1xuICAgIGxldCBjb2xsZWN0aW9uID0gbS5wcm9wKFtdKSxcbiAgICAgICAgZGVmYXVsdE9yZGVyID0gb3JkZXIgfHwgJ2lkLmRlc2MnLFxuICAgICAgICBmaWx0ZXJzID0gbS5wcm9wKHtcbiAgICAgICAgICAgIG9yZGVyOiBkZWZhdWx0T3JkZXJcbiAgICAgICAgfSksXG4gICAgICAgIGlzTG9hZGluZyA9IG0ucHJvcChmYWxzZSksXG4gICAgICAgIHBhZ2UgPSBtLnByb3AoMSksXG4gICAgICAgIHJlc3VsdHNDb3VudCA9IG0ucHJvcCgpLFxuICAgICAgICBwYWdlUmVxdWVzdCA9IGF1dGhlbnRpY2F0ZSA/IG1vZGVsLmdldFBhZ2VXaXRoVG9rZW4gOiBtb2RlbC5nZXRQYWdlLFxuICAgICAgICB0b3RhbCA9IG0ucHJvcCgpO1xuXG4gICAgY29uc3QgZmV0Y2ggPSAoKSA9PiB7XG4gICAgICAgIGxldCBkID0gbS5kZWZlcnJlZCgpO1xuICAgICAgICBjb25zdCBnZXRUb3RhbCA9ICh4aHIpID0+IHtcbiAgICAgICAgICAgIGlmICgheGhyIHx8IHhoci5zdGF0dXMgPT09IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICBoaW50OiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBkZXRhaWxzOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBjb2RlOiAwLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnQ29ubmVjdGlvbiBlcnJvcidcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCByYW5nZUhlYWRlciA9IHhoci5nZXRSZXNwb25zZUhlYWRlcignQ29udGVudC1SYW5nZScpO1xuICAgICAgICAgICAgaWYgKF8uaXNTdHJpbmcocmFuZ2VIZWFkZXIpKSB7XG4gICAgICAgICAgICAgICAgbGV0IFtoZWFkZXJTaXplLCBoZWFkZXJDb3VudF0gPSByYW5nZUhlYWRlci5zcGxpdCgnLycpLFxuICAgICAgICAgICAgICAgICAgICBbaGVhZGVyRnJvbSwgaGVhZGVyVG9dID0gaGVhZGVyU2l6ZS5zcGxpdCgnLScpLFxuICAgICAgICAgICAgICAgICAgICB0byA9IHBhcnNlSW50KGhlYWRlclRvKSArIDEgfHwgMCxcbiAgICAgICAgICAgICAgICAgICAgZnJvbSA9IHBhcnNlSW50KGhlYWRlckZyb20pICB8fCAwO1xuXG4gICAgICAgICAgICAgICAgdG90YWwocGFyc2VJbnQoaGVhZGVyQ291bnQpKTtcbiAgICAgICAgICAgICAgICByZXN1bHRzQ291bnQodG8gLSBmcm9tKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgSlNPTi5wYXJzZSh4aHIucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICByZXR1cm4geGhyLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgaGludDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgZGV0YWlsczogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgY29kZTogMCxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogeGhyLnJlc3BvbnNlVGV4dFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBpc0xvYWRpbmcodHJ1ZSk7XG4gICAgICAgIHBhZ2VSZXF1ZXN0KGZpbHRlcnMoKSwgcGFnZSgpLCB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cnVlLFxuICAgICAgICAgICAgZXh0cmFjdDogZ2V0VG90YWxcbiAgICAgICAgfSwgZXh0cmFIZWFkZXJzKS50aGVuKChkYXRhKSA9PiB7XG4gICAgICAgICAgICBjb2xsZWN0aW9uKF8udW5pb24oY29sbGVjdGlvbigpLCBkYXRhKSk7XG4gICAgICAgICAgICBpc0xvYWRpbmcoZmFsc2UpO1xuICAgICAgICAgICAgZC5yZXNvbHZlKGNvbGxlY3Rpb24oKSk7XG4gICAgICAgICAgICBtLnJlZHJhdygpO1xuICAgICAgICB9LCAoZXJyb3IpID0+IHtcbiAgICAgICAgICAgIGlzTG9hZGluZyhmYWxzZSk7XG4gICAgICAgICAgICB0b3RhbCgwKTtcbiAgICAgICAgICAgIGQucmVqZWN0KGVycm9yKTtcbiAgICAgICAgICAgIG0ucmVkcmF3KCk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZC5wcm9taXNlO1xuICAgIH0sXG5cbiAgICBmaXJzdFBhZ2UgPSAocGFyYW1ldGVycykgPT4ge1xuICAgICAgICBmaWx0ZXJzKF8uZXh0ZW5kKHtcbiAgICAgICAgICAgIG9yZGVyOiBkZWZhdWx0T3JkZXJcbiAgICAgICAgfSwgcGFyYW1ldGVycykpO1xuICAgICAgICBjb2xsZWN0aW9uKFtdKTtcbiAgICAgICAgcGFnZSgxKTtcbiAgICAgICAgcmV0dXJuIGZldGNoKCk7XG4gICAgfSxcblxuICAgIGlzTGFzdFBhZ2UgPSAoKSA9PiB7XG4gICAgICAgIHJldHVybiAobW9kZWwucGFnZVNpemUoKSA+IHJlc3VsdHNDb3VudCgpKTtcbiAgICB9LFxuXG4gICAgbmV4dFBhZ2UgPSAoKSA9PiB7XG4gICAgICAgIHBhZ2UocGFnZSgpICsgMSk7XG4gICAgICAgIHJldHVybiBmZXRjaCgpO1xuICAgIH07XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uLFxuICAgICAgICBmaXJzdFBhZ2U6IGZpcnN0UGFnZSxcbiAgICAgICAgaXNMb2FkaW5nOiBpc0xvYWRpbmcsXG4gICAgICAgIG5leHRQYWdlOiBuZXh0UGFnZSxcbiAgICAgICAgaXNMYXN0UGFnZTogaXNMYXN0UGFnZSxcbiAgICAgICAgdG90YWw6IHRvdGFsLFxuICAgICAgICByZXN1bHRzQ291bnQ6IHJlc3VsdHNDb3VudFxuICAgIH07XG59O1xuXG5leHBvcnQgZGVmYXVsdCBwYWdpbmF0aW9uVk07XG4iLCJpbXBvcnQgbSBmcm9tICdtaXRocmlsJztcbmltcG9ydCBfIGZyb20gJ3VuZGVyc2NvcmUnO1xuaW1wb3J0IGZpbHRlcnNWTSBmcm9tICcuL3Ztcy9maWx0ZXJzVk0nO1xuaW1wb3J0IHBhZ2luYXRpb25WTSBmcm9tICcuL3Ztcy9wYWdpbmF0aW9uVk0nO1xuXG5mdW5jdGlvbiBQb3N0Z3Jlc3QgKCkge1xuICAgIGxldCBwb3N0Z3Jlc3QgPSB7fTtcblxuICAgIGNvbnN0IHRva2VuID0gbS5wcm9wKCksXG5cbiAgICAgICAgICBtZXJnZUNvbmZpZyA9IChjb25maWcsIG9wdGlvbnMpID0+IHtcbiAgICAgICAgICAgICAgcmV0dXJuIG9wdGlvbnMgJiYgXy5pc0Z1bmN0aW9uKG9wdGlvbnMuY29uZmlnKSA/IF8uY29tcG9zZShvcHRpb25zLmNvbmZpZywgY29uZmlnKSA6IGNvbmZpZztcbiAgICAgICAgICB9LFxuXG4gICAgICAgICAgYWRkSGVhZGVycyA9IChoZWFkZXJzKSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiAoeGhyKSA9PiB7XG4gICAgICAgICAgICAgICAgICBfLmVhY2goaGVhZGVycywgKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihrZXksIHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHhocjtcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICB9LFxuXG4gICAgICAgICAgYWRkQ29uZmlnSGVhZGVycyA9IChoZWFkZXJzLCBvcHRpb25zKSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiBfLmV4dGVuZCh7fSwgb3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgY29uZmlnOiBtZXJnZUNvbmZpZyhhZGRIZWFkZXJzKGhlYWRlcnMpLCBvcHRpb25zKVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICB9LFxuXG4gICAgICAgICAgY3JlYXRlTG9hZGVyID0gKHJlcXVlc3RGdW5jdGlvbiwgb3B0aW9ucywgZGVmYXVsdFN0YXRlID0gZmFsc2UpID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgbG9hZGVyID0gbS5wcm9wKGRlZmF1bHRTdGF0ZSksXG4gICAgICAgICAgICAgICAgICAgIGQgPSBtLmRlZmVycmVkKCk7XG4gICAgICAgICAgICAgIGxvYWRlci5sb2FkID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgbG9hZGVyKHRydWUpO1xuICAgICAgICAgICAgICAgICAgbS5yZWRyYXcoKTtcbiAgICAgICAgICAgICAgICAgIHJlcXVlc3RGdW5jdGlvbihfLmV4dGVuZCh7fSwgb3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6IHRydWVcbiAgICAgICAgICAgICAgICAgIH0pKS50aGVuKChkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgbG9hZGVyKGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgICBkLnJlc29sdmUoZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgbS5yZWRyYXcoKTtcbiAgICAgICAgICAgICAgICAgIH0sIChlcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIGxvYWRlcihmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgZC5yZWplY3QoZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgIG0ucmVkcmF3KCk7XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBkLnByb21pc2U7XG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgIHJldHVybiBsb2FkZXI7XG4gICAgICAgICAgfSxcblxuICAgICAgICAgIHJlcHJlc2VudGF0aW9uSGVhZGVyID0ge1xuICAgICAgICAgICAgICAnUHJlZmVyJzogJ3JldHVybj1yZXByZXNlbnRhdGlvbidcbiAgICAgICAgICB9O1xuXG4gICAgcG9zdGdyZXN0LnRva2VuID0gdG9rZW47XG5cbiAgICBwb3N0Z3Jlc3QuaW5pdCA9IChhcGlQcmVmaXgsIGF1dGhlbnRpY2F0aW9uT3B0aW9ucykgPT4ge1xuICAgICAgICBwb3N0Z3Jlc3QucmVxdWVzdCA9IChvcHRpb25zKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBlcnJvckhhbmRsZXIgPSAoeGhyKSA9PiB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgSlNPTi5wYXJzZSh4aHIucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHhoci5yZXNwb25zZVRleHQ7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGhpbnQ6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXRhaWxzOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29kZTogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IHhoci5yZXNwb25zZVRleHRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiBtLnJlcXVlc3QoXy5leHRlbmQoe2V4dHJhY3Q6IGVycm9ySGFuZGxlcn0sIG9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICB1cmw6IGFwaVByZWZpeCArIG9wdGlvbnMudXJsXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgcG9zdGdyZXN0LmF1dGhlbnRpY2F0ZSA9ICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGRlZmVycmVkID0gbS5kZWZlcnJlZCgpO1xuICAgICAgICAgICAgaWYgKHRva2VuKCkpIHtcbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHtcbiAgICAgICAgICAgICAgICAgICAgdG9rZW46IHRva2VuKClcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbS5yZXF1ZXN0KF8uZXh0ZW5kKHt9LCBhdXRoZW50aWNhdGlvbk9wdGlvbnMpKS50aGVuKChkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRva2VuKGRhdGEudG9rZW4pO1xuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRva2VuOiB0b2tlbigpXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0sIChkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChkYXRhKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgICAgICB9O1xuXG4gICAgICAgIHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuID0gKG9wdGlvbnMpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBwb3N0Z3Jlc3QuYXV0aGVudGljYXRlKCkudGhlbihcbiAgICAgICAgICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBwb3N0Z3Jlc3QucmVxdWVzdChhZGRDb25maWdIZWFkZXJzKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICdBdXRob3JpemF0aW9uJzogJ0JlYXJlciAnICsgdG9rZW4oKVxuICAgICAgICAgICAgICAgICAgICB9LCBvcHRpb25zKSk7XG4gICAgICAgICAgICAgICAgfSwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcG9zdGdyZXN0LnJlcXVlc3Qob3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfTtcblxuICAgICAgICBwb3N0Z3Jlc3QubG9hZGVyID0gXy5wYXJ0aWFsKGNyZWF0ZUxvYWRlciwgcG9zdGdyZXN0LnJlcXVlc3QpO1xuICAgICAgICBcbiAgICAgICAgcG9zdGdyZXN0LmxvYWRlcldpdGhUb2tlbiA9IF8ucGFydGlhbChjcmVhdGVMb2FkZXIsIHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuKTtcblxuICAgICAgICBwb3N0Z3Jlc3QubW9kZWwgPSAobmFtZSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgcGFnaW5hdGlvbkhlYWRlcnMgPSAocGFnZSwgcGFnZVNpemUpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIXBhZ2VTaXplKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCB0b1JhbmdlID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmcm9tID0gKHBhZ2UgLSAxKSAqIHBhZ2VTaXplLFxuICAgICAgICAgICAgICAgICAgICAgICAgICB0byA9IGZyb20gKyBwYWdlU2l6ZSAtIDE7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmcm9tICsgJy0nICsgdG87XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICdSYW5nZS11bml0JzogJ2l0ZW1zJyxcbiAgICAgICAgICAgICAgICAgICAgJ1JhbmdlJzogdG9SYW5nZSgpXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgIHBhZ2VTaXplID0gbS5wcm9wKDEwKSxcblxuICAgICAgICAgICAgICAgICAgbmFtZU9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgdXJsOiAnLycgKyBuYW1lXG4gICAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgICBnZXRPcHRpb25zID0gKGRhdGEsIHBhZ2UsIHBhZ2VTaXplLCBvcHRpb25zLCBoZWFkZXJzID0ge30pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBleHRyYUhlYWRlcnMgPSBfLmV4dGVuZCh7fSwge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAnUHJlZmVyJzogJ2NvdW50PW5vbmUnXG4gICAgICAgICAgICAgICAgICAgICAgfSwgaGVhZGVycywgcGFnaW5hdGlvbkhlYWRlcnMocGFnZSwgcGFnZVNpemUpKTtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWRkQ29uZmlnSGVhZGVycyhleHRyYUhlYWRlcnMsIF8uZXh0ZW5kKHt9LCBvcHRpb25zLCBuYW1lT3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiBkYXRhXG4gICAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgcXVlcnlzdHJpbmcgPSAoZmlsdGVycywgb3B0aW9ucykgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMudXJsICs9ICc/JyArIG0ucm91dGUuYnVpbGRRdWVyeVN0cmluZyhmaWx0ZXJzKTtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gb3B0aW9ucztcbiAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgIG9wdGlvbnMgPSAob3B0aW9ucykgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwb3N0Z3Jlc3QucmVxdWVzdChfLmV4dGVuZCh7fSwgb3B0aW9ucywgbmFtZU9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnT1BUSU9OUydcbiAgICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgICBwb3N0T3B0aW9ucyA9IChhdHRyaWJ1dGVzLCBvcHRpb25zLCBoZWFkZXJzID0ge30pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBleHRyYUhlYWRlcnMgPSBfLmV4dGVuZCh7fSwgcmVwcmVzZW50YXRpb25IZWFkZXIsIGhlYWRlcnMpO1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBhZGRDb25maWdIZWFkZXJzKFxuICAgICAgICAgICAgICAgICAgICAgICAgICBleHRyYUhlYWRlcnMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIF8uZXh0ZW5kKHt9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lT3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiBhdHRyaWJ1dGVzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgICAgICAgIGRlbGV0ZU9wdGlvbnMgPSAoZmlsdGVycywgb3B0aW9ucywgaGVhZGVycyA9IHt9KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc3QgZXh0cmFIZWFkZXJzID0gYWRkSGVhZGVycyhfLmV4dGVuZCh7fSwgaGVhZGVycykpO1xuICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBxdWVyeXN0cmluZyhmaWx0ZXJzLCBhZGRDb25maWdIZWFkZXJzKGV4dHJhSGVhZGVycywgXy5leHRlbmQoe30sIG9wdGlvbnMsIG5hbWVPcHRpb25zLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIG1ldGhvZDogJ0RFTEVURSdcbiAgICAgICAgICAgICAgICAgICAgICB9KSkpO1xuICAgICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgcGF0Y2hPcHRpb25zID0gKGZpbHRlcnMsIGF0dHJpYnV0ZXMsIG9wdGlvbnMsIGhlYWRlcnMgPSB7fSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGV4dHJhSGVhZGVycyA9IF8uZXh0ZW5kKHt9LCByZXByZXNlbnRhdGlvbkhlYWRlciwgaGVhZGVycyk7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHF1ZXJ5c3RyaW5nKFxuICAgICAgICAgICAgICAgICAgICAgICAgICBmaWx0ZXJzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBhZGRDb25maWdIZWFkZXJzKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXh0cmFIZWFkZXJzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXy5leHRlbmQoe30sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZU9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdQQVRDSCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YTogYXR0cmlidXRlc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgZ2V0UGFnZU9wdGlvbnMgPSAoZGF0YSwgcGFnZSwgb3B0aW9ucywgaGVhZGVycyA9IHt9KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGdldE9wdGlvbnMoZGF0YSwgKHBhZ2UgfHwgMSksIHBhZ2VTaXplKCksIG9wdGlvbnMsIGhlYWRlcnMpO1xuICAgICAgICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgICAgICAgZ2V0Um93T3B0aW9ucyA9IChkYXRhLCBvcHRpb25zLCBoZWFkZXJzID0ge30pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZ2V0T3B0aW9ucyhkYXRhLCAxLCAxLCBvcHRpb25zLCBoZWFkZXJzKTtcbiAgICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgcGFnZVNpemU6IHBhZ2VTaXplLFxuICAgICAgICAgICAgICAgIGdldFBhZ2VPcHRpb25zOiBnZXRQYWdlT3B0aW9ucyxcbiAgICAgICAgICAgICAgICBnZXRSb3dPcHRpb25zOiBnZXRSb3dPcHRpb25zLFxuICAgICAgICAgICAgICAgIHBhdGNoT3B0aW9uczogcGF0Y2hPcHRpb25zLFxuICAgICAgICAgICAgICAgIHBvc3RPcHRpb25zOiBwb3N0T3B0aW9ucyxcbiAgICAgICAgICAgICAgICBkZWxldGVPcHRpb25zOiBkZWxldGVPcHRpb25zLFxuICAgICAgICAgICAgICAgIGdldFBhZ2U6IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgZ2V0UGFnZU9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIGdldFJvdzogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0LCBnZXRSb3dPcHRpb25zKSxcbiAgICAgICAgICAgICAgICBwYXRjaDogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0LCBwYXRjaE9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIHBvc3Q6IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgcG9zdE9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIGRlbGV0ZVJlcXVlc3Q6IF8uY29tcG9zZShwb3N0Z3Jlc3QucmVxdWVzdCwgZGVsZXRlT3B0aW9ucyksXG4gICAgICAgICAgICAgICAgZ2V0UGFnZVdpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBnZXRQYWdlT3B0aW9ucyksXG4gICAgICAgICAgICAgICAgZ2V0Um93V2l0aFRva2VuOiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIGdldFJvd09wdGlvbnMpLFxuICAgICAgICAgICAgICAgIHBhdGNoV2l0aFRva2VuOiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIHBhdGNoT3B0aW9ucyksXG4gICAgICAgICAgICAgICAgcG9zdFdpdGhUb2tlbjogXy5jb21wb3NlKHBvc3RncmVzdC5yZXF1ZXN0V2l0aFRva2VuLCBwb3N0T3B0aW9ucyksXG4gICAgICAgICAgICAgICAgZGVsZXRlV2l0aFRva2VuOiBfLmNvbXBvc2UocG9zdGdyZXN0LnJlcXVlc3RXaXRoVG9rZW4sIGRlbGV0ZU9wdGlvbnMpLFxuICAgICAgICAgICAgICAgIG9wdGlvbnM6IG9wdGlvbnNcbiAgICAgICAgICAgIH07XG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIHBvc3RncmVzdDtcbiAgICB9O1xuXG4gICAgcG9zdGdyZXN0LmZpbHRlcnNWTSA9IGZpbHRlcnNWTTtcbiAgICBwb3N0Z3Jlc3QucGFnaW5hdGlvblZNID0gcGFnaW5hdGlvblZNO1xuICBcbiAgICByZXR1cm4gcG9zdGdyZXN0O1xufVxuXG5leHBvcnQgZGVmYXVsdCBQb3N0Z3Jlc3Q7XG4iXSwibmFtZXMiOlsiZmlsdGVyc1ZNIiwiYXR0cmlidXRlcyIsIm5ld1ZNIiwiZmlsdGVyIiwicHJvcCIsIm0iLCJmaWx0ZXJQcm9wIiwidmFsdWUiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJ0b0ZpbHRlciIsIl8iLCJpc1N0cmluZyIsInRyaW0iLCJnZXR0ZXJzIiwicmVkdWNlIiwibWVtbyIsIm9wZXJhdG9yIiwiYXR0ciIsInBhcmFtZXRlcnNXaXRob3V0T3JkZXIiLCJnZXR0ZXIiLCJpc0Z1bmN0aW9uIiwidW5kZWZpbmVkIiwicmVwbGFjZSIsImx0ZSIsImd0ZSIsInB1c2giLCJwYXJhbWV0ZXJzIiwib3JkZXIiLCJkaXJlY3Rpb24iLCJqb2luIiwib3JkZXJQYXJhbWV0ZXIiLCJleHRlbmQiLCJwYWdpbmF0aW9uVk0iLCJtb2RlbCIsImV4dHJhSGVhZGVycyIsImF1dGhlbnRpY2F0ZSIsImNvbGxlY3Rpb24iLCJkZWZhdWx0T3JkZXIiLCJmaWx0ZXJzIiwiaXNMb2FkaW5nIiwicGFnZSIsInJlc3VsdHNDb3VudCIsInBhZ2VSZXF1ZXN0IiwiZ2V0UGFnZVdpdGhUb2tlbiIsImdldFBhZ2UiLCJ0b3RhbCIsImZldGNoIiwiZCIsImRlZmVycmVkIiwiZ2V0VG90YWwiLCJ4aHIiLCJzdGF0dXMiLCJKU09OIiwic3RyaW5naWZ5IiwicmFuZ2VIZWFkZXIiLCJnZXRSZXNwb25zZUhlYWRlciIsInNwbGl0IiwiaGVhZGVyU2l6ZSIsImhlYWRlckNvdW50IiwiaGVhZGVyRnJvbSIsImhlYWRlclRvIiwidG8iLCJwYXJzZUludCIsImZyb20iLCJyZXNwb25zZVRleHQiLCJleCIsInRoZW4iLCJkYXRhIiwidW5pb24iLCJyZXNvbHZlIiwicmVkcmF3IiwiZXJyb3IiLCJyZWplY3QiLCJwcm9taXNlIiwiZmlyc3RQYWdlIiwiaXNMYXN0UGFnZSIsInBhZ2VTaXplIiwibmV4dFBhZ2UiLCJQb3N0Z3Jlc3QiLCJwb3N0Z3Jlc3QiLCJ0b2tlbiIsIm1lcmdlQ29uZmlnIiwiY29uZmlnIiwib3B0aW9ucyIsImNvbXBvc2UiLCJhZGRIZWFkZXJzIiwiaGVhZGVycyIsImVhY2giLCJrZXkiLCJzZXRSZXF1ZXN0SGVhZGVyIiwiYWRkQ29uZmlnSGVhZGVycyIsImNyZWF0ZUxvYWRlciIsInJlcXVlc3RGdW5jdGlvbiIsImRlZmF1bHRTdGF0ZSIsImxvYWRlciIsImxvYWQiLCJyZXByZXNlbnRhdGlvbkhlYWRlciIsImluaXQiLCJhcGlQcmVmaXgiLCJhdXRoZW50aWNhdGlvbk9wdGlvbnMiLCJyZXF1ZXN0IiwiZXJyb3JIYW5kbGVyIiwiZXh0cmFjdCIsInVybCIsInJlcXVlc3RXaXRoVG9rZW4iLCJwYXJ0aWFsIiwibG9hZGVyV2l0aFRva2VuIiwibmFtZSIsInBhZ2luYXRpb25IZWFkZXJzIiwidG9SYW5nZSIsIm5hbWVPcHRpb25zIiwiZ2V0T3B0aW9ucyIsInF1ZXJ5c3RyaW5nIiwicm91dGUiLCJidWlsZFF1ZXJ5U3RyaW5nIiwicG9zdE9wdGlvbnMiLCJkZWxldGVPcHRpb25zIiwicGF0Y2hPcHRpb25zIiwiZ2V0UGFnZU9wdGlvbnMiLCJnZXRSb3dPcHRpb25zIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFHQSxJQUFNQSxZQUFZLFNBQVpBLFNBQVksQ0FBQ0MsVUFBRCxFQUFnQjtRQUMxQkMsUUFBUSxFQUFaO1FBQ0lDLFNBQVMsU0FBVEEsTUFBUyxHQUFNO1lBQ0xDLE9BQU9DLEVBQUVELElBQUYsQ0FBTyxFQUFQLENBQWI7WUFDSUUsYUFBYSxTQUFiQSxVQUFhLENBQVVDLEtBQVYsRUFBaUI7Z0JBQ3RCQyxVQUFVQyxNQUFWLEdBQW1CLENBQXZCLEVBQTBCO3FCQUNqQkYsS0FBTDt1QkFDT0wsS0FBUDs7bUJBRUdFLE1BQVA7U0FOUjs7bUJBU1dNLFFBQVgsR0FBc0IsWUFBTTttQkFDakJDLEVBQUVDLFFBQUYsQ0FBV04sWUFBWCxJQUEyQkEs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U0FBdEI7Y0FDVWlDLFlBQVYsR0FBeUJBLFlBQXpCOztXQUVPK0MsU0FBUDs7Ozs7Ozs7OyIsInByZUV4aXN0aW5nQ29tbWVudCI6Ii8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0PXV0Zi04O2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKbWFXeGxJanB1ZFd4c0xDSnpiM1Z5WTJWeklqcGJJaTlvYjIxbEwzWnBZMjVwWTJsMWN5OUVaWFl2YldsMGFISnBiQzF3YjNOMFozSmxjM1F2YzNKakwzWnRjeTltYVd4MFpYSnpWazB1YW5NaUxDSXZhRzl0WlM5MmFXTnVhV05wZFhNdlJHVjJMMjFwZEdoeWFXd3RjRzl6ZEdkeVpYTjBMM055WXk5MmJYTXZjR0ZuYVc1aGRHbHZibFpOTG1weklpd2lMMmh2YldVdmRtbGpibWxqYVhWekwwUmxkaTl0YVhSb2NtbHNMWEJ2YzNSbmNtVnpkQzl6Y21NdmNHOXpkR2R5WlhOMExtcHpJbDBzSW5OdmRYSmpaWE5EYjI1MFpXNTBJanBiSW1sdGNHOXlkQ0J0SUdaeWIyMGdKMjFwZEdoeWFXd25PMXh1YVcxd2IzSjBJRjhnWm5KdmJTQW5kVzVrWlhKelkyOXlaU2M3WEc1Y2JtTnZibk4wSUdacGJIUmxjbk5XVFNBOUlDaGhkSFJ5YVdKMWRHVnpLU0E5UGlCN1hHNGdJQ0FnYkdWMElHNWxkMVpOSUQwZ2UzMHNYRzRnSUNBZ0lDQWdJR1pwYkhSbGNpQTlJQ2dwSUQwK0lIdGNiaUFnSUNBZ0lDQWdJQ0FnSUdOdmJuTjBJSEJ5YjNBZ1BTQnRMbkJ5YjNBb0p5Y3BMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR1pwYkhSbGNsQnliM0FnUFNCbWRXNWpkR2x2YmlBb2RtRnNkV1VwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdhV1lnS0dGeVozVnRaVzUwY3k1c1pXNW5kR2dnUGlBd0tTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQndjbTl3S0haaGJIVmxLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQnVaWGRXVFR0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCeVpYUjFjbTRnY0hKdmNDZ3BPMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDA3WEc0Z0lDQWdJQ0FnSUNBZ0lDQXZMeUJLZFhOMElITnZJSGRsSUdOaGJpQm9ZWFpsSUdFZ1pHVm1ZWFZzZENCMGIxOW1hV3gwWlhJZ1lXNWtJR0YyYjJsa0lHbG1JRjh1YVhOR2RXNWpkR2x2YmlCallXeHNjMXh1SUNBZ0lDQWdJQ0FnSUNBZ1ptbHNkR1Z5VUhKdmNDNTBiMFpwYkhSbGNpQTlJQ2dwSUQwK0lIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z1h5NXBjMU4wY21sdVp5aG1hV3gwWlhKUWNtOXdLQ2twSUQ4Z1ptbHNkR1Z5VUhKdmNDZ3BMblJ5YVcwb0tTQTZJR1pwYkhSbGNsQnliM0FvS1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJSDA3WEc0Z0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z1ptbHNkR1Z5VUhKdmNEdGNiaUFnSUNBZ0lDQWdmU3hjYmx4dUlDQWdJQ0FnSUNCblpYUjBaWEp6SUQwZ1h5NXlaV1IxWTJVb1hHNGdJQ0FnSUNBZ0lDQWdJQ0JoZEhSeWFXSjFkR1Z6TENBb2JXVnRieXdnYjNCbGNtRjBiM0lzSUdGMGRISXBJRDArSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBdkx5QlVhR1VnYjNCbGNtRjBiM0lnWW1WMGQyVmxiaUJwY3lCcGJYQnNaVzFsYm5SbFpDQjNhWFJvSUhSM2J5QndjbTl3WlhKMGFXVnpMQ0J2Ym1VZ1ptOXlJR2R5WldGMFpYSWdkR2hoYmlCMllXeDFaU0JoYm1RZ1lXNXZkR2hsY2lCbWIzSWdiR1Z6YzJWeUlIUm9ZVzRnZG1Gc2RXVXVYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdMeThnUW05MGFDQndjbTl3WlhKMGFXVnpJR0Z5WlNCelpXNTBJR2x1SUhSb1pTQnhkV1YxY25semRISnBibWNnZDJsMGFDQjBhR1VnYzJGdFpTQnVZVzFsTEZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUM4dklIUm9ZWFFuY3lCM2FIa2dkMlVnYm1WbFpDQjBhR1VnYzNCbFkybGhiQ0JqWVhObElHaGxjbVVzSUhOdklIZGxJR05oYmlCMWMyVWdZU0J6YVcxd2JHVWdiV0Z3SUdGeklHRnlaM1Z0Wlc1MElIUnZJR1pwYkhSbGNuTldUUzVjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JwWmlBb2IzQmxjbUYwYjNJZ1BUMDlJQ2RpWlhSM1pXVnVKeWtnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnRaVzF2VzJGMGRISmRJRDBnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYkhSbE9pQm1hV3gwWlhJb0tTeGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHZDBaVG9nWm1sc2RHVnlLQ2xjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2ZUdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J0WlcxdlcyRjBkSEpkSUQwZ1ptbHNkR1Z5S0NrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCdFpXMXZPMXh1SUNBZ0lDQWdJQ0FnSUNBZ2ZTd2dlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJRzl5WkdWeU9pQm1hV3gwWlhJb0tWeHVJQ0FnSUNBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNBcExGeHVYRzRnSUNBZ0lDQWdJSEJoY21GdFpYUmxjbk5YYVhSb2IzVjBUM0prWlhJZ1BTQW9LU0E5UGlCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdYeTV5WldSMVkyVW9YRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdaMlYwZEdWeWN5d2dLRzFsYlc4c0lHZGxkSFJsY2l3Z1lYUjBjaWtnUFQ0Z2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JwWmlBb1lYUjBjaUFoUFQwZ0oyOXlaR1Z5SnlrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1kyOXVjM1FnYjNCbGNtRjBiM0lnUFNCaGRIUnlhV0oxZEdWelcyRjBkSEpkTzF4dVhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCcFppQW9YeTVwYzBaMWJtTjBhVzl1S0dkbGRIUmxjaTUwYjBacGJIUmxjaWtnSmlZZ0tHZGxkSFJsY2k1MGIwWnBiSFJsY2lncElEMDlQU0IxYm1SbFptbHVaV1FnZkh3Z1oyVjBkR1Z5TG5SdlJtbHNkR1Z5S0NrZ1BUMDlJQ2NuS1NrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQnRaVzF2TzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZlZ4dVhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBdkx5QkNaV3hzYjNjZ2QyVWdkWE5sSUdScFptWmxjbVZ1ZENCbWIzSnRZWFIwYVc1bklISjFiR1Z6SUdadmNpQjBhR1VnZG1Gc2RXVWdaR1Z3Wlc1a2FXNW5JRzl1SUhSb1pTQnZjR1Z5WVhSdmNseHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0x5OGdWR2hsYzJVZ2NuVnNaWE1nWVhKbElIVnpaV1FnY21WbllYSmtiR1Z6Y3lCdlppQjBhR1VnZEc5R2FXeDBaWElnWm5WdVkzUnBiMjRzWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0F2THlCemJ5QjBhR1VnZFhObGNpQmpZVzRnZFhObElHRWdZM1Z6ZEc5dElIUnZSbWxzZEdWeUlIZHBkR2h2ZFhRZ2FHRjJhVzVuSUhSdklIZHZjbko1SUhkcGRHZ2dZbUZ6YVdNZ1ptbHNkR1Z5SUhONWJuUmhlRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdhV1lnS0c5d1pYSmhkRzl5SUQwOVBTQW5hV3hwYTJVbklIeDhJRzl3WlhKaGRHOXlJRDA5UFNBbmJHbHJaU2NwSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnRaVzF2VzJGMGRISmRJRDBnYjNCbGNtRjBiM0lnS3lBbkxpb25JQ3NnWjJWMGRHVnlMblJ2Um1sc2RHVnlLQ2tnS3lBbktpYzdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlJR1ZzYzJVZ2FXWWdLRzl3WlhKaGRHOXlJRDA5UFNBblFFQW5LU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2JXVnRiMXRoZEhSeVhTQTlJRzl3WlhKaGRHOXlJQ3NnSnk0bklDc2daMlYwZEdWeUxuUnZSbWxzZEdWeUtDa3VjbVZ3YkdGalpTZ3ZYRnh6S3k5bkxDQW5KaWNwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZlNCbGJITmxJR2xtSUNodmNHVnlZWFJ2Y2lBOVBUMGdKMkpsZEhkbFpXNG5LU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2FXWWdLQ0ZuWlhSMFpYSXViSFJsTG5SdlJtbHNkR1Z5S0NrZ0ppWWdJV2RsZEhSbGNpNW5kR1V1ZEc5R2FXeDBaWElvS1NrZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCeVpYUjFjbTRnYldWdGJ6dGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0I5WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2JXVnRiMXRoZEhSeVhTQTlJRnRkTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHbG1JQ2huWlhSMFpYSXVaM1JsS0NrcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2JXVnRiMXRoZEhSeVhTNXdkWE5vS0NkbmRHVXVKeUFySUdkbGRIUmxjaTVuZEdVdWRHOUdhV3gwWlhJb0tTazdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHbG1JQ2huWlhSMFpYSXViSFJsS0NrcElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2JXVnRiMXRoZEhSeVhTNXdkWE5vS0Nkc2RHVXVKeUFySUdkbGRIUmxjaTVzZEdVdWRHOUdhV3gwWlhJb0tTazdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZlZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZlNCbGJITmxJR2xtSUNodmNHVnlZWFJ2Y2lBOVBUMGdKMmx6TG01MWJHd25LU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2JXVnRiMXRoZEhSeVhTQTlJR2RsZEhSbGNpNTBiMFpwYkhSbGNpZ3BJRDA5UFNCdWRXeHNJRDhnSjJsekxtNTFiR3duSURvZ0oyNXZkQzVwY3k1dWRXeHNKenRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDBnWld4elpTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYldWdGIxdGhkSFJ5WFNBOUlHOXdaWEpoZEc5eUlDc2dKeTRuSUNzZ1oyVjBkR1Z5TG5SdlJtbHNkR1Z5S0NrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCOVhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2NtVjBkWEp1SUcxbGJXODdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmU3dnZTMxY2JpQWdJQ0FnSUNBZ0lDQWdJQ2s3WEc0Z0lDQWdJQ0FnSUgwc1hHNWNiaUFnSUNBZ0lDQWdjR0Z5WVcxbGRHVnljeUE5SUNncElEMCtJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDOHZJRlJvWlNCdmNtUmxjaUJ3WVhKaGJXVjBaWEp6SUdoaGRtVWdZU0J6Y0dWamFXRnNJSE41Ym5SaGVDQW9hblZ6ZENCc2FXdGxJR0Z1SUc5eVpHVnlJR0o1SUZOUlRDQmpiR0YxYzJVcFhHNGdJQ0FnSUNBZ0lDQWdJQ0F2THlCb2RIUndjem92TDJkcGRHaDFZaTVqYjIwdlltVm5jbWxtWm5NdmNHOXpkR2R5WlhOMEwzZHBhMmt2VW05MWRHbHVaeU5tYVd4MFpYSnBibWN0WVc1a0xXOXlaR1Z5YVc1blhHNGdJQ0FnSUNBZ0lDQWdJQ0JqYjI1emRDQnZjbVJsY2lBOUlDZ3BJRDArSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCeVpYUjFjbTRnWjJWMGRHVnljeTV2Y21SbGNpZ3BJQ1ltSUY4dWNtVmtkV05sS0Z4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQm5aWFIwWlhKekxtOXlaR1Z5S0Nrc0lDaHRaVzF2TENCa2FYSmxZM1JwYjI0c0lHRjBkSElwSUQwK0lIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHMWxiVzh1Y0hWemFDaGhkSFJ5SUNzZ0p5NG5JQ3NnWkdseVpXTjBhVzl1S1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUJ0Wlcxdk8xeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0I5TENCYlhWeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDa3VhbTlwYmlnbkxDY3BPMXh1SUNBZ0lDQWdJQ0FnSUNBZ2ZTeGNibHh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJRzl5WkdWeVVHRnlZVzFsZEdWeUlEMGdiM0prWlhJb0tTQS9JSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2IzSmtaWEk2SUc5eVpHVnlLQ2xjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0I5SURvZ2UzMDdYRzVjYmlBZ0lDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCZkxtVjRkR1Z1WkNoN2ZTd2diM0prWlhKUVlYSmhiV1YwWlhJc0lIQmhjbUZ0WlhSbGNuTlhhWFJvYjNWMFQzSmtaWElvS1NrN1hHNWNiaUFnSUNBZ0lDQWdmVHRjYmx4dUlDQWdJSEpsZEhWeWJpQmZMbVY0ZEdWdVpDaHVaWGRXVFN3Z1oyVjBkR1Z5Y3l3Z2UxeHVJQ0FnSUNBZ0lDQndZWEpoYldWMFpYSnpPaUJ3WVhKaGJXVjBaWEp6TEZ4dUlDQWdJQ0FnSUNCd1lYSmhiV1YwWlhKelYybDBhRzkxZEU5eVpHVnlPaUJ3WVhKaGJXVjBaWEp6VjJsMGFHOTFkRTl5WkdWeVhHNGdJQ0FnZlNrN1hHNTlPMXh1WEc1bGVIQnZjblFnWkdWbVlYVnNkQ0JtYVd4MFpYSnpWazA3WEc0aUxDSnBiWEJ2Y25RZ2JTQm1jbTl0SUNkdGFYUm9jbWxzSnp0Y2JtbHRjRzl5ZENCZklHWnliMjBnSjNWdVpHVnljMk52Y21Vbk8xeHVYRzVqYjI1emRDQndZV2RwYm1GMGFXOXVWazBnUFNBb2JXOWtaV3dzSUc5eVpHVnlMQ0JsZUhSeVlVaGxZV1JsY25NZ1BTQjdmU3dnWVhWMGFHVnVkR2xqWVhSbElEMGdkSEoxWlNrZ1BUNGdlMXh1SUNBZ0lHeGxkQ0JqYjJ4c1pXTjBhVzl1SUQwZ2JTNXdjbTl3S0Z0ZEtTeGNiaUFnSUNBZ0lDQWdaR1ZtWVhWc2RFOXlaR1Z5SUQwZ2IzSmtaWElnZkh3Z0oybGtMbVJsYzJNbkxGeHVJQ0FnSUNBZ0lDQm1hV3gwWlhKeklEMGdiUzV3Y205d0tIdGNiaUFnSUNBZ0lDQWdJQ0FnSUc5eVpHVnlPaUJrWldaaGRXeDBUM0prWlhKY2JpQWdJQ0FnSUNBZ2ZTa3NYRzRnSUNBZ0lDQWdJR2x6VEc5aFpHbHVaeUE5SUcwdWNISnZjQ2htWVd4elpTa3NYRzRnSUNBZ0lDQWdJSEJoWjJVZ1BTQnRMbkJ5YjNBb01Ta3NYRzRnSUNBZ0lDQWdJSEpsYzNWc2RITkRiM1Z1ZENBOUlHMHVjSEp2Y0NncExGeHVJQ0FnSUNBZ0lDQndZV2RsVW1WeGRXVnpkQ0E5SUdGMWRHaGxiblJwWTJGMFpTQS9JRzF2WkdWc0xtZGxkRkJoWjJWWGFYUm9WRzlyWlc0Z09pQnRiMlJsYkM1blpYUlFZV2RsTEZ4dUlDQWdJQ0FnSUNCMGIzUmhiQ0E5SUcwdWNISnZjQ2dwTzF4dVhHNGdJQ0FnWTI5dWMzUWdabVYwWTJnZ1BTQW9LU0E5UGlCN1hHNGdJQ0FnSUNBZ0lHeGxkQ0JrSUQwZ2JTNWtaV1psY25KbFpDZ3BPMXh1SUNBZ0lDQWdJQ0JqYjI1emRDQm5aWFJVYjNSaGJDQTlJQ2g0YUhJcElEMCtJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lHbG1JQ2doZUdoeUlIeDhJSGhvY2k1emRHRjBkWE1nUFQwOUlEQXBJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdTbE5QVGk1emRISnBibWRwWm5rb2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JvYVc1ME9pQnVkV3hzTEZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQmtaWFJoYVd4ek9pQnVkV3hzTEZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQmpiMlJsT2lBd0xGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J0WlhOellXZGxPaUFuUTI5dWJtVmpkR2x2YmlCbGNuSnZjaWRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0I5S1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJSDFjYmlBZ0lDQWdJQ0FnSUNBZ0lHeGxkQ0J5WVc1blpVaGxZV1JsY2lBOUlIaG9jaTVuWlhSU1pYTndiMjV6WlVobFlXUmxjaWduUTI5dWRHVnVkQzFTWVc1blpTY3BPMXh1SUNBZ0lDQWdJQ0FnSUNBZ2FXWWdLRjh1YVhOVGRISnBibWNvY21GdVoyVklaV0ZrWlhJcEtTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdiR1YwSUZ0b1pXRmtaWEpUYVhwbExDQm9aV0ZrWlhKRGIzVnVkRjBnUFNCeVlXNW5aVWhsWVdSbGNpNXpjR3hwZENnbkx5Y3BMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCYmFHVmhaR1Z5Um5KdmJTd2dhR1ZoWkdWeVZHOWRJRDBnYUdWaFpHVnlVMmw2WlM1emNHeHBkQ2duTFNjcExGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0IwYnlBOUlIQmhjbk5sU1c1MEtHaGxZV1JsY2xSdktTQXJJREVnZkh3Z01DeGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnWm5KdmJTQTlJSEJoY25ObFNXNTBLR2hsWVdSbGNrWnliMjBwSUNCOGZDQXdPMXh1WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZEc5MFlXd29jR0Z5YzJWSmJuUW9hR1ZoWkdWeVEyOTFiblFwS1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCeVpYTjFiSFJ6UTI5MWJuUW9kRzhnTFNCbWNtOXRLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdJQ0FnSUhSeWVTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdTbE5QVGk1d1lYSnpaU2g0YUhJdWNtVnpjRzl1YzJWVVpYaDBLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdlR2h5TG5KbGMzQnZibk5sVkdWNGREdGNiaUFnSUNBZ0lDQWdJQ0FnSUgwZ1kyRjBZMmdnS0dWNEtTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdjbVYwZFhKdUlFcFRUMDR1YzNSeWFXNW5hV1o1S0h0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdhR2x1ZERvZ2JuVnNiQ3hjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1pHVjBZV2xzY3pvZ2JuVnNiQ3hjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1kyOWtaVG9nTUN4Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdiV1Z6YzJGblpUb2dlR2h5TG5KbGMzQnZibk5sVkdWNGRGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIMHBPMXh1SUNBZ0lDQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQjlPMXh1SUNBZ0lDQWdJQ0JwYzB4dllXUnBibWNvZEhKMVpTazdYRzRnSUNBZ0lDQWdJSEJoWjJWU1pYRjFaWE4wS0dacGJIUmxjbk1vS1N3Z2NHRm5aU2dwTENCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0JpWVdOclozSnZkVzVrT2lCMGNuVmxMRnh1SUNBZ0lDQWdJQ0FnSUNBZ1pYaDBjbUZqZERvZ1oyVjBWRzkwWVd4Y2JpQWdJQ0FnSUNBZ2ZTd2daWGgwY21GSVpXRmtaWEp6S1M1MGFHVnVLQ2hrWVhSaEtTQTlQaUI3WEc0Z0lDQWdJQ0FnSUNBZ0lDQmpiMnhzWldOMGFXOXVLRjh1ZFc1cGIyNG9ZMjlzYkdWamRHbHZiaWdwTENCa1lYUmhLU2s3WEc0Z0lDQWdJQ0FnSUNBZ0lDQnBjMHh2WVdScGJtY29abUZzYzJVcE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnWkM1eVpYTnZiSFpsS0dOdmJHeGxZM1JwYjI0b0tTazdYRzRnSUNBZ0lDQWdJQ0FnSUNCdExuSmxaSEpoZHlncE8xeHVJQ0FnSUNBZ0lDQjlMQ0FvWlhKeWIzSXBJRDArSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJR2x6VEc5aFpHbHVaeWhtWVd4elpTazdYRzRnSUNBZ0lDQWdJQ0FnSUNCMGIzUmhiQ2d3S1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJR1F1Y21WcVpXTjBLR1Z5Y205eUtUdGNiaUFnSUNBZ0lDQWdJQ0FnSUcwdWNtVmtjbUYzS0NrN1hHNGdJQ0FnSUNBZ0lIMHBPMXh1SUNBZ0lDQWdJQ0J5WlhSMWNtNGdaQzV3Y205dGFYTmxPMXh1SUNBZ0lIMHNYRzVjYmlBZ0lDQm1hWEp6ZEZCaFoyVWdQU0FvY0dGeVlXMWxkR1Z5Y3lrZ1BUNGdlMXh1SUNBZ0lDQWdJQ0JtYVd4MFpYSnpLRjh1WlhoMFpXNWtLSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lHOXlaR1Z5T2lCa1pXWmhkV3gwVDNKa1pYSmNiaUFnSUNBZ0lDQWdmU3dnY0dGeVlXMWxkR1Z5Y3lrcE8xeHVJQ0FnSUNBZ0lDQmpiMnhzWldOMGFXOXVLRnRkS1R0Y2JpQWdJQ0FnSUNBZ2NHRm5aU2d4S1R0Y2JpQWdJQ0FnSUNBZ2NtVjBkWEp1SUdabGRHTm9LQ2s3WEc0Z0lDQWdmU3hjYmx4dUlDQWdJR2x6VEdGemRGQmhaMlVnUFNBb0tTQTlQaUI3WEc0Z0lDQWdJQ0FnSUhKbGRIVnliaUFvYlc5a1pXd3VjR0ZuWlZOcGVtVW9LU0ErSUhKbGMzVnNkSE5EYjNWdWRDZ3BLVHRjYmlBZ0lDQjlMRnh1WEc0Z0lDQWdibVY0ZEZCaFoyVWdQU0FvS1NBOVBpQjdYRzRnSUNBZ0lDQWdJSEJoWjJVb2NHRm5aU2dwSUNzZ01TazdYRzRnSUNBZ0lDQWdJSEpsZEhWeWJpQm1aWFJqYUNncE8xeHVJQ0FnSUgwN1hHNWNiaUFnSUNCeVpYUjFjbTRnZTF4dUlDQWdJQ0FnSUNCamIyeHNaV04wYVc5dU9pQmpiMnhzWldOMGFXOXVMRnh1SUNBZ0lDQWdJQ0JtYVhKemRGQmhaMlU2SUdacGNuTjBVR0ZuWlN4Y2JpQWdJQ0FnSUNBZ2FYTk1iMkZrYVc1bk9pQnBjMHh2WVdScGJtY3NYRzRnSUNBZ0lDQWdJRzVsZUhSUVlXZGxPaUJ1WlhoMFVHRm5aU3hjYmlBZ0lDQWdJQ0FnYVhOTVlYTjBVR0ZuWlRvZ2FYTk1ZWE4wVUdGblpTeGNiaUFnSUNBZ0lDQWdkRzkwWVd3NklIUnZkR0ZzTEZ4dUlDQWdJQ0FnSUNCeVpYTjFiSFJ6UTI5MWJuUTZJSEpsYzNWc2RITkRiM1Z1ZEZ4dUlDQWdJSDA3WEc1OU8xeHVYRzVsZUhCdmNuUWdaR1ZtWVhWc2RDQndZV2RwYm1GMGFXOXVWazA3WEc0aUxDSnBiWEJ2Y25RZ2JTQm1jbTl0SUNkdGFYUm9jbWxzSnp0Y2JtbHRjRzl5ZENCZklHWnliMjBnSjNWdVpHVnljMk52Y21Vbk8xeHVhVzF3YjNKMElHWnBiSFJsY25OV1RTQm1jbTl0SUNjdUwzWnRjeTltYVd4MFpYSnpWazBuTzF4dWFXMXdiM0owSUhCaFoybHVZWFJwYjI1V1RTQm1jbTl0SUNjdUwzWnRjeTl3WVdkcGJtRjBhVzl1Vmswbk8xeHVYRzVtZFc1amRHbHZiaUJRYjNOMFozSmxjM1FnS0NrZ2UxeHVJQ0FnSUd4bGRDQndiM04wWjNKbGMzUWdQU0I3ZlR0Y2JseHVJQ0FnSUdOdmJuTjBJSFJ2YTJWdUlEMGdiUzV3Y205d0tDa3NYRzVjYmlBZ0lDQWdJQ0FnSUNCdFpYSm5aVU52Ym1acFp5QTlJQ2hqYjI1bWFXY3NJRzl3ZEdsdmJuTXBJRDArSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnY21WMGRYSnVJRzl3ZEdsdmJuTWdKaVlnWHk1cGMwWjFibU4wYVc5dUtHOXdkR2x2Ym5NdVkyOXVabWxuS1NBL0lGOHVZMjl0Y0c5elpTaHZjSFJwYjI1ekxtTnZibVpwWnl3Z1kyOXVabWxuS1NBNklHTnZibVpwWnp0Y2JpQWdJQ0FnSUNBZ0lDQjlMRnh1WEc0Z0lDQWdJQ0FnSUNBZ1lXUmtTR1ZoWkdWeWN5QTlJQ2hvWldGa1pYSnpLU0E5UGlCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUFvZUdoeUtTQTlQaUI3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCZkxtVmhZMmdvYUdWaFpHVnljeXdnS0haaGJIVmxMQ0JyWlhrcElEMCtJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjRhSEl1YzJWMFVtVnhkV1Z6ZEVobFlXUmxjaWhyWlhrc0lIWmhiSFZsS1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIMHBPMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnY21WMGRYSnVJSGhvY2p0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnZlR0Y2JpQWdJQ0FnSUNBZ0lDQjlMRnh1WEc0Z0lDQWdJQ0FnSUNBZ1lXUmtRMjl1Wm1sblNHVmhaR1Z5Y3lBOUlDaG9aV0ZrWlhKekxDQnZjSFJwYjI1ektTQTlQaUI3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQmZMbVY0ZEdWdVpDaDdmU3dnYjNCMGFXOXVjeXdnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1kyOXVabWxuT2lCdFpYSm5aVU52Ym1acFp5aGhaR1JJWldGa1pYSnpLR2hsWVdSbGNuTXBMQ0J2Y0hScGIyNXpLVnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQjlLVHRjYmlBZ0lDQWdJQ0FnSUNCOUxGeHVYRzRnSUNBZ0lDQWdJQ0FnWTNKbFlYUmxURzloWkdWeUlEMGdLSEpsY1hWbGMzUkdkVzVqZEdsdmJpd2diM0IwYVc5dWN5d2daR1ZtWVhWc2RGTjBZWFJsSUQwZ1ptRnNjMlVwSUQwK0lIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ1kyOXVjM1FnYkc5aFpHVnlJRDBnYlM1d2NtOXdLR1JsWm1GMWJIUlRkR0YwWlNrc1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR1FnUFNCdExtUmxabVZ5Y21Wa0tDazdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lHeHZZV1JsY2k1c2IyRmtJRDBnS0NrZ1BUNGdlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYkc5aFpHVnlLSFJ5ZFdVcE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdiUzV5WldSeVlYY29LVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhKbGNYVmxjM1JHZFc1amRHbHZiaWhmTG1WNGRHVnVaQ2g3ZlN3Z2IzQjBhVzl1Y3l3Z2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdKaFkydG5jbTkxYm1RNklIUnlkV1ZjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUgwcEtTNTBhR1Z1S0Noa1lYUmhLU0E5UGlCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYkc5aFpHVnlLR1poYkhObEtUdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCa0xuSmxjMjlzZG1Vb1pHRjBZU2s3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdiUzV5WldSeVlYY29LVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUgwc0lDaGxjbkp2Y2lrZ1BUNGdlMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHeHZZV1JsY2lobVlXeHpaU2s3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdaQzV5WldwbFkzUW9aWEp5YjNJcE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUcwdWNtVmtjbUYzS0NrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUJrTG5CeWIyMXBjMlU3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJSDA3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQnNiMkZrWlhJN1hHNGdJQ0FnSUNBZ0lDQWdmU3hjYmx4dUlDQWdJQ0FnSUNBZ0lISmxjSEpsYzJWdWRHRjBhVzl1U0dWaFpHVnlJRDBnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FuVUhKbFptVnlKem9nSjNKbGRIVnliajF5WlhCeVpYTmxiblJoZEdsdmJpZGNiaUFnSUNBZ0lDQWdJQ0I5TzF4dVhHNGdJQ0FnY0c5emRHZHlaWE4wTG5SdmEyVnVJRDBnZEc5clpXNDdYRzVjYmlBZ0lDQndiM04wWjNKbGMzUXVhVzVwZENBOUlDaGhjR2xRY21WbWFYZ3NJR0YxZEdobGJuUnBZMkYwYVc5dVQzQjBhVzl1Y3lrZ1BUNGdlMXh1SUNBZ0lDQWdJQ0J3YjNOMFozSmxjM1F1Y21WeGRXVnpkQ0E5SUNodmNIUnBiMjV6S1NBOVBpQjdYRzRnSUNBZ0lDQWdJQ0FnSUNCamIyNXpkQ0JsY25KdmNraGhibVJzWlhJZ1BTQW9lR2h5S1NBOVBpQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdkSEo1SUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdTbE5QVGk1d1lYSnpaU2g0YUhJdWNtVnpjRzl1YzJWVVpYaDBLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2NtVjBkWEp1SUhob2NpNXlaWE53YjI1elpWUmxlSFE3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZlNCallYUmphQ0FvWlhncElIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnY21WMGRYSnVJRXBUVDA0dWMzUnlhVzVuYVdaNUtIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHaHBiblE2SUc1MWJHd3NYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQmtaWFJoYVd4ek9pQnVkV3hzTEZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnWTI5a1pUb2dNQ3hjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJRzFsYzNOaFoyVTZJSGhvY2k1eVpYTndiMjV6WlZSbGVIUmNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZlNrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQWdJQ0FnZlR0Y2JpQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQnRMbkpsY1hWbGMzUW9YeTVsZUhSbGJtUW9lMlY0ZEhKaFkzUTZJR1Z5Y205eVNHRnVaR3hsY24wc0lHOXdkR2x2Ym5Nc0lIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjFjbXc2SUdGd2FWQnlaV1pwZUNBcklHOXdkR2x2Ym5NdWRYSnNYRzRnSUNBZ0lDQWdJQ0FnSUNCOUtTazdYRzRnSUNBZ0lDQWdJSDA3WEc1Y2JpQWdJQ0FnSUNBZ2NHOXpkR2R5WlhOMExtRjFkR2hsYm5ScFkyRjBaU0E5SUNncElEMCtJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lHTnZibk4wSUdSbFptVnljbVZrSUQwZ2JTNWtaV1psY25KbFpDZ3BPMXh1SUNBZ0lDQWdJQ0FnSUNBZ2FXWWdLSFJ2YTJWdUtDa3BJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JrWldabGNuSmxaQzV5WlhOdmJIWmxLSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2RHOXJaVzQ2SUhSdmEyVnVLQ2xjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0I5S1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJSDBnWld4elpTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdiUzV5WlhGMVpYTjBLRjh1WlhoMFpXNWtLSHQ5TENCaGRYUm9aVzUwYVdOaGRHbHZiazl3ZEdsdmJuTXBLUzUwYUdWdUtDaGtZWFJoS1NBOVBpQjdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhSdmEyVnVLR1JoZEdFdWRHOXJaVzRwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQmtaV1psY25KbFpDNXlaWE52YkhabEtIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIUnZhMlZ1T2lCMGIydGxiaWdwWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIMHBPMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDBzSUNoa1lYUmhLU0E5UGlCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR1JsWm1WeWNtVmtMbkpsYW1WamRDaGtZWFJoS1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCOUtUdGNiaUFnSUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQmtaV1psY25KbFpDNXdjbTl0YVhObE8xeHVJQ0FnSUNBZ0lDQjlPMXh1WEc0Z0lDQWdJQ0FnSUhCdmMzUm5jbVZ6ZEM1eVpYRjFaWE4wVjJsMGFGUnZhMlZ1SUQwZ0tHOXdkR2x2Ym5NcElEMCtJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCd2IzTjBaM0psYzNRdVlYVjBhR1Z1ZEdsallYUmxLQ2t1ZEdobGJpaGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQW9LU0E5UGlCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQndiM04wWjNKbGMzUXVjbVZ4ZFdWemRDaGhaR1JEYjI1bWFXZElaV0ZrWlhKektIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDZEJkWFJvYjNKcGVtRjBhVzl1SnpvZ0owSmxZWEpsY2lBbklDc2dkRzlyWlc0b0tWeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0I5TENCdmNIUnBiMjV6S1NrN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2ZTd2dLQ2tnUFQ0Z2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdjRzl6ZEdkeVpYTjBMbkpsY1hWbGMzUW9iM0IwYVc5dWN5azdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0FnSUNBZ0tUdGNiaUFnSUNBZ0lDQWdmVHRjYmx4dUlDQWdJQ0FnSUNCd2IzTjBaM0psYzNRdWJHOWhaR1Z5SUQwZ1h5NXdZWEowYVdGc0tHTnlaV0YwWlV4dllXUmxjaXdnY0c5emRHZHlaWE4wTG5KbGNYVmxjM1FwTzF4dUlDQWdJQ0FnSUNCY2JpQWdJQ0FnSUNBZ2NHOXpkR2R5WlhOMExteHZZV1JsY2xkcGRHaFViMnRsYmlBOUlGOHVjR0Z5ZEdsaGJDaGpjbVZoZEdWTWIyRmtaWElzSUhCdmMzUm5jbVZ6ZEM1eVpYRjFaWE4wVjJsMGFGUnZhMlZ1S1R0Y2JseHVJQ0FnSUNBZ0lDQndiM04wWjNKbGMzUXViVzlrWld3Z1BTQW9ibUZ0WlNrZ1BUNGdlMXh1SUNBZ0lDQWdJQ0FnSUNBZ1kyOXVjM1FnY0dGbmFXNWhkR2x2YmtobFlXUmxjbk1nUFNBb2NHRm5aU3dnY0dGblpWTnBlbVVwSUQwK0lIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnBaaUFvSVhCaFoyVlRhWHBsS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJqdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlYRzVjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JqYjI1emRDQjBiMUpoYm1kbElEMGdLQ2tnUFQ0Z2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JqYjI1emRDQm1jbTl0SUQwZ0tIQmhaMlVnTFNBeEtTQXFJSEJoWjJWVGFYcGxMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0IwYnlBOUlHWnliMjBnS3lCd1lXZGxVMmw2WlNBdElERTdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUJtY205dElDc2dKeTBuSUNzZ2RHODdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmVHRjYmx4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUI3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDZFNZVzVuWlMxMWJtbDBKem9nSjJsMFpXMXpKeXhjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0oxSmhibWRsSnpvZ2RHOVNZVzVuWlNncFhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2ZUdGNiaUFnSUNBZ0lDQWdJQ0FnSUgwc1hHNWNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEJoWjJWVGFYcGxJRDBnYlM1d2NtOXdLREV3S1N4Y2JseHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdibUZ0WlU5d2RHbHZibk1nUFNCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZFhKc09pQW5MeWNnS3lCdVlXMWxYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0I5TEZ4dVhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQm5aWFJQY0hScGIyNXpJRDBnS0dSaGRHRXNJSEJoWjJVc0lIQmhaMlZUYVhwbExDQnZjSFJwYjI1ekxDQm9aV0ZrWlhKeklEMGdlMzBwSUQwK0lIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCamIyNXpkQ0JsZUhSeVlVaGxZV1JsY25NZ1BTQmZMbVY0ZEdWdVpDaDdmU3dnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBblVISmxabVZ5SnpvZ0oyTnZkVzUwUFc1dmJtVW5YRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2ZTd2dhR1ZoWkdWeWN5d2djR0ZuYVc1aGRHbHZia2hsWVdSbGNuTW9jR0ZuWlN3Z2NHRm5aVk5wZW1VcEtUdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCeVpYUjFjbTRnWVdSa1EyOXVabWxuU0dWaFpHVnljeWhsZUhSeVlVaGxZV1JsY25Nc0lGOHVaWGgwWlc1a0tIdDlMQ0J2Y0hScGIyNXpMQ0J1WVcxbFQzQjBhVzl1Y3l3Z2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnRaWFJvYjJRNklDZEhSVlFuTEZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCa1lYUmhPaUJrWVhSaFhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnZlNrcE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmU3hjYmx4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2NYVmxjbmx6ZEhKcGJtY2dQU0FvWm1sc2RHVnljeXdnYjNCMGFXOXVjeWtnUFQ0Z2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUc5d2RHbHZibk11ZFhKc0lDczlJQ2MvSnlBcklHMHVjbTkxZEdVdVluVnBiR1JSZFdWeWVWTjBjbWx1WnlobWFXeDBaWEp6S1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdiM0IwYVc5dWN6dGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSDBzWEc1Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHOXdkR2x2Ym5NZ1BTQW9iM0IwYVc5dWN5a2dQVDRnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEpsZEhWeWJpQndiM04wWjNKbGMzUXVjbVZ4ZFdWemRDaGZMbVY0ZEdWdVpDaDdmU3dnYjNCMGFXOXVjeXdnYm1GdFpVOXdkR2x2Ym5Nc0lIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdiV1YwYUc5a09pQW5UMUJVU1U5T1V5ZGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCOUtTazdYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0I5TEZ4dVhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQndiM04wVDNCMGFXOXVjeUE5SUNoaGRIUnlhV0oxZEdWekxDQnZjSFJwYjI1ekxDQm9aV0ZrWlhKeklEMGdlMzBwSUQwK0lIdGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCamIyNXpkQ0JsZUhSeVlVaGxZV1JsY25NZ1BTQmZMbVY0ZEdWdVpDaDdmU3dnY21Wd2NtVnpaVzUwWVhScGIyNUlaV0ZrWlhJc0lHaGxZV1JsY25NcE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUJoWkdSRGIyNW1hV2RJWldGa1pYSnpLRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JsZUhSeVlVaGxZV1JsY25Nc1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lGOHVaWGgwWlc1a0tIdDlMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J2Y0hScGIyNXpMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J1WVcxbFQzQjBhVzl1Y3l3Z2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnYldWMGFHOWtPaUFuVUU5VFZDY3NYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCa1lYUmhPaUJoZEhSeWFXSjFkR1Z6WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUgxY2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBcFhHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnS1R0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lIMHNYRzVjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdSbGJHVjBaVTl3ZEdsdmJuTWdQU0FvWm1sc2RHVnljeXdnYjNCMGFXOXVjeXdnYUdWaFpHVnljeUE5SUh0OUtTQTlQaUI3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdZMjl1YzNRZ1pYaDBjbUZJWldGa1pYSnpJRDBnWVdSa1NHVmhaR1Z5Y3loZkxtVjRkR1Z1WkNoN2ZTd2dhR1ZoWkdWeWN5a3BPMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lISmxkSFZ5YmlCeGRXVnllWE4wY21sdVp5aG1hV3gwWlhKekxDQmhaR1JEYjI1bWFXZElaV0ZrWlhKektHVjRkSEpoU0dWaFpHVnljeXdnWHk1bGVIUmxibVFvZTMwc0lHOXdkR2x2Ym5Nc0lHNWhiV1ZQY0hScGIyNXpMQ0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUcxbGRHaHZaRG9nSjBSRlRFVlVSU2RjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQjlLU2twTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2ZTeGNibHh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnY0dGMFkyaFBjSFJwYjI1eklEMGdLR1pwYkhSbGNuTXNJR0YwZEhKcFluVjBaWE1zSUc5d2RHbHZibk1zSUdobFlXUmxjbk1nUFNCN2ZTa2dQVDRnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR052Ym5OMElHVjRkSEpoU0dWaFpHVnljeUE5SUY4dVpYaDBaVzVrS0h0OUxDQnlaWEJ5WlhObGJuUmhkR2x2YmtobFlXUmxjaXdnYUdWaFpHVnljeWs3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdjbVYwZFhKdUlIRjFaWEo1YzNSeWFXNW5LRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JtYVd4MFpYSnpMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0JoWkdSRGIyNW1hV2RJWldGa1pYSnpLRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1pYaDBjbUZJWldGa1pYSnpMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1h5NWxlSFJsYm1Rb2UzMHNYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCdmNIUnBiMjV6TEZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdibUZ0WlU5d2RHbHZibk1zSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNCdFpYUm9iMlE2SUNkUVFWUkRTQ2NzWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnWkdGMFlUb2dZWFIwY21saWRYUmxjMXh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FwWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNsY2JpQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FwTzF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2ZTeGNibHh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnWjJWMFVHRm5aVTl3ZEdsdmJuTWdQU0FvWkdGMFlTd2djR0ZuWlN3Z2IzQjBhVzl1Y3l3Z2FHVmhaR1Z5Y3lBOUlIdDlLU0E5UGlCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnY21WMGRYSnVJR2RsZEU5d2RHbHZibk1vWkdGMFlTd2dLSEJoWjJVZ2ZId2dNU2tzSUhCaFoyVlRhWHBsS0Nrc0lHOXdkR2x2Ym5Nc0lHaGxZV1JsY25NcE8xeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdmU3hjYmx4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ1oyVjBVbTkzVDNCMGFXOXVjeUE5SUNoa1lYUmhMQ0J2Y0hScGIyNXpMQ0JvWldGa1pYSnpJRDBnZTMwcElEMCtJSHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lDQnlaWFIxY200Z1oyVjBUM0IwYVc5dWN5aGtZWFJoTENBeExDQXhMQ0J2Y0hScGIyNXpMQ0JvWldGa1pYSnpLVHRjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUgwN1hHNWNiaUFnSUNBZ0lDQWdJQ0FnSUhKbGRIVnliaUI3WEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnY0dGblpWTnBlbVU2SUhCaFoyVlRhWHBsTEZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUdkbGRGQmhaMlZQY0hScGIyNXpPaUJuWlhSUVlXZGxUM0IwYVc5dWN5eGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQm5aWFJTYjNkUGNIUnBiMjV6T2lCblpYUlNiM2RQY0hScGIyNXpMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEJoZEdOb1QzQjBhVzl1Y3pvZ2NHRjBZMmhQY0hScGIyNXpMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEJ2YzNSUGNIUnBiMjV6T2lCd2IzTjBUM0IwYVc5dWN5eGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQmtaV3hsZEdWUGNIUnBiMjV6T2lCa1pXeGxkR1ZQY0hScGIyNXpMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR2RsZEZCaFoyVTZJRjh1WTI5dGNHOXpaU2h3YjNOMFozSmxjM1F1Y21WeGRXVnpkQ3dnWjJWMFVHRm5aVTl3ZEdsdmJuTXBMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJR2RsZEZKdmR6b2dYeTVqYjIxd2IzTmxLSEJ2YzNSbmNtVnpkQzV5WlhGMVpYTjBMQ0JuWlhSU2IzZFBjSFJwYjI1ektTeGNiaUFnSUNBZ0lDQWdJQ0FnSUNBZ0lDQndZWFJqYURvZ1h5NWpiMjF3YjNObEtIQnZjM1JuY21WemRDNXlaWEYxWlhOMExDQndZWFJqYUU5d2RHbHZibk1wTEZ4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhCdmMzUTZJRjh1WTI5dGNHOXpaU2h3YjNOMFozSmxjM1F1Y21WeGRXVnpkQ3dnY0c5emRFOXdkR2x2Ym5NcExGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHUmxiR1YwWlZKbGNYVmxjM1E2SUY4dVkyOXRjRzl6WlNod2IzTjBaM0psYzNRdWNtVnhkV1Z6ZEN3Z1pHVnNaWFJsVDNCMGFXOXVjeWtzWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnWjJWMFVHRm5aVmRwZEdoVWIydGxiam9nWHk1amIyMXdiM05sS0hCdmMzUm5jbVZ6ZEM1eVpYRjFaWE4wVjJsMGFGUnZhMlZ1TENCblpYUlFZV2RsVDNCMGFXOXVjeWtzWEc0Z0lDQWdJQ0FnSUNBZ0lDQWdJQ0FnWjJWMFVtOTNWMmwwYUZSdmEyVnVPaUJmTG1OdmJYQnZjMlVvY0c5emRHZHlaWE4wTG5KbGNYVmxjM1JYYVhSb1ZHOXJaVzRzSUdkbGRGSnZkMDl3ZEdsdmJuTXBMRnh1SUNBZ0lDQWdJQ0FnSUNBZ0lDQWdJSEJoZEdOb1YybDBhRlJ2YTJWdU9pQmZMbU52YlhCdmMyVW9jRzl6ZEdkeVpYTjBMbkpsY1hWbGMzUlhhWFJvVkc5clpXNHNJSEJoZEdOb1QzQjBhVzl1Y3lrc1hHNGdJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ2NHOXpkRmRwZEdoVWIydGxiam9nWHk1amIyMXdiM05sS0hCdmMzUm5jbVZ6ZEM1eVpYRjFaWE4wVjJsMGFGUnZhMlZ1TENCd2IzTjBUM0IwYVc5dWN5a3NYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdaR1ZzWlhSbFYybDBhRlJ2YTJWdU9pQmZMbU52YlhCdmMyVW9jRzl6ZEdkeVpYTjBMbkpsY1hWbGMzUlhhWFJvVkc5clpXNHNJR1JsYkdWMFpVOXdkR2x2Ym5NcExGeHVJQ0FnSUNBZ0lDQWdJQ0FnSUNBZ0lHOXdkR2x2Ym5NNklHOXdkR2x2Ym5OY2JpQWdJQ0FnSUNBZ0lDQWdJSDA3WEc0Z0lDQWdJQ0FnSUgwN1hHNWNiaUFnSUNBZ0lDQWdjbVYwZFhKdUlIQnZjM1JuY21WemREdGNiaUFnSUNCOU8xeHVYRzRnSUNBZ2NHOXpkR2R5WlhOMExtWnBiSFJsY25OV1RTQTlJR1pwYkhSbGNuTldUVHRjYmlBZ0lDQndiM04wWjNKbGMzUXVjR0ZuYVc1aGRHbHZibFpOSUQwZ2NHRm5hVzVoZEdsdmJsWk5PMXh1SUNCY2JpQWdJQ0J5WlhSMWNtNGdjRzl6ZEdkeVpYTjBPMXh1ZlZ4dVhHNWxlSEJ2Y25RZ1pHVm1ZWFZzZENCUWIzTjBaM0psYzNRN1hHNGlYU3dpYm1GdFpYTWlPbHNpWm1sc2RHVnljMVpOSWl3aVlYUjBjbWxpZFhSbGN5SXNJbTVsZDFaTklpd2labWxzZEdWeUlpd2ljSEp2Y0NJc0ltMGlMQ0ptYVd4MFpYSlFjbTl3SWl3aWRtRnNkV1VpTENKaGNtZDFiV1Z1ZEhNaUxDSnNaVzVuZEdnaUxDSjBiMFpwYkhSbGNpSXNJbDhpTENKcGMxTjBjbWx1WnlJc0luUnlhVzBpTENKblpYUjBaWEp6SWl3aWNtVmtkV05sSWl3aWJXVnRieUlzSW05d1pYSmhkRzl5SWl3aVlYUjBjaUlzSW5CaGNtRnRaWFJsY25OWGFYUm9iM1YwVDNKa1pYSWlMQ0puWlhSMFpYSWlMQ0pwYzBaMWJtTjBhVzl1SWl3aWRXNWtaV1pwYm1Wa0lpd2ljbVZ3YkdGalpTSXNJbXgwWlNJc0ltZDBaU0lzSW5CMWMyZ2lMQ0p3WVhKaGJXVjBaWEp6SWl3aWIzSmtaWElpTENKa2FYSmxZM1JwYjI0aUxDSnFiMmx1SWl3aWIzSmtaWEpRWVhKaGJXVjBaWElpTENKbGVIUmxibVFpTENKd1lXZHBibUYwYVc5dVZrMGlMQ0p0YjJSbGJDSXNJbVY0ZEhKaFNHVmhaR1Z5Y3lJc0ltRjFkR2hsYm5ScFkyRjBaU0lzSW1OdmJHeGxZM1JwYjI0aUxDSmtaV1poZFd4MFQzSmtaWElpTENKbWFXeDBaWEp6SWl3aWFYTk1iMkZrYVc1bklpd2ljR0ZuWlNJc0luSmxjM1ZzZEhORGIzVnVkQ0lzSW5CaFoyVlNaWEYxWlhOMElpd2laMlYwVUdGblpWZHBkR2hVYjJ0bGJpSXNJbWRsZEZCaFoyVWlMQ0owYjNSaGJDSXNJbVpsZEdOb0lpd2laQ0lzSW1SbFptVnljbVZrSWl3aVoyVjBWRzkwWVd3aUxDSjRhSElpTENKemRHRjBkWE1pTENKS1UwOU9JaXdpYzNSeWFXNW5hV1o1SWl3aWNtRnVaMlZJWldGa1pYSWlMQ0puWlhSU1pYTndiMjV6WlVobFlXUmxjaUlzSW5Od2JHbDBJaXdpYUdWaFpHVnlVMmw2WlNJc0ltaGxZV1JsY2tOdmRXNTBJaXdpYUdWaFpHVnlSbkp2YlNJc0ltaGxZV1JsY2xSdklpd2lkRzhpTENKd1lYSnpaVWx1ZENJc0ltWnliMjBpTENKeVpYTndiMjV6WlZSbGVIUWlMQ0psZUNJc0luUm9aVzRpTENKa1lYUmhJaXdpZFc1cGIyNGlMQ0p5WlhOdmJIWmxJaXdpY21Wa2NtRjNJaXdpWlhKeWIzSWlMQ0p5WldwbFkzUWlMQ0p3Y205dGFYTmxJaXdpWm1seWMzUlFZV2RsSWl3aWFYTk1ZWE4wVUdGblpTSXNJbkJoWjJWVGFYcGxJaXdpYm1WNGRGQmhaMlVpTENKUWIzTjBaM0psYzNRaUxDSndiM04wWjNKbGMzUWlMQ0owYjJ0bGJpSXNJbTFsY21kbFEyOXVabWxuSWl3aVkyOXVabWxuSWl3aWIzQjBhVzl1Y3lJc0ltTnZiWEJ2YzJVaUxDSmhaR1JJWldGa1pYSnpJaXdpYUdWaFpHVnljeUlzSW1WaFkyZ2lMQ0pyWlhraUxDSnpaWFJTWlhGMVpYTjBTR1ZoWkdWeUlpd2lZV1JrUTI5dVptbG5TR1ZoWkdWeWN5SXNJbU55WldGMFpVeHZZV1JsY2lJc0luSmxjWFZsYzNSR2RXNWpkR2x2YmlJc0ltUmxabUYxYkhSVGRHRjBaU0lzSW14dllXUmxjaUlzSW14dllXUWlMQ0p5WlhCeVpYTmxiblJoZEdsdmJraGxZV1JsY2lJc0ltbHVhWFFpTENKaGNHbFFjbVZtYVhnaUxDSmhkWFJvWlc1MGFXTmhkR2x2Yms5d2RHbHZibk1pTENKeVpYRjFaWE4wSWl3aVpYSnliM0pJWVc1a2JHVnlJaXdpWlhoMGNtRmpkQ0lzSW5WeWJDSXNJbkpsY1hWbGMzUlhhWFJvVkc5clpXNGlMQ0p3WVhKMGFXRnNJaXdpYkc5aFpHVnlWMmwwYUZSdmEyVnVJaXdpYm1GdFpTSXNJbkJoWjJsdVlYUnBiMjVJWldGa1pYSnpJaXdpZEc5U1lXNW5aU0lzSW01aGJXVlBjSFJwYjI1eklpd2laMlYwVDNCMGFXOXVjeUlzSW5GMVpYSjVjM1J5YVc1bklpd2ljbTkxZEdVaUxDSmlkV2xzWkZGMVpYSjVVM1J5YVc1bklpd2ljRzl6ZEU5d2RHbHZibk1pTENKa1pXeGxkR1ZQY0hScGIyNXpJaXdpY0dGMFkyaFBjSFJwYjI1eklpd2laMlYwVUdGblpVOXdkR2x2Ym5NaUxDSm5aWFJTYjNkUGNIUnBiMjV6SWwwc0ltMWhjSEJwYm1keklqb2lPenM3T3pzN1FVRkhRU3hKUVVGTlFTeFpRVUZaTEZOQlFWcEJMRk5CUVZrc1EwRkJRME1zVlVGQlJDeEZRVUZuUWp0UlFVTXhRa01zVVVGQlVTeEZRVUZhTzFGQlEwbERMRk5CUVZNc1UwRkJWRUVzVFVGQlV5eEhRVUZOTzFsQlEweERMRTlCUVU5RExFVkJRVVZFTEVsQlFVWXNRMEZCVHl4RlFVRlFMRU5CUVdJN1dVRkRTVVVzWVVGQllTeFRRVUZpUVN4VlFVRmhMRU5CUVZWRExFdEJRVllzUlVGQmFVSTdaMEpCUTNSQ1F5eFZRVUZWUXl4TlFVRldMRWRCUVcxQ0xFTkJRWFpDTEVWQlFUQkNPM0ZDUVVOcVFrWXNTMEZCVER0MVFrRkRUMHdzUzBGQlVEczdiVUpCUlVkRkxFMUJRVkE3VTBGT1VqczdiVUpCVTFkTkxGRkJRVmdzUjBGQmMwSXNXVUZCVFR0dFFrRkRha0pETEVWQlFVVkRMRkZCUVVZc1EwRkJWMDRzV1VGQldDeEpRVUV5UWtFc1lVRkJZVThzU1VGQllpeEZRVUV6UWl4SFFVRnBSRkFzV1VGQmVFUTdVMEZFU2p0bFFVZFBRU3hWUVVGUU8wdEJaRkk3VVVGcFFrbFJMRlZCUVZWSUxFVkJRVVZKTEUxQlFVWXNRMEZEVG1Rc1ZVRkVUU3hGUVVOTkxGVkJRVU5sTEVsQlFVUXNSVUZCVDBNc1VVRkJVQ3hGUVVGcFFrTXNTVUZCYWtJc1JVRkJNRUk3T3pzN1dVRkpPVUpFTEdGQlFXRXNVMEZCYWtJc1JVRkJORUk3YVVKQlEyNUNReXhKUVVGTUxFbEJRV0U3Y1VKQlEwcG1MRkZCUkVrN2NVSkJSVXBCTzJGQlJsUTdVMEZFU2l4TlFVdFBPMmxDUVVORlpTeEpRVUZNTEVsQlFXRm1MRkZCUVdJN08yVkJSVWRoTEVsQlFWQTdTMEZpUlN4RlFXTklPMlZCUTFGaU8wdEJaa3dzUTBGcVFtUTdVVUZ2UTBsblFpeDVRa0ZCZVVJc1UwRkJla0pCTEhOQ1FVRjVRaXhIUVVGTk8yVkJRM0JDVWl4RlFVRkZTU3hOUVVGR0xFTkJRMGhFTEU5QlJFY3NSVUZEVFN4VlFVRkRSU3hKUVVGRUxFVkJRVTlKTEUxQlFWQXNSVUZCWlVZc1NVRkJaaXhGUVVGM1FqdG5Ra0ZEZWtKQkxGTkJRVk1zVDBGQllpeEZRVUZ6UWp0dlFrRkRXa1FzVjBGQlYyaENMRmRCUVZkcFFpeEpRVUZZTEVOQlFXcENPenR2UWtGRlNWQXNSVUZCUlZVc1ZVRkJSaXhEUVVGaFJDeFBRVUZQVml4UlFVRndRaXhOUVVGclExVXNUMEZCVDFZc1VVRkJVQ3hQUVVGelFsa3NVMEZCZEVJc1NVRkJiVU5HTEU5QlFVOVdMRkZCUVZBc1QwRkJjMElzUlVGQk0wWXNRMEZCU2l4RlFVRnZSenN5UWtGRGVrWk5MRWxCUVZBN096czdPenR2UWtGTlFVTXNZVUZCWVN4UFFVRmlMRWxCUVhkQ1FTeGhRVUZoTEUxQlFYcERMRVZCUVdsRU8zbENRVU40UTBNc1NVRkJUQ3hKUVVGaFJDeFhRVUZYTEVsQlFWZ3NSMEZCYTBKSExFOUJRVTlXTEZGQlFWQXNSVUZCYkVJc1IwRkJjME1zUjBGQmJrUTdhVUpCUkVvc1RVRkZUeXhKUVVGSlR5eGhRVUZoTEVsQlFXcENMRVZCUVhWQ08zbENRVU55UWtNc1NVRkJUQ3hKUVVGaFJDeFhRVUZYTEVkQlFWZ3NSMEZCYVVKSExFOUJRVTlXTEZGQlFWQXNSMEZCYTBKaExFOUJRV3hDTEVOQlFUQkNMRTFCUVRGQ0xFVkJRV3RETEVkQlFXeERMRU5CUVRsQ08ybENRVVJITEUxQlJVRXNTVUZCU1U0c1lVRkJZU3hUUVVGcVFpeEZRVUUwUWp0M1FrRkRNMElzUTBGQlEwY3NUMEZCVDBrc1IwRkJVQ3hEUVVGWFpDeFJRVUZZTEVWQlFVUXNTVUZCTUVJc1EwRkJRMVVzVDBGQlQwc3NSMEZCVUN4RFFVRlhaaXhSUVVGWUxFVkJRUzlDTEVWQlFYTkVPeXRDUVVNelEwMHNTVUZCVURzN2VVSkJSVU5GTEVsQlFVd3NTVUZCWVN4RlFVRmlPM2RDUVVOSlJTeFBRVUZQU3l4SFFVRlFMRVZCUVVvc1JVRkJhMEk3TmtKQlExUlFMRWxCUVV3c1JVRkJWMUVzU1VGQldDeERRVUZuUWl4VFFVRlRUaXhQUVVGUFN5eEhRVUZRTEVOQlFWZG1MRkZCUVZnc1JVRkJla0k3TzNkQ1FVVkJWU3hQUVVGUFNTeEhRVUZRTEVWQlFVb3NSVUZCYTBJN05rSkJRMVJPTEVsQlFVd3NSVUZCVjFFc1NVRkJXQ3hEUVVGblFpeFRRVUZUVGl4UFFVRlBTU3hIUVVGUUxFTkJRVmRrTEZGQlFWZ3NSVUZCZWtJN08ybENRVlJFTEUxQlYwRXNTVUZCU1U4c1lVRkJZU3hUUVVGcVFpeEZRVUUwUWp0NVFrRkRNVUpETEVsQlFVd3NTVUZCWVVVc1QwRkJUMVlzVVVGQlVDeFBRVUZ6UWl4SlFVRjBRaXhIUVVFMlFpeFRRVUUzUWl4SFFVRjVReXhoUVVGMFJEdHBRa0ZFUnl4TlFVVkJPM2xDUVVORlVTeEpRVUZNTEVsQlFXRkVMRmRCUVZjc1IwRkJXQ3hIUVVGcFFrY3NUMEZCVDFZc1VVRkJVQ3hGUVVFNVFqczdPMjFDUVVkRVRTeEpRVUZRTzFOQmFrTkVMRVZCYTBOQkxFVkJiRU5CTEVOQlFWQTdTMEZ5UTFJN1VVRXlSVWxYTEdGQlFXRXNVMEZCWWtFc1ZVRkJZU3hIUVVGTk96czdXVUZIVkVNc1VVRkJVU3hUUVVGU1FTeExRVUZSTEVkQlFVMDdiVUpCUTFSa0xGRkJRVkZqTEV0QlFWSXNUVUZCYlVKcVFpeEZRVUZGU1N4TlFVRkdMRU5CUTNSQ1JDeFJRVUZSWXl4TFFVRlNMRVZCUkhOQ0xFVkJRMHdzVlVGQlExb3NTVUZCUkN4RlFVRlBZU3hUUVVGUUxFVkJRV3RDV0N4SlFVRnNRaXhGUVVFeVFqdHhRa0ZEYmtOUkxFbEJRVXdzUTBGQlZWSXNUMEZCVHl4SFFVRlFMRWRCUVdGWExGTkJRWFpDTzNWQ1FVTlBZaXhKUVVGUU8yRkJTR3RDTEVWQlNXNUNMRVZCU20xQ0xFVkJTM2hDWXl4SlFVeDNRaXhEUVV0dVFpeEhRVXh0UWl4RFFVRXhRanRUUVVSS08xbEJVMGxETEdsQ1FVRnBRa2dzVlVGQlZUdHRRa0ZEYUVKQk8xTkJSRTBzUjBGRllpeEZRVmhTT3p0bFFXRlBha0lzUlVGQlJYRkNMRTFCUVVZc1EwRkJVeXhGUVVGVUxFVkJRV0ZFTEdOQlFXSXNSVUZCTmtKYUxIZENRVUUzUWl4RFFVRlFPMHRCTTBaU096dFhRU3RHVDFJc1JVRkJSWEZDTEUxQlFVWXNRMEZCVXpsQ0xFdEJRVlFzUlVGQlowSlpMRTlCUVdoQ0xFVkJRWGxDTzI5Q1FVTm9RbUVzVlVGRVowSTdaME5CUlVwU08wdEJSbkpDTEVOQlFWQTdRMEZvUjBvN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3T3pzN096czdPenM3UVVOQlFTeEpRVUZOWXl4bFFVRmxMRk5CUVdaQkxGbEJRV1VzUTBGQlEwTXNTMEZCUkN4RlFVRlJUaXhMUVVGU0xFVkJRVEJFTzFGQlFUTkRUeXhaUVVFeVF5eDFSVUZCTlVJc1JVRkJORUk3VVVGQmVFSkRMRmxCUVhkQ0xIVkZRVUZVTEVsQlFWTTdPMUZCUTNaRlF5eGhRVUZoYUVNc1JVRkJSVVFzU1VGQlJpeERRVUZQTEVWQlFWQXNRMEZCYWtJN1VVRkRTV3RETEdWQlFXVldMRk5CUVZNc1UwRkVOVUk3VVVGRlNWY3NWVUZCVld4RExFVkJRVVZFTEVsQlFVWXNRMEZCVHp0bFFVTk9hME03UzBGRVJDeERRVVprTzFGQlMwbEZMRmxCUVZsdVF5eEZRVUZGUkN4SlFVRkdMRU5CUVU4c1MwRkJVQ3hEUVV4b1FqdFJRVTFKY1VNc1QwRkJUM0JETEVWQlFVVkVMRWxCUVVZc1EwRkJUeXhEUVVGUUxFTkJUbGc3VVVGUFNYTkRMR1ZCUVdWeVF5eEZRVUZGUkN4SlFVRkdMRVZCVUc1Q08xRkJVVWwxUXl4alFVRmpVQ3hsUVVGbFJpeE5RVUZOVlN4blFrRkJja0lzUjBGQmQwTldMRTFCUVUxWExFOUJVbWhGTzFGQlUwbERMRkZCUVZGNlF5eEZRVUZGUkN4SlFVRkdMRVZCVkZvN08xRkJWMDB5UXl4UlFVRlJMRk5CUVZKQkxFdEJRVkVzUjBGQlRUdFpRVU5hUXl4SlFVRkpNME1zUlVGQlJUUkRMRkZCUVVZc1JVRkJVanRaUVVOTlF5eFhRVUZYTEZOQlFWaEJMRkZCUVZjc1EwRkJRME1zUjBGQlJDeEZRVUZUTzJkQ1FVTnNRaXhEUVVGRFFTeEhRVUZFTEVsQlFWRkJMRWxCUVVsRExFMUJRVW9zUzBGQlpTeERRVUV6UWl4RlFVRTRRanQxUWtGRGJrSkRMRXRCUVV0RExGTkJRVXdzUTBGQlpUc3dRa0ZEV2l4SlFVUlpPelpDUVVWVUxFbEJSbE03TUVKQlIxb3NRMEZJV1RzMlFrRkpWRHRwUWtGS1RpeERRVUZRT3p0blFrRlBRVU1zWTBGQlkwb3NTVUZCU1Vzc2FVSkJRVW9zUTBGQmMwSXNaVUZCZEVJc1EwRkJiRUk3WjBKQlEwazNReXhGUVVGRlF5eFJRVUZHTEVOQlFWY3lReXhYUVVGWUxFTkJRVW9zUlVGQk5rSTdlVU5CUTA5QkxGbEJRVmxGTEV0QlFWb3NRMEZCYTBJc1IwRkJiRUlzUTBGRVVEczdiMEpCUTNCQ1F5eFZRVVJ2UWp0dlFrRkRVa01zVjBGRVVUdDNRMEZGU1VRc1YwRkJWMFFzUzBGQldDeERRVUZwUWl4SFFVRnFRaXhEUVVaS096dHZRa0ZGY0VKSExGVkJSbTlDTzI5Q1FVVlNReXhSUVVaUk8yOUNRVWR5UWtNc1JVRkljVUlzUjBGSGFFSkRMRk5CUVZOR0xGRkJRVlFzU1VGQmNVSXNRMEZCY2tJc1NVRkJNRUlzUTBGSVZqdHZRa0ZKY2tKSExFbEJTbkZDTEVkQlNXUkVMRk5CUVZOSUxGVkJRVlFzUzBGQmVVSXNRMEZLV0RzN2MwSkJUVzVDUnl4VFFVRlRTaXhYUVVGVUxFTkJRVTQ3TmtKQlEyRkhMRXRCUVV0RkxFbEJRV3hDT3p0blFrRkZRVHQxUWtGRlQySXNTVUZCU1dNc1dVRkJXRHRoUVVaS0xFTkJSMFVzVDBGQlQwTXNSVUZCVUN4RlFVRlhPM1ZDUVVOR1lpeExRVUZMUXl4VFFVRk1MRU5CUVdVN01FSkJRMW9zU1VGRVdUczJRa0ZGVkN4SlFVWlRPekJDUVVkYUxFTkJTRms3TmtKQlNWUklMRWxCUVVsak8ybENRVXBXTEVOQlFWQTdPMU5CZGtKU08ydENRU3RDVlN4SlFVRldPMjlDUVVOWk1VSXNVMEZCV2l4RlFVRjFRa1VzVFVGQmRrSXNSVUZCSzBJN2QwSkJRMllzU1VGRVpUdHhRa0ZGYkVKVE8xTkJSbUlzUlVGSFIyWXNXVUZJU0N4RlFVZHBRbWRETEVsQlNHcENMRU5CUjNOQ0xGVkJRVU5ETEVsQlFVUXNSVUZCVlR0MVFrRkRha0o2UkN4RlFVRkZNRVFzUzBGQlJpeERRVUZSYUVNc1dVRkJVaXhGUVVGelFpdENMRWxCUVhSQ0xFTkJRVmc3YzBKQlExVXNTMEZCVmp0alFVTkZSU3hQUVVGR0xFTkJRVlZxUXl4WlFVRldPMk5CUTBWclF5eE5RVUZHTzFOQlVFb3NSVUZSUnl4VlFVRkRReXhMUVVGRUxFVkJRVmM3YzBKQlEwRXNTMEZCVmp0clFrRkRUU3hEUVVGT08yTkJRMFZETEUxQlFVWXNRMEZCVTBRc1MwRkJWRHRqUVVORlJDeE5RVUZHTzFOQldrbzdaVUZqVDNaQ0xFVkJRVVV3UWl4UFFVRlVPMHRCYUVSS08xRkJiVVJCUXl4WlFVRlpMRk5CUVZwQkxGTkJRVmtzUTBGQlEyaEVMRlZCUVVRc1JVRkJaMEk3WjBKQlEyaENhRUlzUlVGQlJYRkNMRTFCUVVZc1EwRkJVenR0UWtGRFRrMDdVMEZFU0N4RlFVVk1XQ3hWUVVaTExFTkJRVkk3YlVKQlIxY3NSVUZCV0R0aFFVTkxMRU5CUVV3N1pVRkRUMjlDTEU5QlFWQTdTMEY2UkVvN1VVRTBSRUUyUWl4aFFVRmhMRk5CUVdKQkxGVkJRV0VzUjBGQlRUdGxRVU5RTVVNc1RVRkJUVEpETEZGQlFVNHNTMEZCYlVKdVF5eGpRVUV6UWp0TFFUZEVTanRSUVdkRlFXOURMRmRCUVZjc1UwRkJXRUVzVVVGQlZ5eEhRVUZOTzJGQlExSnlReXhUUVVGVExFTkJRV1E3WlVGRFQwMHNUMEZCVUR0TFFXeEZTanM3VjBGeFJVODdiMEpCUTFOV0xGVkJSRlE3YlVKQlJWRnpReXhUUVVaU08yMUNRVWRSYmtNc1UwRklVanRyUWtGSlQzTkRMRkZCU2xBN2IwSkJTMU5HTEZWQlRGUTdaVUZOU1RsQ0xFdEJUa283YzBKQlQxZEtPMHRCVUd4Q08wTkJha1pLT3p0QlEwVkJMRk5CUVZOeFF5eFRRVUZVTEVkQlFYTkNPMUZCUTJSRExGbEJRVmtzUlVGQmFFSTdPMUZCUlUxRExGRkJRVkUxUlN4RlFVRkZSQ3hKUVVGR0xFVkJRV1E3VVVGRlRUaEZMR05CUVdNc1UwRkJaRUVzVjBGQll5eERRVUZEUXl4TlFVRkVMRVZCUVZORExFOUJRVlFzUlVGQmNVSTdaVUZEZUVKQkxGZEJRVmQ2UlN4RlFVRkZWU3hWUVVGR0xFTkJRV0VyUkN4UlFVRlJSQ3hOUVVGeVFpeERRVUZZTEVkQlFUQkRlRVVzUlVGQlJUQkZMRTlCUVVZc1EwRkJWVVFzVVVGQlVVUXNUVUZCYkVJc1JVRkJNRUpCTEUxQlFURkNMRU5CUVRGRExFZEJRVGhGUVN4TlFVRnlSanRMUVVoV08xRkJUVTFITEdGQlFXRXNVMEZCWWtFc1ZVRkJZU3hEUVVGRFF5eFBRVUZFTEVWQlFXRTdaVUZEWml4VlFVRkRjRU1zUjBGQlJDeEZRVUZUTzJOQlExWnhReXhKUVVGR0xFTkJRVTlFTEU5QlFWQXNSVUZCWjBJc1ZVRkJRMmhHTEV0QlFVUXNSVUZCVVd0R0xFZEJRVklzUlVGQlowSTdiMEpCUTNoQ1F5eG5Ra0ZCU2l4RFFVRnhRa1FzUjBGQmNrSXNSVUZCTUVKc1JpeExRVUV4UWp0aFFVUktPMjFDUVVkUE5FTXNSMEZCVUR0VFFVcEtPMHRCVUZZN1VVRmxUWGRETEcxQ1FVRnRRaXhUUVVGdVFrRXNaMEpCUVcxQ0xFTkJRVU5LTEU5QlFVUXNSVUZCVlVnc1QwRkJWaXhGUVVGelFqdGxRVU01UW5wRkxFVkJRVVZ4UWl4TlFVRkdMRU5CUVZNc1JVRkJWQ3hGUVVGaGIwUXNUMEZCWWl4RlFVRnpRanR2UWtGRGFrSkdMRmxCUVZsSkxGZEJRVmRETEU5QlFWZ3NRMEZCV2l4RlFVRnBRMGdzVDBGQmFrTTdVMEZFVEN4RFFVRlFPMHRCYUVKV08xRkJjVUpOVVN4bFFVRmxMRk5CUVdaQkxGbEJRV1VzUTBGQlEwTXNaVUZCUkN4RlFVRnJRbFFzVDBGQmJFSXNSVUZCYjBRN1dVRkJla0pWTEZsQlFYbENMSFZGUVVGV0xFdEJRVlU3TzFsQlEzcEVReXhUUVVGVE1VWXNSVUZCUlVRc1NVRkJSaXhEUVVGUE1FWXNXVUZCVUN4RFFVRm1PMWxCUTAwNVF5eEpRVUZKTTBNc1JVRkJSVFJETEZGQlFVWXNSVUZFVmp0bFFVVlBLME1zU1VGQlVDeEhRVUZqTEZsQlFVMDdiVUpCUTFRc1NVRkJVRHRqUVVORmVrSXNUVUZCUmpzMFFrRkRaMEkxUkN4RlFVRkZjVUlzVFVGQlJpeERRVUZUTEVWQlFWUXNSVUZCWVc5RUxFOUJRV0lzUlVGQmMwSTdORUpCUTNSQ08yRkJSRUVzUTBGQmFFSXNSVUZGU1dwQ0xFbEJSa29zUTBGRlV5eFZRVUZEUXl4SlFVRkVMRVZCUVZVN2RVSkJRMUlzUzBGQlVEdHJRa0ZEUlVVc1QwRkJSaXhEUVVGVlJpeEpRVUZXTzJ0Q1FVTkZSeXhOUVVGR08yRkJURW9zUlVGTlJ5eFZRVUZEUXl4TFFVRkVMRVZCUVZjN2RVSkJRMGdzUzBGQlVEdHJRa0ZEUlVNc1RVRkJSaXhEUVVGVFJDeExRVUZVTzJ0Q1FVTkZSQ3hOUVVGR08yRkJWRW83YlVKQlYwOTJRaXhGUVVGRk1FSXNUMEZCVkR0VFFXUktPMlZCWjBKUGNVSXNUVUZCVUR0TFFYaERWanRSUVRKRFRVVXNkVUpCUVhWQ08ydENRVU5VTzB0Qk5VTndRanM3WTBFclExVm9RaXhMUVVGV0xFZEJRV3RDUVN4TFFVRnNRanM3WTBGRlZXbENMRWxCUVZZc1IwRkJhVUlzVlVGQlEwTXNVMEZCUkN4RlFVRlpReXh4UWtGQldpeEZRVUZ6UXp0clFrRkRla05ETEU5QlFWWXNSMEZCYjBJc1ZVRkJRMnBDTEU5QlFVUXNSVUZCWVR0blFrRkRka0pyUWl4bFFVRmxMRk5CUVdaQkxGbEJRV1VzUTBGQlEyNUVMRWRCUVVRc1JVRkJVenR2UWtGRGRFSTdNa0pCUlU5QkxFbEJRVWxqTEZsQlFWZzdhVUpCUmtvc1EwRkhSU3hQUVVGUFF5eEZRVUZRTEVWQlFWYzdNa0pCUTBaaUxFdEJRVXRETEZOQlFVd3NRMEZCWlRzNFFrRkRXaXhKUVVSWk8ybERRVVZVTEVsQlJsTTdPRUpCUjFvc1EwRklXVHRwUTBGSlZFZ3NTVUZCU1dNN2NVSkJTbFlzUTBGQlVEczdZVUZNVWp0dFFrRmhUelZFTEVWQlFVVm5SeXhQUVVGR0xFTkJRVlV4Uml4RlFVRkZjVUlzVFVGQlJpeERRVUZUTEVWQlFVTjFSU3hUUVVGVFJDeFpRVUZXTEVWQlFWUXNSVUZCYTBOc1FpeFBRVUZzUXl4RlFVRXlRenR4UWtGRGJrUmxMRmxCUVZsbUxGRkJRVkZ2UWp0aFFVUmFMRU5CUVZZc1EwRkJVRHRUUVdSS096dHJRa0Z0UWxWd1JTeFpRVUZXTEVkQlFYbENMRmxCUVUwN1owSkJRM0pDWVN4WFFVRlhOVU1zUlVGQlJUUkRMRkZCUVVZc1JVRkJha0k3WjBKQlEwbG5ReXhQUVVGS0xFVkJRV0U3ZVVKQlEwRllMRTlCUVZRc1EwRkJhVUk3TWtKQlEwNVhPMmxDUVVSWU8yRkJSRW9zVFVGSlR6dHJRa0ZEUkc5Q0xFOUJRVVlzUTBGQlZURkdMRVZCUVVWeFFpeE5RVUZHTEVOQlFWTXNSVUZCVkN4RlFVRmhiMFVzY1VKQlFXSXNRMEZCVml4RlFVRXJRMnBETEVsQlFTOURMRU5CUVc5RUxGVkJRVU5ETEVsQlFVUXNSVUZCVlRzd1FrRkRjRVJCTEV0QlFVdGhMRXRCUVZnN05rSkJRMU5ZTEU5QlFWUXNRMEZCYVVJN0swSkJRMDVYTzNGQ1FVUllPMmxDUVVaS0xFVkJTMGNzVlVGQlEySXNTVUZCUkN4RlFVRlZPelpDUVVOQlN5eE5RVUZVTEVOQlFXZENUQ3hKUVVGb1FqdHBRa0ZPU2pzN2JVSkJVMGR1UWl4VFFVRlRlVUlzVDBGQmFFSTdVMEZvUWtvN08ydENRVzFDVlN0Q0xHZENRVUZXTEVkQlFUWkNMRlZCUVVOeVFpeFBRVUZFTEVWQlFXRTdiVUpCUXk5Q1NpeFZRVUZWTlVNc1dVRkJWaXhIUVVGNVFpdENMRWxCUVhwQ0xFTkJRMGdzV1VGQlRUdDFRa0ZEUzJFc1ZVRkJWWEZDTEU5QlFWWXNRMEZCYTBKV0xHbENRVUZwUWp0eFEwRkRja0lzV1VGQldWWTdhVUpCUkZJc1JVRkZkRUpITEU5QlJuTkNMRU5CUVd4Q0xFTkJRVkE3WVVGR1JDeEZRVXRCTEZsQlFVMDdkVUpCUTBWS0xGVkJRVlZ4UWl4UFFVRldMRU5CUVd0Q2FrSXNUMEZCYkVJc1EwRkJVRHRoUVU1RUxFTkJRVkE3VTBGRVNqczdhMEpCV1ZWWExFMUJRVllzUjBGQmJVSndSaXhGUVVGRkswWXNUMEZCUml4RFFVRlZaQ3haUVVGV0xFVkJRWGRDV2l4VlFVRlZjVUlzVDBGQmJFTXNRMEZCYmtJN08ydENRVVZWVFN4bFFVRldMRWRCUVRSQ2FFY3NSVUZCUlN0R0xFOUJRVVlzUTBGQlZXUXNXVUZCVml4RlFVRjNRbG9zVlVGQlZYbENMR2RDUVVGc1F5eERRVUUxUWpzN2EwSkJSVlYyUlN4TFFVRldMRWRCUVd0Q0xGVkJRVU13UlN4SlFVRkVMRVZCUVZVN1owSkJRMnhDUXl4dlFrRkJiMElzVTBGQmNFSkJMR2xDUVVGdlFpeERRVUZEY0VVc1NVRkJSQ3hGUVVGUGIwTXNVVUZCVUN4RlFVRnZRanR2UWtGRGRFTXNRMEZCUTBFc1VVRkJUQ3hGUVVGbE96czdPMjlDUVVsVWFVTXNWVUZCVlN4VFFVRldRU3hQUVVGVkxFZEJRVTA3ZDBKQlExbzVReXhQUVVGUExFTkJRVU4yUWl4UFFVRlBMRU5CUVZJc1NVRkJZVzlETEZGQlFURkNPM2RDUVVOTlppeExRVUZMUlN4UFFVRlBZU3hSUVVGUUxFZEJRV3RDTEVOQlJEZENPekpDUVVWUFlpeFBRVUZQTEVkQlFWQXNSMEZCWVVZc1JVRkJjRUk3YVVKQlNFbzdPM1ZDUVUxUE8ydERRVU5YTEU5QlJGZzdOa0pCUlUxblJEdHBRa0ZHWWp0aFFWaEtPMmRDUVdsQ1RXcERMRmRCUVZkNFJTeEZRVUZGUkN4SlFVRkdMRU5CUVU4c1JVRkJVQ3hEUVdwQ2FrSTdaMEpCYlVKTk1rY3NZMEZCWXp0eFFrRkRUQ3hOUVVGTlNEdGhRWEJDY2tJN1owSkJkVUpOU1N4aFFVRmhMRk5CUVdKQkxGVkJRV0VzUTBGQlF6VkRMRWxCUVVRc1JVRkJUek5DTEVsQlFWQXNSVUZCWVc5RExGRkJRV0lzUlVGQmRVSlBMRTlCUVhaQ0xFVkJRV2xFTzI5Q1FVRnFRa2NzVDBGQmFVSXNkVVZCUVZBc1JVRkJUenM3YjBKQlEzQkVjRVFzWlVGQlpYaENMRVZCUVVWeFFpeE5RVUZHTEVOQlFWTXNSVUZCVkN4RlFVRmhPemhDUVVOd1FqdHBRa0ZFVHl4RlFVVnNRblZFTEU5QlJtdENMRVZCUlZSelFpeHJRa0ZCYTBKd1JTeEpRVUZzUWl4RlFVRjNRbTlETEZGQlFYaENMRU5CUmxNc1EwRkJja0k3ZFVKQlIwOWpMR2xDUVVGcFFuaEVMRmxCUVdwQ0xFVkJRU3RDZUVJc1JVRkJSWEZDTEUxQlFVWXNRMEZCVXl4RlFVRlVMRVZCUVdGdlJDeFBRVUZpTEVWQlFYTkNNa0lzVjBGQmRFSXNSVUZCYlVNN05FSkJRemRFTEV0QlJEWkVPekJDUVVVdlJETkRPMmxDUVVZMFFpeERRVUV2UWl4RFFVRlFPMkZCTTBKV08yZENRV2xEVFRaRExHTkJRV01zVTBGQlpFRXNWMEZCWXl4RFFVRkRNVVVzVDBGQlJDeEZRVUZWTmtNc1QwRkJWaXhGUVVGelFqdDNRa0ZEZUVKdlFpeEhRVUZTTEVsQlFXVXNUVUZCVFc1SExFVkJRVVUyUnl4TFFVRkdMRU5CUVZGRExHZENRVUZTTEVOQlFYbENOVVVzVDBGQmVrSXNRMEZCY2tJN2RVSkJRMDgyUXl4UFFVRlFPMkZCYmtOV08yZENRWE5EVFVFc1ZVRkJWU3hwUWtGQlEwRXNVVUZCUkN4RlFVRmhPM1ZDUVVOYVNpeFZRVUZWY1VJc1QwRkJWaXhEUVVGclFqRkdMRVZCUVVWeFFpeE5RVUZHTEVOQlFWTXNSVUZCVkN4RlFVRmhiMFFzVVVGQllpeEZRVUZ6UWpKQ0xGZEJRWFJDTEVWQlFXMURPelJDUVVOb1JEdHBRa0ZFWVN4RFFVRnNRaXhEUVVGUU8yRkJka05XTzJkQ1FUUkRUVXNzWTBGQll5eFRRVUZrUVN4WFFVRmpMRU5CUVVOdVNDeFZRVUZFTEVWQlFXRnRSaXhQUVVGaUxFVkJRWFZETzI5Q1FVRnFRa2NzVDBGQmFVSXNkVVZCUVZBc1JVRkJUenM3YjBKQlF6TkRjRVFzWlVGQlpYaENMRVZCUVVWeFFpeE5RVUZHTEVOQlFWTXNSVUZCVkN4RlFVRmhhVVVzYjBKQlFXSXNSVUZCYlVOV0xFOUJRVzVETEVOQlFYSkNPM1ZDUVVOUFNTeHBRa0ZEU0hoRUxGbEJSRWNzUlVGRlNIaENMRVZCUVVWeFFpeE5RVUZHTEVOQlFWTXNSVUZCVkN4RlFVTlRiMFFzVDBGRVZDeEZRVVZUTWtJc1YwRkdWQ3hGUVVWelFqczBRa0ZEUkN4TlFVUkRPekJDUVVWSU9VYzdhVUpCU201Q0xFTkJSa2NzUTBGQlVEdGhRVGxEVmp0blFrRXdSRTF2U0N4blFrRkJaMElzVTBGQmFFSkJMR0ZCUVdkQ0xFTkJRVU01UlN4UFFVRkVMRVZCUVZVMlF5eFBRVUZXTEVWQlFXOURPMjlDUVVGcVFrY3NUMEZCYVVJc2RVVkJRVkFzUlVGQlR6czdiMEpCUXpGRGNFUXNaVUZCWlcxRUxGZEJRVmN6UlN4RlFVRkZjVUlzVFVGQlJpeERRVUZUTEVWQlFWUXNSVUZCWVhWRUxFOUJRV0lzUTBGQldDeERRVUZ5UWp0MVFrRkRUekJDTEZsQlFWa3hSU3hQUVVGYUxFVkJRWEZDYjBRc2FVSkJRV2xDZUVRc1dVRkJha0lzUlVGQkswSjRRaXhGUVVGRmNVSXNUVUZCUml4RFFVRlRMRVZCUVZRc1JVRkJZVzlFTEU5QlFXSXNSVUZCYzBJeVFpeFhRVUYwUWl4RlFVRnRRenMwUWtGRGJFWTdhVUpCUkN0RExFTkJRUzlDTEVOQlFYSkNMRU5CUVZBN1lVRTFSRlk3WjBKQmFVVk5UeXhsUVVGbExGTkJRV1pCTEZsQlFXVXNRMEZCUXk5RkxFOUJRVVFzUlVGQlZYUkRMRlZCUVZZc1JVRkJjMEp0Uml4UFFVRjBRaXhGUVVGblJEdHZRa0ZCYWtKSExFOUJRV2xDTEhWRlFVRlFMRVZCUVU4N08yOUNRVU55UkhCRUxHVkJRV1Y0UWl4RlFVRkZjVUlzVFVGQlJpeERRVUZUTEVWQlFWUXNSVUZCWVdsRkxHOUNRVUZpTEVWQlFXMURWaXhQUVVGdVF5eERRVUZ5UWp0MVFrRkRUekJDTEZsQlEwZ3hSU3hQUVVSSExFVkJSVWh2UkN4cFFrRkRTWGhFTEZsQlJFb3NSVUZGU1hoQ0xFVkJRVVZ4UWl4TlFVRkdMRU5CUVZNc1JVRkJWQ3hGUVVOVGIwUXNUMEZFVkN4RlFVVlRNa0lzVjBGR1ZDeEZRVVZ6UWpzMFFrRkRSQ3hQUVVSRE96QkNRVVZJT1VjN2FVSkJTbTVDTEVOQlJrb3NRMEZHUnl4RFFVRlFPMkZCYmtWV08yZENRV3RHVFhOSUxHbENRVUZwUWl4VFFVRnFRa0VzWTBGQmFVSXNRMEZCUTI1RUxFbEJRVVFzUlVGQlR6TkNMRWxCUVZBc1JVRkJZVEpETEU5QlFXSXNSVUZCZFVNN2IwSkJRV3BDUnl4UFFVRnBRaXgxUlVGQlVDeEZRVUZQT3p0MVFrRkROME41UWl4WFFVRlhOVU1zU1VGQldDeEZRVUZyUWpOQ0xGRkJRVkVzUTBGQk1VSXNSVUZCT0VKdlF5eFZRVUU1UWl4RlFVRXdRMDhzVDBGQk1VTXNSVUZCYlVSSExFOUJRVzVFTEVOQlFWQTdZVUZ1UmxZN1owSkJjMFpOYVVNc1owSkJRV2RDTEZOQlFXaENRU3hoUVVGblFpeERRVUZEY0VRc1NVRkJSQ3hGUVVGUFowSXNUMEZCVUN4RlFVRnBRenR2UWtGQmFrSkhMRTlCUVdsQ0xIVkZRVUZRTEVWQlFVODdPM1ZDUVVOMFEzbENMRmRCUVZjMVF5eEpRVUZZTEVWQlFXbENMRU5CUVdwQ0xFVkJRVzlDTEVOQlFYQkNMRVZCUVhWQ1owSXNUMEZCZGtJc1JVRkJaME5ITEU5QlFXaERMRU5CUVZBN1lVRjJSbFk3TzIxQ1FUQkdUenN3UWtGRFQxWXNVVUZFVUR0blEwRkZZVEJETEdOQlJtSTdLMEpCUjFsRExHRkJTRm83T0VKQlNWZEdMRmxCU2xnN05rSkJTMVZHTEZkQlRGWTdLMEpCVFZsRExHRkJUbG83ZVVKQlQwMHhSeXhGUVVGRk1FVXNUMEZCUml4RFFVRlZUQ3hWUVVGVmNVSXNUMEZCY0VJc1JVRkJOa0pyUWl4alFVRTNRaXhEUVZCT08zZENRVkZMTlVjc1JVRkJSVEJGTEU5QlFVWXNRMEZCVlV3c1ZVRkJWWEZDTEU5QlFYQkNMRVZCUVRaQ2JVSXNZVUZCTjBJc1EwRlNURHQxUWtGVFNUZEhMRVZCUVVVd1JTeFBRVUZHTEVOQlFWVk1MRlZCUVZWeFFpeFBRVUZ3UWl4RlFVRTJRbWxDTEZsQlFUZENMRU5CVkVvN2MwSkJWVWN6Unl4RlFVRkZNRVVzVDBGQlJpeERRVUZWVEN4VlFVRlZjVUlzVDBGQmNFSXNSVUZCTmtKbExGZEJRVGRDTEVOQlZrZzdLMEpCVjFsNlJ5eEZRVUZGTUVVc1QwRkJSaXhEUVVGVlRDeFZRVUZWY1VJc1QwRkJjRUlzUlVGQk5rSm5RaXhoUVVFM1FpeERRVmhhTzJ0RFFWbGxNVWNzUlVGQlJUQkZMRTlCUVVZc1EwRkJWVXdzVlVGQlZYbENMR2RDUVVGd1FpeEZRVUZ6UTJNc1kwRkJkRU1zUTBGYVpqdHBRMEZoWXpWSExFVkJRVVV3UlN4UFFVRkdMRU5CUVZWTUxGVkJRVlY1UWl4blFrRkJjRUlzUlVGQmMwTmxMR0ZCUVhSRExFTkJZbVE3WjBOQlkyRTNSeXhGUVVGRk1FVXNUMEZCUml4RFFVRlZUQ3hWUVVGVmVVSXNaMEpCUVhCQ0xFVkJRWE5EWVN4WlFVRjBReXhEUVdSaU95dENRV1ZaTTBjc1JVRkJSVEJGTEU5QlFVWXNRMEZCVlV3c1ZVRkJWWGxDTEdkQ1FVRndRaXhGUVVGelExY3NWMEZCZEVNc1EwRm1XanRwUTBGblFtTjZSeXhGUVVGRk1FVXNUMEZCUml4RFFVRlZUQ3hWUVVGVmVVSXNaMEpCUVhCQ0xFVkJRWE5EV1N4aFFVRjBReXhEUVdoQ1pEdDVRa0ZwUWsxcVF6dGhRV3BDWWp0VFFUTkdTanM3WlVGblNFOUtMRk5CUVZBN1MwRjJTMG83TzJOQk1FdFZhRVlzVTBGQlZpeEhRVUZ6UWtFc1UwRkJkRUk3WTBGRFZXbERMRmxCUVZZc1IwRkJlVUpCTEZsQlFYcENPenRYUVVWUEswTXNVMEZCVURzN096czdPenM3T3lKOSJ9
