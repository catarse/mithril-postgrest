var gulp = require('gulp');
var argv = require('yargs').argv;
var babel = require('gulp-babel');
var concat = require('gulp-concat');
var jscs = require('gulp-jscs');
var jshint = require('gulp-jshint');
var sourcemaps = require('gulp-sourcemaps');
var rename = require('gulp-rename');
var uglify = require('gulp-uglify');
var plumber = require('gulp-plumber');
var Server = require('karma').Server;
var flow = require('gulp-flowtype');
var multiEntry = require('rollup-plugin-multi-entry');
var babel = require('rollup-plugin-babel');
var rollup = require('rollup-stream');
var buffer = require('vinyl-buffer');
var source = require('vinyl-source-stream');
var clean = require('gulp-clean');

var sources = ['src/**/*.js','src/vms/*.js'];

gulp.task('typecheck', function() {
  return gulp.src(sources)
  .pipe(flow({
    all: false,
    weak: false,
    declarations: './declarations',
    killFlow: false,
    beep: true,
    abort: false
  }));
});

/**
 * Run test once and exit
 */

gulp.task('bundle-tests', function(done){
     rollup({
       input: ['spec/**/*.spec.js', 'src/**/*.js'],
       sourcemap: true,
       format: 'iife',
       name: 'postgrestSpecs',
       globals: {
           underscore: '_',
           mithril: 'm'
       },
       plugins: [babel(), multiEntry()],
       external: ['underscore', 'mithril']
     })
     .pipe(source('spec/**/*.spec.js', 'src/**/*.js'))
     .pipe(buffer())
     .pipe(sourcemaps.init({loadMaps: true}))
     .pipe(rename('bundle.spec.js'))
     .pipe(sourcemaps.write())
     .pipe(gulp.dest('./'))
     .on('end', done);
 });

gulp.task('run-tests', ['bundle-tests'], function(done){
  new Server({
    configFile: __dirname + '/karma.conf.js'
  }, done).start();
});

gulp.task('clean-tests', ['run-tests'], function(){
    gulp.src('bundle.spec.js', {read: false})
        .pipe(clean());
});

gulp.task('lint', function(){
  gulp.src(sources)
    .pipe(plumber())
    .pipe(jscs())
    .pipe(jshint());
});

gulp.task('dist-sources', function(done){
    rollup({
        input: 'src/postgrest.js',
        format: 'iife',
        name: 'Postgrest',
        sourcemap: true,
        plugins: [
          babel()
        ],
        globals: {
            underscore: '_',
            mithril: 'm'
        },
        external: ['mithril', 'underscore']
    })
    .pipe(source('src/**/*.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init({loadMaps: true}))
    .pipe(sourcemaps.write())
    .pipe(rename('mithril-postgrest.js'))
    .pipe(gulp.dest('dist'))
    .pipe(uglify())
    .pipe(rename('mithril-postgrest.min.js'))
    .pipe(gulp.dest('dist'))
    .on('end', done);
});

gulp.task('bundle-sources', function(done){
    rollup({
      input: 'src/postgrest.js',
      plugins: [
          babel()
      ],
      output: {
          file: 'mithril-postgrest.js',
      },
      format: 'umd',
      name: 'Postgrest',
      globals: {
          underscore: '_',
          mithril: 'm'
      }
    })
    .pipe(source('src/**/*.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init({loadMaps: true}))
    .pipe(sourcemaps.write())
    .pipe(rename('mithril-postgrest.umd.js'))
    .pipe(gulp.dest('./'))
    .on('end', done);
});

gulp.task('watch', function(){
  (argv.q) ? gulp.watch(sources, ['dist']) :
  (argv.notest) ? gulp.watch(sources, ['lint', 'dist']) :
  gulp.watch(sources, ['test', 'lint', 'dist']);
});

gulp.task('default', ['watch']);
gulp.task('test', ['bundle-tests', 'run-tests', 'clean-tests']);
gulp.task('build', ['lint', 'test', 'dist-sources', 'bundle-sources']);
