describe("m.postgrest.requestWithToken", function(){
  var apiPrefix = "http://api.foo.com/v1/", token = "authentication token", 
    authentication_endpoint = "/authentication_endpoint", lastRequest;

  beforeEach(function(){
    m.postgrest.reset();
    localStorage.setItem("postgrest.token", token);
    m.postgrest.init(apiPrefix, {method: "GET", url: authentication_endpoint});
    var then = function(callback){
      callback({token: token});
    };
    spyOn(m.postgrest, 'authenticate').and.callThrough();
    spyOn(m, 'request').and.callThrough();
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
      lastRequest = jasmine.Ajax.requests.mostRecent();
    });

    it("should call m.request and our custom xhrConfig", function(){
      expect(lastRequest.requestHeaders['Content-Type']).toEqual('application/json');
    });

    it("should call m.request using API prefix and authorization header", function(){
      expect(lastRequest.requestHeaders.Authorization).toEqual('Bearer ' + token);
    });
  });

});

