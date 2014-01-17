var browserify = require('browserify-middleware');
var express = require('express');
var app = express();

browserify.settings('transform', ['es6ify']);

app.use(express.static('./static'));
app.use('/js', browserify('./client'));

/*
//provide browserified versions of all the files in a directory

//provide a browserified file at a path
app.get('/js/file.js', browserify('./client/file.js'));

//provide a bundle exposing `require` for a few npm packages.
app.get('/js/bundle.js', browserify(['hyperquest', 'concat-stream']));
*/

app.listen(3000);
