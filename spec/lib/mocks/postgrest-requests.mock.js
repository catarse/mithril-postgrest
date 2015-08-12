var testToken = "test_token";

beforeAll(function() {
  jasmine.Ajax.install();
});

afterAll(function() {
  jasmine.Ajax.uninstall();
});
