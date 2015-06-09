describe("m.postgrest", function(){
  var apiPrefix = "http://api.foo.com/v1/";
  describe("m.postgrest.init", function(){
    beforeEach(function(){
      m.postgrest.init(apiPrefix);
    });

    it("should create authenticate function", function(){
      expect(_.isFunction(m.postgrest.authenticate)).toEqual(true);
    });
  });

  describe("m.postgrest.request", function(){
    beforeEach(function(){
      m.postgrest.init(apiPrefix);
      spyOn(m, 'request');
      m.postgrest.request({method: "GET", url: "pages.json"});
    });

    it("should call m.request using API prefix", function(){
      expect(m.request).toHaveBeenCalledWith({method: "GET", url: apiPrefix + "pages.json"});
    });
  });
});
