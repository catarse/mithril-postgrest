(function(factory) {
  if (typeof exports === 'object') {
    // Node/CommonJS
    factory(require('mithril'), require('underscore'));
  } else {
    // Browser globals
    factory(window.m, window._);
  }
}(function(m, _) {
  m.postgrest.paginationVM = (model, order, authenticate = true) => {
    let collection = m.prop([]),
      rangeHeaderRgx = new RegExp("(\d+)-(\d+)?\/?(\d+)"),
      defaultOrder = order || 'id.desc',
      filters = m.prop({order: defaultOrder}),
      isLoading = m.prop(false),
      page = m.prop(1),
      resultsCount = m.prop(10),
      pageRequest = authenticate ? model.getPageWithToken : model.getPage,
      total = m.prop();

    const fetch = () => {
      let d = m.deferred();
      const getTotal = (xhr) => {
        if (!xhr || xhr.status === 0){
          return JSON.stringify({hint: null, details: null, code: 0, message: 'Connection error'});
        }
        let rangeHeader = xhr.getResponseHeader('Content-Range');
        if (_.isString(rangeHeader)){
          let matches = rangeHeaderRgx.exec(rangeHeader);

          total(parseInt(matches[2]));
          resultsCount((parseInt(matches[0]) -  parseInt(matches[1])));
        }
        try {
          JSON.parse(xhr.responseText);
          return xhr.responseText;
        }
        catch (ex){
          return JSON.stringify({hint: null, details: null, code: 0, message: xhr.responseText});
        }
      };
      isLoading(true);
      pageRequest(filters(), page(), {background: true, extract: getTotal}, {'Prefer': 'count=exact'}).then((data) => {
        collection(_.union(collection(), data));
        isLoading(false);
        d.resolve(collection());
        m.redraw();
      },
      (error) => {
        isLoading(false);
        total(0);
        d.reject(error);
        m.redraw();
      });
      return d.promise;
    },

    firstPage = (parameters) => {
      filters(_.extend({order: defaultOrder}, parameters));
      collection([]);
      page(1);
      return fetch();
    },

    isLastPage = () => {
      return (page() * model.pageSize() >= total());
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
      total: total
    };
  };

}));
