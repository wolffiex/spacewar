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

  // Setup determines average latency for the socket
  var setup = server.flatMap(function(socket) {
    var recv = Msg.recv(socket);

    var helo = Rx.Observable.return(Msg('HELO', Date.now())).share();

    var recvSync = recv('SYNC').share(); 

    var latency = recvSync
      .take(5)
      .map(function(t) {
        return Date.now() - t;
      }).share()
      .average();

    var sync = recv('HELO').merge(recvSync)
      .delay(randRange(50))
      .takeUntil(latency)
      .map(function() {
        return Msg('SYNC', Date.now())
      }).share();

    helo.merge(sync).subscribe(socket);

    // I'm not too happy that I had to add this API to to web socket
    // connections, since I generally like the idea the socket should close when
    // noone is observing it and/or it's not observing anything. But in this
    // case, the sequence that calcuates latency may terminate before the game
    // starts, and we need to tell the socket that. It gets unpinned once the
    // game starts
    socket.pinOpen();

    return latency.map(function(l) {
      return {
        latency: l,
        socket: socket,
      }})
  });
  
  return setup.bufferWithCount(2).map(function(_game, gameNum) {
    var game = {
      a : _game[0],
      b : _game[1],
    };

    var log = new Rx.ReplaySubject();
    log.onNext('Game ' + gameNum);

    function setupPlayer(player) {
      // Cristian's algorithm
      var recvLatency =  game[player].latency / 2;
      var mySocket = game[player].socket;

      var otherSocket = game[player == 'a' ? 'b' : 'a'].socket;

      var myStart = new Rx.Subject();
      myStart.single().concat(otherSocket).subscribe(mySocket);

      var startMsg = Msg('START', {
        player: player,
        t: Math.round(START_DELAY - recvLatency),
      });

      // Because of the single() on myStart, that message isn't
      // flushed until this is called
      myStart.onNext(startMsg);
      return function() {
        myStart.onCompleted();
        mySocket.unpinOpen();
      };
    }

    var goA = setupPlayer('a');
    var goB = setupPlayer('b');
    // Ideally these would be executed concurrently
    setTimeout(function() {
      goA();
      goB();
    }, randRange(40));

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
