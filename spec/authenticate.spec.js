import Postgrest from '../src/postgrest';
import m from 'mithril';

export default describe("postgrest.authenticate", function(){
  var token = "authentication token";
  var authentication_endpoint = "/authentication_endpoint";
  var postgrest = new Postgrest();
  
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
      postgrest.authenticate();
      postgrest.authenticate();
    });

    it('should debounce requests', function(){
      expect(m.request.calls.count()).toEqual(1);
    });
    it("should store the token", function(){
      expect(postgrest.token()).toEqual(token);
    });
  });

  describe("when token is present", function(){
    beforeEach(function(){
      postgrest.token(token);
    });

    it("should return a promise with the token in the data parameter", function(){
      var promise = postgrest.authenticate();
      promise.then(function(data){
        expect(data.token).toEqual(token);
      });
      expect(m.request).not.toHaveBeenCalled();
    });
  });
});
