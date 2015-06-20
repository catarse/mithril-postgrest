describe("m.postgrest.token", function(){
  var test_token = 'any token';
  describe("setter", function(){
    it("should add token to localStorage", function(){
      m.postgrest.token(test_token);
      expect(localStorage.getItem("postgrest.token")).toEqual(test_token);
    });
  });

  describe("getter", function(){
    beforeEach(function(){
      localStorage.removeItem("postgrest.token")
    });

    it("should return null if no token is set", function(){
      expect(m.postgrest.token()).toEqual(null);
    });
    it("should return set token", function(){
      localStorage.setItem("postgrest.token", test_token);
      expect(m.postgrest.token()).toEqual(test_token);
    });
  });
});

