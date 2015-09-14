var testToken = "test_token";
var apiPrefix = "http://api.foo.com/v1/";

beforeAll(function() {
  jasmine.Ajax.install();

  jasmine.Ajax.stubRequest(new RegExp("("+ apiPrefix + '\/pages.json)'+'(.*)')).andReturn({
    'responseText' : JSON.stringify({})
  });

});

afterAll(function() {
  jasmine.Ajax.uninstall();
});
