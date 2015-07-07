describe("m.postgrest.paginationVM", function(){
  var vm = null;
  var apiPrefix = "http://api.foo.com/v1/";
  var model = null;

  beforeEach(function(){
    m.postgrest.init(apiPrefix);
    model = m.postgrest.model('foo', ['bar']);
    spyOn(model, "getPage").and.callFake(function(page, filters){
      return {
        then: function(callback){
          callback(['items']);
        }
      }
    });
    vm = m.postgrest.paginationVM(model.getPage);
  });


  describe("#collection", function() {
    it("should be initialized with a getter returning an empty array", function(){
      expect(vm.collection()).toBeEmptyArray();
    });

    it("should receive more itens from the fetched pages", function(){
      vm.nextPage();
      expect(vm.collection()).toEqual(['items']);
    });
  });

  describe("#isLoading", function() {
    it("should be a function", function(){
      expect(vm.isLoading).toBeFunction();
    });
  });

  describe("#filter", function() {
    it("should be a function", function(){
      expect(vm.filter).toBeFunction();
    });

    it("should call the getPage without incrementing the page number and only with default order if no parameters are passed", function(){
      vm.filter({id: 'eq.0'});
      vm.filter();
      expect(model.getPage).toHaveBeenCalledWith(1, {order: 'id.desc'}, {extract: jasmine.any(Function)});
    });

    it("should call the getPage without incrementing the page number and with filters passed as parameters", function(){
      vm.filter({id: 'eq.0'});
      expect(model.getPage).toHaveBeenCalledWith(1, {id: 'eq.0', order: 'id.desc'}, {extract: jasmine.any(Function)});
    });
  });

  describe("#nextPage", function() {
    it("should be a function", function(){
      expect(vm.nextPage).toBeFunction();
    });

    it("should call the getPage incrementing the page number and with default filters", function(){
      vm.nextPage();
      expect(model.getPage).toHaveBeenCalledWith(2, {order: 'id.desc'}, {extract: jasmine.any(Function)});
    });
  });
});


