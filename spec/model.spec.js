describe("m.postgrest.model", function(){
  var apiPrefix = "http://api.foo.com/v1/";
  var token = "authentication token";
  var authentication_endpoint = "/authentication_endpoint"
  var xhr = {
    setRequestHeader: function(){}
  };
  var model = null;

  beforeEach(function(){
    m.postgrest.reset();
    localStorage.setItem("postgrest.token", token);
    m.postgrest.init(apiPrefix, {method: "GET", url: authentication_endpoint});
    spyOn(xhr, "setRequestHeader");

    model = m.postgrest.model('foo', ['bar']);
  });

  it("should create getPage and getPageWithToken", function(){
    expect(model.getPage).toBeFunction();
    expect(model.getPageWithToken).toBeFunction();
  });

  it("should create constructor that copies attributes defined in model function", function() {
    var m = new model({bar: 'test', qux: 'another'});
    expect(m).toMatchPropertiesOf({bar: 'test'});
    expect(m).not.toMatchPropertiesOf({bar: 'test', qux: 'another'});
  });

  describe("getPage and getPageWithToken", function(){
    beforeEach(function(){
      var fakeRequest = function(options){
        options.config(xhr);
        expect(xhr.setRequestHeader).toHaveBeenCalledWith('Range-unit', 'items');
        expect(xhr.setRequestHeader).toHaveBeenCalledWith('Range', '0-9');
      };
      spyOn(m.postgrest, "request").and.callFake(fakeRequest);
      spyOn(m.postgrest, "requestWithToken").and.callFake(fakeRequest);

      model = m.postgrest.model('foo', ['bar']);
    });

    describe("#getPageWithToken", function() {
      beforeEach(function(){
        model.getPageWithToken(1);
      });

      it("should call m.postgrest.requestWithToken with model name", function() {
        expect(m.postgrest.requestWithToken).toHaveBeenCalledWith({method: "GET", url: "/foo", data: undefined, config: jasmine.any(Function)});
      });
    });

    describe("#getPage", function() {
      beforeEach(function(){
        model.getPage(1, {filter: 1}, {extra_options: 2});
      });

      it("should call m.postgrest.request with model name", function() {
        expect(m.postgrest.request).toHaveBeenCalledWith({method: "GET", url: "/foo", data: {filter: 1}, config: jasmine.any(Function), extra_options: 2});
      });
    });
  });

  describe("getRow and getRowWithToken", function(){
    beforeEach(function(){
      var fakeRequest = function(options){
        options.config(xhr);
        expect(xhr.setRequestHeader).toHaveBeenCalledWith('Range-unit', 'items');
        expect(xhr.setRequestHeader).toHaveBeenCalledWith('Range', '0-0');
      };
      spyOn(m.postgrest, "request").and.callFake(fakeRequest);
      spyOn(m.postgrest, "requestWithToken").and.callFake(fakeRequest);

      model = m.postgrest.model('foo', ['bar']);
    });

    describe("#getRowWithToken", function() {
      beforeEach(function(){
        model.getRowWithToken();
      });

      it("should call m.postgrest.requestWithToken with model name", function() {
        expect(m.postgrest.requestWithToken).toHaveBeenCalledWith({method: "GET", url: "/foo", data: undefined, config: jasmine.any(Function)});
      });
    });

    describe("#getRow", function() {
      beforeEach(function(){
        model.getRow({filter: 1}, {extra_options: 2});
      });

      it("should call m.postgrest.request with model name", function() {
        expect(m.postgrest.request).toHaveBeenCalledWith({method: "GET", url: "/foo", data: {filter: 1}, config: jasmine.any(Function), extra_options: 2});
      });
    });
  });


});


