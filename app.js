var browserify = require('browserify-middleware');
var express = require('express');
var app = express();
var _ = require('underscore');

var Rx = require('Rx');
var Game = require('./Game');

browserify.settings('transform', ['es6ify']);

app.use(express.static('./static'));
app.use('/js', browserify('./client'));

app.listen(3000);

var log = Game.startServer({ port: 3001 });
log.subscribe(function(line) {
  console.log(line);
});
