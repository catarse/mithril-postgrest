describe("m.postgrest.loader", function(){
  var vm = null;

  beforeEach(function(){
    var then = function(callback){
      callback([]);
    };
    spyOn(m, 'request').and.callFake(function(options){
      expect(vm()).toEqual(true);
      return {then: then};
    });
    vm = m.postgrest.loader({}, m.request);
  });

  it("should create vm as a getter/setter", function() {
    expect(vm()).toEqual(false);
    vm(true);
    expect(vm()).toEqual(true);
  });


  it("should update loader state to true before resolving request", function() {
    vm(false);
    vm.load();
    expect(vm()).toEqual(false);
  });

});
