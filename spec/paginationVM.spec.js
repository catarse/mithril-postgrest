describe("m.postgrest.paginationVM", function(){
  var vm = null;
  var apiPrefix = "http://api.foo.com/v1";
  var model = null;

  beforeEach(function(){
    m.postgrest.init(apiPrefix);
    model = m.postgrest.model('foo');
  });

  describe("when fetch fails", function(){
    beforeEach(function(){
      vm = m.postgrest.paginationVM(model.getPage);
      jasmine.Ajax.stubRequest(/foo.*/).andReturn({
        'status' : 401, 
        'responseText' : 'Invalid user'
      });
    });

    it("should be initialized with a getter returning an empty array", function(){
      expect(vm.collection()).toBeEmptyArray();
    });

    it("should receive error message and let array empty", function(){
      var error;
      vm.nextPage().then(null, function(e){
        error = e;
      });
      expect(error).toEqual({hint: null, details: null, code: 0, message: 'Invalid user'});
      expect(vm.collection()).toEqual([]);
    });
  });

  describe("when fetch is successful", function(){
    beforeEach(function(){
      spyOn(model, "getPage").and.callThrough();
      vm = m.postgrest.paginationVM(model.getPage);
      jasmine.Ajax.stubRequest(/foo.*/).andReturn({
        'responseText' : '["items"]'
      });
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

    describe("#firstPage", function() {
      it("should be a function", function(){
        expect(vm.firstPage).toBeFunction();
      });

      it("should call the getPage without incrementing the page number and only with default order if no parameters are passed", function(){
        vm.firstPage({id: 'eq.0'});
        vm.firstPage();
        expect(model.getPage).toHaveBeenCalledWith({order: 'id.desc'}, 1, {background: true, extract: jasmine.any(Function)});
      });

      it("should call the getPage without incrementing the page number and with filters passed as parameters", function(){
        vm.firstPage({id: 'eq.0'});
        expect(model.getPage).toHaveBeenCalledWith({id: 'eq.0', order: 'id.desc'}, 1, {background: true, extract: jasmine.any(Function)});
      });
    });

    describe("#nextPage", function() {
      it("should be a function", function(){
        expect(vm.nextPage).toBeFunction();
      });

      it("should call the getPage incrementing the page number and with default filters", function(){
        vm.nextPage();
        expect(model.getPage).toHaveBeenCalledWith({order: 'id.desc'}, 2, {background: true, extract: jasmine.any(Function)});
      });
    });
  });
});


