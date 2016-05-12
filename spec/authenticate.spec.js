import postgrest from '../src/postgrest';

export default describe("postgrest.authenticate", function(){
  var token = "authentication token";
  var authentication_endpoint = "/authentication_endpoint";

  beforeEach(function(){
    postgrest.token(undefined);
    jasmine.Ajax.stubRequest(authentication_endpoint).andReturn({
      'responseText' : JSON.stringify({token: token})
    });
    postgrest.init("", {method: "GET", url: authentication_endpoint});
    spyOn(m, 'request').and.callThrough();
  });

  describe("when token is not in localStorage", function(){
    beforeEach(function(){
      postgrest.authenticate();
    });

    it("should store the token", function(){
      expect(postgrest.token()).toEqual(token);
    });
  });

  describe("when token is present", function(){
    beforeEach(function(){
      postgrest.token(token);
    });

    it("should return a promisse with the token in the data parameter", function(){
      var promisse = postgrest.authenticate();
      promisse.then(function(data){
        expect(data.token).toEqual(token);
      });
      expect(m.request).not.toHaveBeenCalled();
    });
  });
});
