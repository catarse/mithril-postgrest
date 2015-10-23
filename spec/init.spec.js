describe("m.postgrest.init & m.postgrest.request", function(){
    var apiPrefix = "http://api.foo.com/v1/";

    beforeEach(function(){
        m.postgrest.init(apiPrefix);
        spyOn(m, 'request');
    });

    it("should append api prefix used on init to request url", function(){
        m.postgrest.request({method: "GET", url: "pages.json"});
        expect(m.request).toHaveBeenCalledWith({method: "GET", url: apiPrefix + "pages.json", extract: jasmine.any(Function)});
    });
});
