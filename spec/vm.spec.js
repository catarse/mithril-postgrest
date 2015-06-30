describe("m.postgrest.vm", function(){
  var vm = null;

  beforeEach(function(){
    vm = m.postgrest.filtersVM({id: 'eq', name: 'ilike'});
  });

  it("should have a getter for each attribute plus one for order", function() {
    expect(vm.id).toBeFunction();
    expect(vm.name).toBeFunction();
    expect(vm.order).toBeFunction();
  });

  it("should have a parameters function", function() {
    expect(vm.parameters).toBeFunction();
  });

  it("the parameters function should build an object for the request using PostgREST syntax", function() {
    vm.id(7);
    vm.name('foo');
    vm.order({name: 'asc', id: 'desc'});
    expect(vm.parameters()).toEqual({id: 'eq.7', name: 'ilike.*foo*', order: 'name.asc,id.desc'})
  });
});

