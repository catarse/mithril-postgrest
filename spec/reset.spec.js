describe("m.postgrest.reset", function(){

  beforeEach(function(){
    localStorage.setItem("postgrest.token", 'any token');
    m.postgrest.reset();
  });

  it("should remove token from localStorage", function(){
    expect(localStorage.getItem("postgrest.token")).toEqual(null);
  });
});

