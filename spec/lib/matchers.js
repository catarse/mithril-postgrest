beforeEach(function(){
  var customMatchers = {
    toMatchPropertiesOf: function(utils, customEqualityTesters){
      return {
        compare: function(actual, expected){
          for(var property in expected){
            if(!_.isFunction(actual[property])){
              return {
                pass: false,
                message: "Property " + property + " is not a getter."
              };
            }

            if(!utils.equals(actual[property](),expected[property],customEqualityTesters)){
              return {
                pass: false,
                message: "Property " + property + " does not match."
              };
            }
          }
          return {
            pass: true,
            message: "Property matches."
          };    
        }
      }
    } 
  };
  jasmine.addMatchers(customMatchers);
});
