var Rx = require('Rx');

var RxWebSocketServer = require('RxWebSocketServer');
var utils = require('utils');
var ws = require('ws');
var _ = require('underscore');

var Msg = utils.Msg;
var deepCopy = utils.deepCopy;
var notEmpty = utils.notEmpty;
var timestamp = utils.timestamp;

var START_DELAY = 3000;

exports.startServer = function (options) {
  var server = RxWebSocketServer(options);

  // Setup determines average latency for the socket
  var setup = server.flatMap(function(socket) {
    var recv = Msg.recv(socket);

    var recvSync = recv('SYNC'); 

    var latency = timestamp(recvSync, function(now, t) {
        return now - t;
      })
      .take(5)
      .average();

    var helo = Rx.Observable.return('HELO');

    var sync = recv('HELO').merge(recvSync)
      .delay(randRange(50))
      .takeUntil(latency)
      .map(function() {return 'SYNC'});

    // Don't let socket close after sync is done
    var outstream = helo.concat(sync, Rx.Observable.never());
    var stamped = timestamp(outstream, function(now, msgKey) {
        return Msg(msgKey, now);
      })
    .subscribe(socket);
      
    return latency.map(function(l) {
      return socket.isClosed ? null : {
        latency: l,
        socket: latch(socket),
      }})
  }).filter(notEmpty);

  // Set this to true to loopback one connection and make it so
  // that one input stream controls both ships. This is useful
  // for testing
  if (false) {
    setup = setup.flatMap(function(connection) {
      return Rx.Observable.fromArray([connection, {
        latency: 0,
        socket: loopback(connection.socket),
      }]);
    });
  }
  
  return setup.bufferWithCount(2).map(function(_game, gameNum) {
    var game = {
      a : _game[0],
      b : _game[1],
    };

    var log = new Rx.Subject();

    function setupPlayer(player) {
      // Cristian's algorithm
      var recvLatency =  game[player].latency / 2;

      var mySocket = game[player].socket;
      var otherPlayer = player == 'a' ? 'b' : 'a';
      var otherSocket = game[otherPlayer].socket;

      var myStart = new Rx.Subject();
      myStart.single().concat(otherSocket).subscribe(mySocket);

      // Because of the single() on myStart, this message isn't
      // flushed until onCompleted() is called
      myStart.onNext(Msg('START', {
        player: player,
        t: Math.round(START_DELAY - recvLatency),
      }));

      return function() {
        myStart.onCompleted();
      };
    }

    var goA = setupPlayer('a');
    var goB = setupPlayer('b');
    setTimeout(function() {
      // Ideally these would be executed concurrently
      goA(); goB();
    }, randRange(40));

    return log.shareValue('Game ' + gameNum);
  }).mergeAll();
}

function latch(stream) {

  var proxy = Rx.Observable.create(function(observer) {
    stream.subscribe(observer);
    subscription.dispose();
  }).share();

  proxy.onNext = stream.onNext.bind(stream);
  proxy.onCompleted = stream.onCompleted.bind(stream);
  proxy.onError = stream.onError.bind(stream);

  // TODO: This should error the observer if we actually receive any of onNext,
  // onCompleted, or onError in our subscription
  var subscription = stream.subscribe(function() {});
  return proxy;
}


function loopback(socket) {
  var looped = Rx.Observable.create(function(observer) {
    socket
    .filter(function(msg) {
      return msg.key == 'INPUT' && msg.value.type =='KEY';
    })
    .map(function(msg) {
      var copy = deepCopy(msg);
      if (copy.key == 'INPUT') {
        copy.value.player = msg.value.player == 'a' ? 'b' : 'a';
      }
      return copy;
    })
    .delay(200)
    .subscribe(observer);
  }).share();

  // Suppress output to fake socket
  looped.onNext = function() {};
  looped.onCompleted = function() {};

  return looped;

}

function randRange(x) {
  return Math.floor(x + x * Math.random())
}

