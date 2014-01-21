var Rx = require('./common/rx/rx');
var Rx = require('./common/rx/rx.binding');
var ws = require('ws');

function WebSocketConnection(ws) {
  var connection = Rx.Observable.create(function(observer) {
    if (connection.isClosed) {
      // Immediately complete the stream if it's already closed
      // TODO: Schedule this appropriately
      observer.onCompleted();
      return;
    }
    ws.on('message', function(msg) {
      observer.onNext(JSON.parse(msg));
    });
    ws.on('error', function() {
      connection.isClosed = true;
      observer.onError();
    });
    ws.on('close', function() {
      connection.isClosed = true;
      observer.onCompleted();
    });

    return function () {
      connection.isClosed = true;
      ws.close();
    };
  }).share(); // Keep one, single connection alive

  connection.onNext = function(message) {
    ws.send(JSON.stringify(message));
  };
  connection.onCompleted = connection.onError = function() {
    connection.isClosed = true;
    ws.close();
  };

  connection.n = n++;
  return connection;
};
var n = 0;

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

    //game.subscribe(playerA);
    //game.subscribe(playerB);

    getPlayerFilter(game, 'a').subscribe(pair[0]);
    getPlayerFilter(game, 'b').subscribe(pair[1]);

  });
}

function mapPlayer(k, connection) {
  return connection.map(function(o) {
    return {k: k, o:o};
  });
}

function getPlayerFilter(game, k) {
  return game.filter(function(output) {
      return !!output[k];
    }).map(function(output) { return output[k]})
}
