var gulp = require('gulp');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var annotate = require('gulp-ng-annotate');
var sourcemaps = require('gulp-sourcemaps');


// Concatenation task
gulp.task('concat', function () {
    'use strict';
    gulp.src(['src/bankroll.js', 'libs/*.js'])
        .pipe(concat('bankroll.js'))
        .pipe(gulp.dest('dist'));
});


// Minify bankroll.js
gulp.task('compress', function () {
    'use strict';
    gulp.src(['dist/bankroll.js'])
        .pipe(annotate())
        .pipe(uglify())
        .pipe(sourcemaps.write())
        .pipe(gulp.dest('dist'));
});


gulp.task('watch', function () {
    'use strict';
    gulp.watch('./', ['concat', 'compress']);
});