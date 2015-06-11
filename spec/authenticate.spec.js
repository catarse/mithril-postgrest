describe("m.postgrest.authenticate", function(){
  var token = "authentication token";
  var authentication_endpoint = "/authentication_endpoint"

  beforeEach(function(){
    m.postgrest.reset();
    m.postgrest.init("", {method: "GET", url: authentication_endpoint});
    var then = function(callback){
      callback({token: token});
    };
    spyOn(m, 'request').and.returnValue({then: then});
  });

  describe("when token is not in localStorage", function(){
    beforeEach(function(){
      m.postgrest.authenticate();
    });

    it("should store the token in localStorage", function(){
      expect(localStorage.getItem("postgrest.token")).toEqual(token);
    });

    it("should return a m.request call with the options passed", function(){
      expect(m.request).toHaveBeenCalledWith({method: "GET", url: authentication_endpoint});
    });
  });

  describe("when token is in localStorage", function(){
    beforeEach(function(){
      localStorage.setItem("postgrest.token", token);
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
