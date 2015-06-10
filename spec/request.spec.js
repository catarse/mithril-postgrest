describe("m.postgrest.request", function(){
  var apiPrefix = "http://api.foo.com/v1/";
  var token = "authentication token";
  var authentication_endpoint = "/authentication_endpoint"
  var xhr = {
    setRequestHeader: function(){}
  };

  beforeEach(function(){
    m.postgrest.reset();
    m.postgrest.init(apiPrefix);
    var then = function(callback){
      callback({token: token});
    };
    spyOn(xhr, 'setRequestHeader');
    spyOn(m, 'request').and.callFake(function(options){
      options.config(xhr);
      return {then: then};
    });
  });

  describe("when I'm not authenticated and try to configure a custom header", function(){
    it("should call m.request and our custom xhrConfig", function(){
      var xhrConfig = function(xhr) {
        xhr.setRequestHeader("Content-Type", "application/json");
      };
      
      m.postgrest.request({method: "GET", url: "pages.json", config: xhrConfig});
      expect(m.request).toHaveBeenCalledWith({method: "GET", url: apiPrefix + "pages.json", config: jasmine.any(Function)});
      expect(xhr.setRequestHeader).toHaveBeenCalledWith("Content-Type", "application/json");
    });
  });

  describe("when I'm not authenticated", function(){
    it("should call m.request using API prefix", function(){
      m.postgrest.request({method: "GET", url: "pages.json"});
      expect(m.request).toHaveBeenCalledWith({method: "GET", url: apiPrefix + "pages.json", config: jasmine.any(Function)});
    });
  });

  describe("when I have already the authentication token", function(){
    beforeEach(function(){
      localStorage.setItem("postgrest.token", token);
      m.postgrest.request({method: "GET", url: "pages.json"});
    });

    it("should call m.request using API prefix and authorization header", function(){
      //TODO: test config object for authorization header
      expect(xhr.setRequestHeader).toHaveBeenCalledWith("Authorization", "Bearer " + token);
    });
  });
});
