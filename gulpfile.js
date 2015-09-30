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
gulp.task('test', function (done) {
  new Server({
    configFile: __dirname + '/karma.conf.js'
  }, done).start();
});

gulp.task('lint', function(){
  gulp.src(sources)
    .pipe(plumber())
    .pipe(jscs())
    .pipe(jshint());
});

gulp.task('dist', function(){
  gulp.src(sources)
  .pipe(plumber())
  .pipe(sourcemaps.init())
  .pipe(babel())
  .pipe(concat('mithril.postgrest.js'))
  .pipe(sourcemaps.write())
  .pipe(gulp.dest('dist'))
  .pipe(uglify())
  .pipe(rename('mithril.postgrest.min.js'))
  .pipe(gulp.dest('dist'));
});

gulp.task('watch', function(){
  (argv.q) ? gulp.watch(sources, ['dist']) :
  (argv.notest) ? gulp.watch(sources, ['lint', 'dist']) :
  gulp.watch(sources, ['test', 'lint', 'dist']);
});

gulp.task('default', ['watch']);
gulp.task('build', ['lint', 'test', 'dist']);
