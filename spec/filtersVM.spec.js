import Postgrest from '../src/postgrest';
import m from 'mithril';

export default describe("postgrest.filtersVM", function(){
  var postgrest = new Postgrest();
  var vm = null;

  beforeEach(function(){
    vm = postgrest.filtersVM({id: 'eq', name: 'ilike', value: 'between', or_values: 'or', select_value: 'select', full_text: '@@', deactivated_at: 'is.null'});
  });

  it("should have a getter for each attribute plus one for order", function() {
    expect(vm.id).toBeFunction();
    expect(vm.name).toBeFunction();
    expect(vm.value.lte).toBeFunction();
    expect(vm.value.gte).toBeFunction();
    expect(vm.full_text).toBeFunction();
    expect(vm.deactivated_at).toBeFunction();
    expect(vm.order).toBeFunction();
    expect(vm.or_values).toBeFunction();
    expect(vm.select_value).toBeFunction();
  });

  it("should have a parameters function", function() {
    expect(vm.parameters).toBeFunction();
  });

  it("should be able to set filter to undefined", function() {
    vm.id(undefined).name('foo');
    expect(vm.parameters()).toEqual({name: 'ilike.*foo*'});
  });

  it("should be able to set filter to false", function() {
    vm.id(false).name('foo');
    expect(vm.parameters()).toEqual({id: 'eq.false', name: 'ilike.*foo*'});
  });

  it("should have or values", function() {
    vm.or_values({
      value1: {
        eq: 'test'
      },
      value2: {
        gte: 1
      }
    });
    expect(vm.parameters()).toEqual({or: '(value1.eq.test,value2.gte.1)'});
  });

  it("should have inner or values", function() {
    vm.or_values({
      value1: { eq: 'test', },
      or: {
        value3: { eq: 2, },
        value4: { eq: 5, },
      }
    });
    expect(vm.parameters()).toEqual({or: '(value1.eq.test,or(value3.eq.2,value4.eq.5))'});
  });

  it("should use select field", function() {
    vm.select_value('id,name');
    expect(vm.parameters()).toEqual({select: 'id,name'});
  });

  it("should use select fields without modifying it", function() {
    vm.select_value('id,name,actors(*)&actors.desc=name');
    expect(vm.parameters()).toEqual({select: 'id,name,actors(*)&actors.desc=name'});
  });

  it("should have or and inner or values", function() {
    vm.or_values({
      value1: { eq: 'test', },
      or: {
        or: {
          value2: { eq: 'test', },
        },
        value3: { eq: 5, },
      }
    });
    expect(vm.parameters()).toEqual({or: '(value1.eq.test,or(or(value2.eq.test),value3.eq.5))'});
  });

  it("should have or and inner and values", function() {
    vm.or_values({
      value1: { eq: 'test', },
      or: {
        and: {
          value2: { eq: 'test', },
        },
        value3: { eq: 5, },
      }
    });
    expect(vm.parameters()).toEqual({or: '(value1.eq.test,or(and(value2.eq.test),value3.eq.5))'});
  });

  it("the parameters function should build an object for the request using PostgREST syntax", function() {
    vm.id(7).name('foo').value.gte(1).value.lte(2).full_text(' foo  bar qux ').deactivated_at(!null).order({name: 'asc', id: 'desc'});
    expect(vm.parameters()).toEqual({id: 'eq.7', name: 'ilike.*foo*', order: 'name.asc,id.desc', value: ['gte.1', 'lte.2'], full_text: '@@.foo&bar&qux', deactivated_at: 'not.is.null'});
  });

  it("the chain function should build an object for the request using PostgREST syntax", function() {
    var chain = vm.id(7).name('foo').value.gte(1).value.lte(2).full_text(' foo  bar qux ').deactivated_at(!null).order({name: 'asc', id: 'desc'}).parameters();
    expect(chain).toEqual({id: 'eq.7', name: 'ilike.*foo*', order: 'name.asc,id.desc', value: ['gte.1', 'lte.2'], full_text: '@@.foo&bar&qux', deactivated_at: 'not.is.null'});
  });

  it("should use custom .toFilter to get value from filter getters", function() {
    vm.name('foo');
    vm.name.toFilter = function(){
      return this().replace(/oo/, 'u');
    };
    expect(vm.parameters()).toEqual({name: 'ilike.*fu*'});
  });

  it("the parameters function should skip undefined values", function() {
    vm.id(undefined);
    vm.name(undefined);
    vm.value.lte(undefined);
    vm.value.gte(undefined);
    vm.deactivated_at(undefined);
    vm.order(undefined);
    expect(vm.parameters()).toEqual({});
  });

  it("should skip when toFilter returns blank", function() {
    var returnBlank = function(){ return ''; };
    vm.id(7);
    vm.name('foo');
    vm.value.gte(1);
    vm.value.lte(2);
    vm.full_text(' foo  bar qux ');
    vm.deactivated_at(true);
    vm.id.toFilter = returnBlank;
    vm.name.toFilter = returnBlank;
    vm.value.lte.toFilter = returnBlank;
    vm.value.gte.toFilter = returnBlank;
    vm.full_text.toFilter = returnBlank;
    vm.deactivated_at.toFilter = returnBlank;
    expect(vm.parameters()).toEqual({});
  });
});
