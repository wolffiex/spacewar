var Rx = require('./common/rx/rx');
var Rx = require('./common/rx/rx.binding');
var deepCopy = require('./common/deepCopy');
var ws = require('ws');

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

var Msg = function(msg, data){ return {m: msg, d: data} };

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

exports.startServer = function (options) {
  var server = WebSocketServer(options);

  var lobby = server.subscribe(function(connection) {
    connection.onNext(Msg('WAITING', Date.now()));
  });

  var loopback = false;
  if (loopback) {
    server = server.flatMap(function(connection) {
      var looped = loopbackConnection(connection);
      return Rx.Observable.fromArray([connection, looped]);
    });
  }

  server.bufferWithCount(2).subscribe(function (pair) {
    var connectCount = 0;
    var playerA = mapPlayer('a', pair[0]);
    var playerB = mapPlayer('b', pair[1]);

    var SYNC = {};
    var gotSync = {a: null, b:null};
    var game = Rx.Observable.returnValue(SYNC).concat(
      playerA.merge(playerB)).map(function(d) {
        if (d == SYNC) {
          var msg = Msg('SYNC', Date.now());
          return {a: msg, b:msg};
        }

        var k = d.k
        var o = d.o;
        switch (o.m) {
          case 'SYNC':
            gotSync[k] = o.d;
            return gotSync.a && gotSync.b ? {
              a: Msg('START', {k: 'a', t: Date.now()}),
              b: Msg('START', {k: 'b', t: Date.now()}),
            } : {}
          case 'INPUT':
            return k == 'a' ? {b: o} : {a:o};
        }
      });

    game.subscribe(playerA);
    game.subscribe(playerB);

  });
}

function mapPlayer(k, connection) {
  var player = Rx.Observable.create(function(observer) {
  connection.map(function(o) {
    return {k: k, o:o};
    }).subscribe(observer);
  }).share();

  player.onNext = function(output) {
    if (output[k]) {
      connection.onNext(output[k]);
    }
  }

  player.onCompleted = player.onError = connection.onCompleted.bind(connection);

  return player;
}

function loopbackConnection(connection) {
  var looped = Rx.Observable.create(function(observer) {
    connection.map(function(o) {
      var copy = deepCopy(o);
      if (copy.m == 'INPUT') {
        copy.d.k = o.d.k == 'a' ? 'b' : 'a';
      }
      return copy;
    })
    .subscribe(observer);
  }).share();

  // suppress server-side output to looped connection
  looped.onNext = function(output) { };
  looped.onCompleted = looped.onError = connection.onCompleted.bind(connection);

  return looped;
}
