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

var ws = require('ws');
var server = new ws.Server({port: 3001});

server.on('connection', function(connection) {
  function send(message, data) {
    connection.send(JSON.stringify({m: message, d:data}));
  }

  send('CONNECT', Date.now());

  connection.on('message', function onMessage(data) {
    var o = JSON.parse(data);
    console.log(o);
    switch (o.m) {
      case 'CONNECT':
        send('START', Date.now());
        break;
      case 'INPUT':
        send('INPUT', o.d);
        break;
    }
  });
});
