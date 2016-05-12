import postgrest from '../src/postgrest';

export default describe("postgrest.requestWithToken", function(){
  var apiPrefix = "http://api.foo.com/v1/", token = "authentication token",
    authentication_endpoint = "/authentication_endpoint", lastRequest;

  beforeEach(function(){
    postgrest.token(token);
    postgrest.init(apiPrefix, {method: "GET", url: authentication_endpoint});
    spyOn(postgrest, 'authenticate').and.callThrough();
    spyOn(m, 'request').and.callThrough();
  });

  it("should call authenticate", function(){
    postgrest.requestWithToken({method: "GET", url: "pages.json"});
    expect(postgrest.authenticate).toHaveBeenCalled();
  });

  describe("when token is undefined and authentication succeeds", function(){
    it("should call authenticate and store token", function(){
      jasmine.Ajax.stubRequest('/authentication_endpoint').andReturn({
        'responseText' : JSON.stringify({token: token}),
        status: 200
      });
      postgrest.token(undefined);
      postgrest.requestWithToken({method: "GET", url: "pages.json"});
      lastRequest = jasmine.Ajax.requests.mostRecent();
      expect(postgrest.authenticate).toHaveBeenCalled();
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
      postgrest.token(undefined);
      postgrest.requestWithToken({method: "GET", url: "pages.json"});
      lastRequest = jasmine.Ajax.requests.mostRecent();
      expect(postgrest.authenticate).toHaveBeenCalled();
      expect(lastRequest.url).toEqual(apiPrefix + 'pages.json');
      expect(lastRequest.requestHeaders.Authorization).toEqual(undefined);
    });
  });

  describe("when I try to configure a custom header", function(){
    beforeEach(function(){
      var xhrConfig = function(xhr) {
        xhr.setRequestHeader("Content-Type", "application/json");
      };

      postgrest.requestWithToken({method: "GET", url: "pages.json", config: xhrConfig});
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
