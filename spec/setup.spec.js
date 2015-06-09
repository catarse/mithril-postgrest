describe("m.postgrest", function(){
  var apiPrefix = "http://api.foo.com/v1/";
  var token = "authentication token";
  var authentication_endpoint = "/authentication_endpoint"

  beforeEach(function(){
    m.postgrest.init(apiPrefix);

    var then = function(callback){
      callback({token: token});
    };
    m.postgrest.init(apiPrefix);
    spyOn(m, 'request').and.returnValue({then: then});
  });



  describe("m.postgrest.init", function(){
    it("should create authenticate function", function(){
      expect(_.isFunction(m.postgrest.authenticate)).toEqual(true);
    });
  });

  describe("m.postgrest.authenticate", function(){
    describe("when token is not in localStorage", function(){
      beforeEach(function(){
        localStorage.removeItem("postgrest.token");
        m.postgrest.authenticate({method: "GET", url: authentication_endpoint});
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
        var promisse = m.postgrest.authenticate({method: "GET", url: authentication_endpoint});
        promisse.then(function(data){
          expect(data.token).toEqual(token);
        });
        expect(m.request).not.toHaveBeenCalled();
      });
    });
  });

  describe("m.postgrest.request", function(){
    describe("when I'm not authenticated", function(){
      it("should call m.request using API prefix", function(){
        m.postgrest.request({method: "GET", url: "pages.json"});
        expect(m.request).toHaveBeenCalledWith({method: "GET", url: apiPrefix + "pages.json"});
      });
    });

    describe("when I have already called m.postgrest.authenticate()", function(){
      var xhr = {
        setRequestHeader: function(){}
      };

      beforeEach(function(){
        localStorage.setItem("postgrest.token", token);
        m.postgrest.authenticate({method: "GET", url: authentication_endpoint});
        spyOn(xhr, "setRequestHeader");
        m.postgrest.request({method: "GET", url: "pages.json"});
      });

      it("should call m.request using API prefix and authorization header", function(){
        //TODO: test config object for authorization header
        expect(m.request).toHaveBeenCalledWith({method: "GET", url: apiPrefix + "pages.json", config: jasmine.any(Function)});
      });
    });
  });
});
