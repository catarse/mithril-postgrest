describe("m.postgrest.authenticate", function(){
  var token = "authentication token";
  var authentication_endpoint = "/authentication_endpoint";

  beforeEach(function(){
    m.postgrest.token(undefined);
    jasmine.Ajax.stubRequest(authentication_endpoint).andReturn({
      'responseText' : JSON.stringify({token: token})
    });
    m.postgrest.init("", {method: "GET", url: authentication_endpoint});
    spyOn(m, 'request').and.callThrough();
  });

  describe("when token is not in localStorage", function(){
    beforeEach(function(){
      m.postgrest.authenticate();
    });

    it("should store the token", function(){
      expect(m.postgrest.token()).toEqual(token);
    });
  });

  describe("when token is present", function(){
    beforeEach(function(){
      m.postgrest.token(token);
    });

    it("should return a promisse with the token in the data parameter", function(){
      var promisse = m.postgrest.authenticate();
      promisse.then(function(data){
        expect(data.token).toEqual(token);
      });
      expect(m.request).not.toHaveBeenCalled();
    });
  });
});
