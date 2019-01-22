import m from 'mithril';
import prop from 'mithril/stream';
import _ from 'underscore';

const paginationVM = (model, order, extraHeaders = {}, authenticate = true) => {
    let collection = prop([]),
        defaultOrder = order || 'id.desc',
        filters = prop({
            order: defaultOrder
        }),
        isLoading = prop(false),
        page = prop(1),
        resultsCount = prop(),
        pageRequest = authenticate ? model.getPageWithToken : model.getPage,
        total = prop();

    const fetch = () => {
        return new Promise((resolve, reject) => {

            const getTotal = (xhr) => {
                if (!xhr || xhr.status === 0) {
                    return JSON.stringify({
                        hint: null,
                        details: null,
                        code: 0,
                        message: 'Connection error'
                    });
                }
                let rangeHeader = xhr.getResponseHeader('Content-Range');
                if (_.isString(rangeHeader)) {
                    let [headerSize, headerCount] = rangeHeader.split('/'),
                        [headerFrom, headerTo] = headerSize.split('-'),
                        to = parseInt(headerTo) + 1 || 0,
                        from = parseInt(headerFrom) || 0;

                    total(parseInt(headerCount));
                    resultsCount(to - from);
                }

                try {
                    return JSON.parse(xhr.responseText);
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
                background: false,
                extract: getTotal
            }, extraHeaders)
            .then((data) => {
                collection(_.union(collection(), data));
                isLoading(false);
                resolve(collection());
                m.redraw();
            })
            .catch((error) => {
                isLoading(false);
                total(0);
                reject(error);
                m.redraw();
            });
        });
    },

        firstPage = (parameters) => {
            filters(_.extend({
                order: defaultOrder
            }, parameters));
            collection([]);
            page(1);
            return fetch();
        },

        isLastPage = () => {
            return (model.pageSize() > resultsCount());
        },

        nextPage = () => {
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

export default paginationVM;
