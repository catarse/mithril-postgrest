describe("m.postgrest.request", function(){
  var apiPrefix = "http://api.foo.com/v1/";
  var token = "authentication token";
  var authentication_endpoint = "/authentication_endpoint"

  beforeEach(function(){
    m.postgrest.init(apiPrefix);
    var then = function(callback){
      callback({token: token});
    };
    spyOn(m, 'request').and.returnValue({then: then});
  });

  describe("when I'm not authenticated", function(){
    it("should call m.request using API prefix", function(){
      m.postgrest.request({method: "GET", url: "pages.json"});
      expect(m.request).toHaveBeenCalledWith({method: "GET", url: apiPrefix + "pages.json", config: jasmine.any(Function)});
    });
  });

  describe("when I have already called m.postgrest.authenticate()", function(){
    var xhr = {
      setRequestHeader: function(){}
    };

    beforeEach(function(){
      localStorage.setItem("postgrest.token", token);
      m.postgrest.authenticate({method: "GET", url: authentication_endpoint});
      spyOn(xhr, "setRequestHeader");
      m.postgrest.request({method: "GET", url: "pages.json"});
    });

    it("should call m.request using API prefix and authorization header", function(){
      //TODO: test config object for authorization header
    });
  });
});
