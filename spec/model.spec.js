describe("m.postgrest.model", function(){
  var apiPrefix = "http://api.foo.com/v1/",
  token = "authentication token",
  authentication_endpoint = "/authentication_endpoint",
  xhr = {
    setRequestHeader: function(){}
  },
  model = null;

  beforeEach(function(){
    localStorage.setItem("postgrest.token", token);
    m.postgrest.init(apiPrefix, {method: "GET", url: authentication_endpoint});
    spyOn(xhr, "setRequestHeader");

    model = m.postgrest.model('foo');
  });

  it("should create getPage and getPageWithToken", function(){
    expect(model.getPage).toBeFunction();
    expect(model.getPageWithToken).toBeFunction();
  });

  describe("post and postWithToken", function(){
    beforeEach(function(){
      spyOn(m.postgrest, "requestWithToken");
      model = m.postgrest.model('foo');
      model.postWithToken({bar: 'qux'});
    });

    it("should call m.postgrest.requestWithToken with model name", function() {
      expect(m.postgrest.requestWithToken).toHaveBeenCalledWith({method: "POST", url: "/foo", data: {bar: 'qux'}, config: jasmine.any(Function)});
    });
  });

  describe("options", function(){
    beforeEach(function(){
      spyOn(m.postgrest, "request");
      model = m.postgrest.model('foo');
      model.options();
    });

    it("should call m.postgrest.requestWithToken with model name", function() {
      expect(m.postgrest.request).toHaveBeenCalledWith({method: "OPTIONS", url: "/foo"});
    });
  });

  describe("delete and deleteWithToken", function(){
    beforeEach(function(){
      spyOn(m.postgrest, "requestWithToken");
      model = m.postgrest.model('foo');
      model.deleteWithToken({id: 'eq.1'});
    });

    it("should call m.postgrest.requestWithToken with model name", function() {
      expect(m.postgrest.requestWithToken).toHaveBeenCalledWith({method: "DELETE", url: "/foo?id=eq.1", config: jasmine.any(Function)});
    });
  });

  describe("patch and patchWithToken", function(){
    beforeEach(function(){
      var fakeRequest = function(options){
        options.config(xhr);
        // Default behaviour is to return representation
        expect(xhr.setRequestHeader).toHaveBeenCalledWith('Prefer', 'return=representation');
      };
      spyOn(m.postgrest, "requestWithToken").and.callFake(fakeRequest);

      model = m.postgrest.model('foo');
      model.patchWithToken({id: 'eq.1'}, {bar: 'qux'});
    });

    it("should call m.postgrest.requestWithToken with model name", function() {
      expect(m.postgrest.requestWithToken).toHaveBeenCalledWith({method: "PATCH", url: "/foo?id=eq.1", data: {bar: 'qux'}, config: jasmine.any(Function)});
    });
  });

  describe("getPage and getPageWithToken", function(){
    beforeEach(function(){
      var fakeRequest = function(options){
        options.config(xhr);
        expect(xhr.setRequestHeader).toHaveBeenCalledWith('Range-unit', 'items');
        expect(xhr.setRequestHeader).toHaveBeenCalledWith('Range', '0-9');
        // Default behaviour is to not have the count
        expect(xhr.setRequestHeader).toHaveBeenCalledWith('Prefer', 'count=none');
      };
      spyOn(m.postgrest, "request").and.callFake(fakeRequest);
      spyOn(m.postgrest, "requestWithToken").and.callFake(fakeRequest);

      model = m.postgrest.model('foo');
    });

    describe("#getPageWithToken", function() {
      beforeEach(function(){
        model.getPageWithToken();
      });

      it("should call m.postgrest.requestWithToken with model name", function() {
        expect(m.postgrest.requestWithToken).toHaveBeenCalledWith({method: "GET", url: "/foo", data: undefined, config: jasmine.any(Function)});
      });
    });

    describe("#getPage", function() {
      beforeEach(function(){
        model.getPage({filter: 1}, 1, {extra_options: 2});
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

      model = m.postgrest.model('foo');
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


