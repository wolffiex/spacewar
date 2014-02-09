var Rx = require('Rx');

var RxWebSocketServer = require('RxWebSocketServer');
var utils = require('utils');
var ws = require('ws');
var _ = require('underscore');

var Msg = utils.Msg;
var deepCopy = utils.deepCopy;
var notEmpty = utils.notEmpty;

var START_DELAY = 5000;

function randRange(x) {
  return Math.floor(x + x * Math.random())
}

exports.startServer = function (options) {
  var server = RxWebSocketServer(options);

  // loopback behavior
  if (false) {
    server = server.flatMap(function(connection) {
      return Rx.Observable.fromArray([connection, loopback(connection)]);
    });
  }

  var setup = server.map(function(socket) {
    var recv = Msg.recv(socket);

    var helo = Rx.Observable.return(Msg('HELO', Date.now())).share();

    var sync1 = recv('HELO').map(function() {
      return Msg('SYNC', Date.now())
    }).share();

    var latency = recv('SYNC')
      .take(5)
      .map(function(t) {
        return Date.now() - t;
      }).share()
      .average();

    var sync = recv('SYNC')
      .takeUntil(latency)
      .delay(randRange(50))
      .map(function() {
        return Msg('SYNC', Date.now())
      }).share();

    latency.subscribe(function(m) { console.log('latency', m) });

    helo.merge(sync1).merge(sync).subscribe(socket);

    return {
      latency : latency.single(),
      socket: socket,
    }
  });

  return setup.bufferWithCount(2).map(function(_game, gameNum) {
    var game = {
      a : _game[0],
      b : _game[1],
    };

    var log = new Rx.ReplaySubject();
    log.onNext('Game ' + gameNum);

    var start = game.a.latency.zip(game.b.latency, 
      function(a, b) {
        return { a: a, b: b };
      }).share()
    .delay(randRange(50))
    .map(function(latency) {
      return {
        a: Msg('START', Math.round(START_DELAY-latency.a)),
        b: Msg('START', Math.round(START_DELAY-latency.b)),
      }
    }).share();

    function setupPlayer(player) {
      var oPlayer = player == 'a' ? 'b' : 'a';

      var mySocket = game[player].socket;
      var otherSocket = game[oPlayer].socket;

      var myStart = start.map(function(msgs) {
        log.onNext('start ' + player + ' ' + msgs[player].value);
        return msgs[player];
      }).single().share();

      myStart.concat(
        otherSocket.skipUntil(myStart)).subscribe(mySocket);
    }

    setupPlayer('a');
    setupPlayer('b');

    log.onNext('Game setup ' + gameNum);
    return log;
  }).mergeAll();
}

function loopback(connection) {
  var looped = Rx.Observable.create(function(observer) {
    connection.map(function(msg) {
      // Don't allow game to start twice
      if (msg.key == 'GO') return null;
      if (msg.key == 'INPUT' && msg.value.type =='ROCK') return null;

      var copy = deepCopy(msg);
      if (copy.key == 'INPUT') {
        copy.value.player = msg.value.player == 'a' ? 'b' : 'a';
      }
      return copy;
    }).filter(notEmpty)
    .delay(200)
    .subscribe(observer);
  }).share();

  // suppress server-side output to looped connection
  looped.onNext = function(output) { };
  looped.onCompleted = looped.onError = connection.onCompleted.bind(connection);

  return looped;
}
