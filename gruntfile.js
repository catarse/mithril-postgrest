'use strict';

module.exports = function( grunt ) {
  grunt.initConfig({
    // TODO: change to read component.json
    pkg: require('./package.json'),

    uglify: {
      options: {
        banner: '/*\n    <%= pkg.description %>\n    Copyright (c) 2007 - <%= grunt.template.today("yyyy") %> <%= pkg.author %>\n    Licensed under the MIT license \n    Version: <%= pkg.version %>\n*/\n'
      },

      dev: {
        options: {
          beautify: true,
          mangle: false
        },

        files: {
          'dist/mithril.postgrest.js': ['src/mithril.postgrest.js']
        }
      },

      min: {
        files: {
          'dist/mithril.postgrest.min.js': ['src/mithril.postgrest.js']
        }
      }
    },

    jasmine: {
      full: {
        src: 'src/**/*.js',
        options: {
          specs: 'spec/*[S|s]pec.js',
          vendor: [
            'node_modules/jasmine-expect/dist/jasmine-matchers.js',
            'spec/lib/matchers.js',
            'spec/lib/jasmine-ajax/mock-ajax.js',
            'spec/lib/jasmine-species/jasmine-grammar.js',
            'spec/lib/mocks/*mock.js',
            'bower_components/**/*.js'
          ]
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jasmine');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  grunt.registerTask('test', ['jasmine']);
  grunt.registerTask('default', ['test', 'uglify']);
};
