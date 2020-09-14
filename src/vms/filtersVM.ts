import prop from 'mithril/stream';
import _ from 'underscore';

export type Filter = {
    (value?: any): string | Filter
    gte?: Filter
    lte?: Filter
    toFilter: ToFilter
    logicOperators(): string
}

type ToFilter = () => string | Filter

export default function filtersVM(attributes) {
    const newVM = {} as Filter
    const filter = () : Filter => {
        const innerProp = prop('')
        const filterProp = function (value? : any ) : string | Filter  {
            if (arguments.length > 0) {
                innerProp(value)
                return newVM
            }
            return innerProp()
        }
        // Just so we can have a default to_filter and avoid if _.isFunction calls
        filterProp.toFilter = () : string | Filter => {
            return typeof filterProp() === 'string' ? (filterProp() as string).trim() : filterProp()
        }

        filterProp.logicOperators = () => {
            return objectToLogicOperation(filterProp.toFilter())
        }

        function objectToLogicOperation(obj : Object) : string {
            return `(${Object.keys(obj).map(key => {
                if (key === 'or' || key === 'and') {
                    return `${key}${objectToLogicOperation(obj[key])}`
                } else {
                    return `${Object.keys(obj[key]).map(innerKey => {
                        if (innerKey === 'or' || innerKey === 'and') {
                            return `${innerKey}${objectToLogicOperation(obj[key][innerKey])}`
                        } else {
                            return `${key}.${innerKey}.${obj[key][innerKey]}`
                        }
                    }).join(',')}`
                }
            }).join(',')})`
        }

        return filterProp
    }

    const getters = _.reduce(attributes, (memo, operator, attr) => {
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
    }, { order: filter() })

    const parametersWithoutOrder = () => {
        return _.reduce(getters, (memo, getter : Filter, attr) => {
            if (attr !== 'order') {
                const operator = attributes[attr]

                if (typeof getter.toFilter === 'function' && (getter.toFilter() === undefined || getter.toFilter() === '')) {
                    return memo
                }

                // Bellow we use different formatting rules for the value depending on the operator
                // These rules are used regardless of the toFilter function,
                // so the user can use a custom toFilter without having to worry with basic filter syntax
                if (operator === 'ilike' || operator === 'like') {
                    memo[attr] = operator + '.*' + getter.toFilter() + '*'
                } else if (operator === '@@') {
                    memo[attr] = operator + '.' + (getter.toFilter() as string).replace(/\s+/g, '&')
                } else if (operator === 'between') {
                    if (!getter.lte.toFilter() && !getter.gte.toFilter()) {
                        return memo
                    }
                    memo[attr] = []
                    if (getter.gte()) {
                        memo[attr].push('gte.' + getter.gte.toFilter())
                    }
                    if (getter.lte()) {
                        memo[attr].push('lte.' + getter.lte.toFilter())
                    }
                } else if (operator === 'is.null') {
                    memo[attr] = getter.toFilter() === null ? 'is.null' : 'not.is.null'
                } else if (operator === 'or' || operator === 'and') {
                    memo[operator] = getter.logicOperators();
                } else if (operator === 'select') {
                    memo[operator] = getter.toFilter();
                } else {
                    memo[attr] = operator + '.' + getter.toFilter()
                }
            }
            return memo
        }, {})
    }

    const parameters = () => {
        // The order parameters have a special syntax (just like an order by SQL clause)
        // https://github.com/begriffs/postgrest/wiki/Routing#filtering-and-ordering
        const order = () => {
            return getters.order() && _.reduce(getters.order(), (memo, direction, attr) => {
                    memo.push(attr + '.' + direction)
                    return memo
                }, []
            ).join(',')
        }
        const orderParameter = order() ? { order: order() } : {}
        return Object.assign(orderParameter, parametersWithoutOrder())
    }

    return Object.assign(newVM, getters, { parameters, parametersWithoutOrder })
}