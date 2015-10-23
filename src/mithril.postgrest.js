(function(factory) {
    if (typeof exports === 'object') {
        // Node/CommonJS
        factory(require('mithril'), require('underscore'));
    } else {
        // Browser globals
        factory(window.m, window._);
    }
}((m, _) => {
    let postgrest = {};

    const token = m.prop(),

          mergeConfig = (config, options) => {
              return options && _.isFunction(options.config) ? _.compose(options.config, config) : config;
          },

          addHeaders = (headers) => {
              return (xhr) => {
                  _.each(headers, (value, key) => {
                      xhr.setRequestHeader(key, value);
                  });
                  return xhr;
              };
          },

          addConfigHeaders = (headers, options) => {
              return _.extend({}, options, {
                  config: mergeConfig(addHeaders(headers), options)
              });
          },

          representationHeader = {
              'Prefer': 'return=representation'
          };

    postgrest.token = token;

    postgrest.loader = (options, requestFunction, defaultState = false) => {
        const loader = m.prop(defaultState),
              d = m.deferred();
        loader.load = () => {
            loader(true);
            m.redraw();
            requestFunction(_.extend({}, options, {
                background: true
            })).then((data) => {
                loader(false);
                d.resolve(data);
                m.redraw();
            }, (error) => {
                loader(false);
                d.reject(error);
                m.redraw();
            });
            return d.promise;
        };
        return loader;
    };

    postgrest.loaderWithToken = (options, defaultState) => {
        return postgrest.loader(options, postgrest.requestWithToken, defaultState);
    };

    postgrest.init = (apiPrefix, authenticationOptions) => {
        postgrest.request = (options) => {
            const errorHandler = (xhr) => {
                try {
                    JSON.parse(xhr.responseText);
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
            return m.request(_.extend({extract: errorHandler}, options, {
                url: apiPrefix + options.url
            }));
        };

        postgrest.authenticate = () => {
            const deferred = m.deferred();
            if (token()) {
                deferred.resolve({
                    token: token()
                });
            } else {
                m.request(_.extend({}, authenticationOptions)).then((data) => {
                    token(data.token);
                    deferred.resolve({
                        token: token()
                    });
                }, (data) => {
                    deferred.reject(data);
                });
            }
            return deferred.promise;
        };

        postgrest.requestWithToken = (options) => {
            return m.postgrest.authenticate().then(
                () => {
                    return m.postgrest.request(addConfigHeaders({
                        'Authorization': 'Bearer ' + token()
                    }, options));
                }, () => {
                    return m.postgrest.request(options);
                }
            );
        };

        postgrest.model = (name) => {
            const paginationHeaders = (page, pageSize) => {
                if (!pageSize) {
                    return;
                }

                const toRange = () => {
                    const from = (page - 1) * pageSize,
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

                  getOptions = (data, page, pageSize, options, headers = {}) => {
                      const extraHeaders = _.extend({}, {
                          'Prefer': 'count=none'
                      }, headers, paginationHeaders(page, pageSize));
                      return addConfigHeaders(extraHeaders, _.extend({}, options, nameOptions, {
                          method: 'GET',
                          data: data
                      }));
                  },

                  querystring = (filters, options) => {
                      options.url += '?' + m.route.buildQueryString(filters);
                      return options;
                  },

                  options = (options) => {
                      return m.postgrest.request(_.extend({}, options, nameOptions, {
                          method: 'OPTIONS'
                      }));
                  },

                  postOptions = (attributes, options, headers = {}) => {
                      const extraHeaders = _.extend({}, representationHeader, headers);
                      return addConfigHeaders(
                          extraHeaders,
                          _.extend({},
                                   options,
                                   nameOptions, {
                                       method: 'POST',
                                       data: attributes
                                   }
                                  )
                      );
                  },

                  deleteOptions = (filters, options, headers = {}) => {
                      const extraHeaders = addHeaders(_.extend({}, headers));
                      return querystring(filters, addConfigHeaders(extraHeaders, _.extend({}, options, nameOptions, {
                          method: 'DELETE'
                      })));
                  },

                  patchOptions = (filters, attributes, options, headers = {}) => {
                      const extraHeaders = _.extend({}, representationHeader, headers);
                      return querystring(
                          filters,
                          addConfigHeaders(
                              extraHeaders,
                              _.extend({},
                                       options,
                                       nameOptions, {
                                           method: 'PATCH',
                                           data: attributes
                                       }
                                      )
                          )
                      );
                  },

                  getPageOptions = (data, page, options, headers = {}) => {
                      return getOptions(data, (page || 1), pageSize(), options, headers);
                  },

                  getRowOptions = (data, options, headers = {}) => {
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
}));
