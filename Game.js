var Rx = require('Rx');

var deepCopy = require('deepCopy');
var ws = require('ws');
var _ = require('underscore');

function WebSocketConnection(wsc) {
  var connection = Rx.Observable.create(function(observer) {
    if (connection.isClosed) {
      // Immediately complete the stream if it's already closed
      // TODO: Schedule this appropriately
      observer.onCompleted();
      return;
    }
    wsc.on('message', function(msg) {
      observer.onNext(JSON.parse(msg));
    });
    wsc.on('error', function() {
      connection.isClosed = true;
      observer.onError();
    });
    wsc.on('close', function() {
      connection.isClosed = true;
      observer.onCompleted();
    });

    return function () {
      connection.isClosed = true;
      wsc.close();
    };
  }).share(); // Keep one, single connection alive

  connection.onNext = function(message) {
    wsc.send(JSON.stringify(message));
  };

  connection.onCompleted = connection.onError = function() {
    connection.isClosed = true;
    wsc.close();
  };

  return connection;
};

var Msg = function(msg, data, player){
  return {m: msg, d: data}
};

function WebSocketServer(options) {
  return Rx.Observable.create(function(observer) {
    var wss = new ws.Server(options);
    wss.on('connection', observer.onNext.bind(observer));
    wss.on('error', observer.onError.bind(observer));

    return function() {
      wss.close();
    };
  }).select(WebSocketConnection).share();
}

function notNull(x) {return x != null;}
function assert(x) {if (!x) throw "Assertion failed"};

exports.startServer = function (options) {
  var server = WebSocketServer(options);

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
    Rx.Observable.return(Msg('START', {k:'a', t: now}))
      .merge(b).subscribe(a);

    Rx.Observable.return(Msg('START', {k:'b', t: now}))
      .merge(a).subscribe(b);

    // Return an Observable which is the log of the game
    return Rx.Observable.return("Game " + gameNum++);
  }).mergeAll();
}

function loopback(connection) {
  var looped = Rx.Observable.create(function(observer) {
    connection.map(function(o) {
      // Don't allow game to start twice
      if (o.m == 'GO') return null;
      var copy = deepCopy(o);
      if (copy.m == 'INPUT') {
        copy.d.k = o.d.k == 'a' ? 'b' : 'a';
      }
      return copy;
    }).filter(notNull)
    .delay(200)
    .subscribe(observer);
  }).share();

  // suppress server-side output to looped connection
  looped.onNext = function(output) { };
  looped.onCompleted = looped.onError = connection.onCompleted.bind(connection);

  return looped;
}
