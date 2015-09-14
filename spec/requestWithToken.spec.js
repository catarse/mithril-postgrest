describe("m.postgrest.requestWithToken", function(){
  var apiPrefix = "http://api.foo.com/v1/", token = "authentication token", 
    authentication_endpoint = "/authentication_endpoint", lastRequest;

  beforeEach(function(){
    m.postgrest.token(token);
    m.postgrest.init(apiPrefix, {method: "GET", url: authentication_endpoint});
    spyOn(m.postgrest, 'authenticate').and.callThrough();
    spyOn(m, 'request').and.callThrough();
  });

  it("should call authenticate", function(){
    m.postgrest.requestWithToken({method: "GET", url: "pages.json"});
    expect(m.postgrest.authenticate).toHaveBeenCalled();
  });

  describe("when token is undefined and authentication succeeds", function(){
    it("should call authenticate and store token", function(){
      jasmine.Ajax.stubRequest('/authentication_endpoint').andReturn({
        'responseText' : JSON.stringify({token: token}),
        status: 200
      });
      m.postgrest.token(undefined);
      m.postgrest.requestWithToken({method: "GET", url: "pages.json"});
      lastRequest = jasmine.Ajax.requests.mostRecent();
      expect(m.postgrest.authenticate).toHaveBeenCalled();
      expect(lastRequest.url).toEqual(apiPrefix + 'pages.json');
      expect(lastRequest.requestHeaders.Authorization).toEqual('Bearer ' + token);
    });
  });

  describe("when authentication fails", function(){
    it("should call authenticate and fallback to request", function(){
      jasmine.Ajax.stubRequest('/authentication_endpoint').andReturn({
        'responseText' : JSON.stringify({}),
        status: 500
      });
      m.postgrest.token(undefined);
      m.postgrest.requestWithToken({method: "GET", url: "pages.json"});
      lastRequest = jasmine.Ajax.requests.mostRecent();
      expect(m.postgrest.authenticate).toHaveBeenCalled();
      expect(lastRequest.url).toEqual(apiPrefix + 'pages.json');
      expect(lastRequest.requestHeaders.Authorization).toEqual(undefined);
    });
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

