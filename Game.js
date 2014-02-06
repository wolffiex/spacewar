var Rx = require('Rx');

var RxWebSocketServer = require('RxWebSocketServer');
var utils = require('utils');
var ws = require('ws');
var _ = require('underscore');


exports.startServer = function (options) {
  var server = RxWebSocketServer(options);

  // loopback behavior
  if (true) {
    server = server.flatMap(function(connection) {
      return Rx.Observable.fromArray([connection, loopback(connection)]);
    });
  }

  var gameNum = 0;
  return server.bufferWithCount(2).map(function(game) {
    var a = game[0];
    var b = game[1];

    var now = Date.now();
    Rx.Observable.return(utils.Msg('START', {player:'a', t: now}))
      .merge(b).subscribe(a);

    Rx.Observable.return(utils.Msg('START', {player:'b', t: now}))
      .merge(a).subscribe(b);

    // Return an Observable which is the log of the game
    return Rx.Observable.return("Game " + gameNum++);
  }).mergeAll();
}

function loopback(connection) {
  var looped = Rx.Observable.create(function(observer) {
    connection.map(function(msg) {
      // Don't allow game to start twice
      if (msg.key == 'GO') return null;
      if (msg.key == 'INPUT' && msg.value.type =='ROCK') return null;

      var copy = utils.deepCopy(msg);
      if (copy.key == 'INPUT') {
        copy.value.player = msg.value.player == 'a' ? 'b' : 'a';
      }
      return copy;
    }).filter(utils.notEmpty)
    .delay(200)
    .subscribe(observer);
  }).share();

  // suppress server-side output to looped connection
  looped.onNext = function(output) { };
  looped.onCompleted = looped.onError = connection.onCompleted.bind(connection);

  return looped;
}
