import Postgrest from '../src/postgrest';
import m from 'mithril';

export default describe("postgrest.requestWithToken callbacks order", function(){
  var apiPrefix = "http://api.foo.com/v1/",
      token = "authentication token",
      authentication_endpoint = "/authentication_endpoint",
      requestResult = 'request result',
      authenticateTime = 10,
      requestTime = 5;
  var postgrest = new Postgrest(m);

  beforeEach(function(){
    postgrest.init(apiPrefix, {method: "GET", url: authentication_endpoint});

    spyOn(postgrest, 'authenticate').and.callFake(function(){
      var deferred = new Promise((resolve, reject) => {
        setTimeout(function(){
          localStorage.setItem("postgrest.token", token);
          resolve({token: token});
        }, authenticateTime);
      });
      return deferred;
    });

    spyOn(postgrest, 'request').and.callFake(function(options){
      // Ensure that the token was set before we call the request
      expect(localStorage.getItem("postgrest.token")).toEqual(token);
      var deferred = new Promise((resolve, reject) => {
        setTimeout(function(){
          resolve(requestResult);
        }, requestTime);
      });
        
      return deferred;
    });
  });

  it("should call authenticate, then the request and handle the request result in the returning promise", function(done){
    postgrest.requestWithToken({method: "GET", url: "pages.json"}).then(function(data){
      expect(data).toEqual(requestResult);
      done();
    });
    expect(postgrest.authenticate).toHaveBeenCalled();
  });

});
