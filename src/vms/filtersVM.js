(function(factory) {
    if (typeof exports === 'object') {
        // Node/CommonJS
        factory(require('mithril'), require('underscore'));
    } else {
        // Browser globals
        factory(window.m, window._);
    }
}((m, _) => {
    m.postgrest.filtersVM = (attributes) => {
        var newVM = {},
            filter = () => {
                var prop = m.prop(''),
                    filterProp = function(value) {
                        if (arguments.length > 0) {
                            prop(value);
                            return newVM;
                        }
                        return prop();
                    };
                // Just so we can have a default to_filter and avoid if _.isFunction calls
                filterProp.toFilter = () => {
                    return _.isString(filterProp()) ? filterProp().trim() : filterProp();
                };
                return filterProp;
            },

            getters = _.reduce(
                attributes, (memo, operator, attr) => {
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
                }
            ),

            parametersWithoutOrder = () => {
                return _.reduce(
                    getters, (memo, getter, attr) => {
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
                    }, {}
                );
            },

            parameters = () => {
                // The order parameters have a special syntax (just like an order by SQL clause)
                // https://github.com/begriffs/postgrest/wiki/Routing#filtering-and-ordering
                var order = () => {
                    return getters.order() && _.reduce(
                        getters.order(), (memo, direction, attr) => {
                            memo.push(attr + '.' + direction);
                            return memo;
                        }, []
                    ).join(',');
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
}));
