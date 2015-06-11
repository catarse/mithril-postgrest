describe("m.postgrest.requestWithToken", function(){
  var apiPrefix = "http://api.foo.com/v1/";
  var token = "authentication token";
  var authentication_endpoint = "/authentication_endpoint"
  var xhr = {
    setRequestHeader: function(){}
  };

  beforeEach(function(){
    m.postgrest.reset();
    localStorage.setItem("postgrest.token", token);
    m.postgrest.init(apiPrefix, {method: "GET", url: authentication_endpoint});
    var then = function(callback){
      callback({token: token});
    };
    spyOn(xhr, 'setRequestHeader');
    spyOn(m.postgrest, 'authenticate').and.callThrough();
    spyOn(m, 'request').and.callFake(function(options){
      if(_.isFunction(options.config)){
        options.config(xhr);
      }
      return {then: then};
    });
  });

  it("should call authenticate", function(){
    m.postgrest.requestWithToken({method: "GET", url: "pages.json"});
    expect(m.postgrest.authenticate).toHaveBeenCalled();
  });

  describe("when I try to configure a custom header", function(){
    beforeEach(function(){
      var xhrConfig = function(xhr) {
        xhr.setRequestHeader("Content-Type", "application/json");
      };
      
      m.postgrest.requestWithToken({method: "GET", url: "pages.json", config: xhrConfig});
    });

    it("should call m.request and our custom xhrConfig", function(){
      expect(m.request).toHaveBeenCalledWith({method: "GET", url: apiPrefix + "pages.json", config: jasmine.any(Function)});
      expect(xhr.setRequestHeader).toHaveBeenCalledWith("Content-Type", "application/json");
    });

    it("should call m.request using API prefix and authorization header", function(){
      expect(xhr.setRequestHeader).toHaveBeenCalledWith("Authorization", "Bearer " + token);
    });
  });

});

