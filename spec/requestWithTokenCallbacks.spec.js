describe("m.postgrest.requestWithToken callbacks order", function(){
  var apiPrefix = "http://api.foo.com/v1/", 
      token = "authentication token",
      authentication_endpoint = "/authentication_endpoint",
      requestResult = 'request result',
      authenticateTime = 10,
      requestTime = 5;

  beforeEach(function(){
    m.postgrest.init(apiPrefix, {method: "GET", url: authentication_endpoint});

    spyOn(m.postgrest, 'authenticate').and.callFake(function(){
      var deferred = m.deferred();
      setTimeout(function(){
        localStorage.setItem("postgrest.token", token);
        deferred.resolve({token: token});
      }, authenticateTime);
      return deferred.promise;
    }); 

    spyOn(m.postgrest, 'request').and.callFake(function(options){
      // Ensure that the token was set before we call the request
      expect(localStorage.getItem("postgrest.token")).toEqual(token);
      var deferred = m.deferred();
      setTimeout(function(){
        deferred.resolve(requestResult);
      }, requestTime);
      return deferred.promise;
    });
  });

  it("should call authenticate, then the request and handle the request result in the returning promise", function(done){
    m.postgrest.requestWithToken({method: "GET", url: "pages.json"}).then(function(data){
      expect(data).toEqual(requestResult);
      done();
    });
    expect(m.postgrest.authenticate).toHaveBeenCalled();
  });

});
