var Rx = require('./common/rx/rx');
var Rx = require('./common/rx/rx.binding');
var Rx = require('./common/rx/rx.aggregates');
var deepCopy = require('./common/deepCopy');
var ws = require('ws');
var _ = require('./common/underscore');

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

exports.startServer = function (options) {
  var server = WebSocketServer(options);

  return server.bufferWithCount(2).flatMap(function(game) {
    var a = game[0];
    var b = game[1];

    var syncMsg = Msg('SYNC', Date.now())
    var sync = Rx.Observable.return([syncMsg, syncMsg]);

    var preamble = sync.concat(
      a.first().zip(b.first(), function(msgA, msgB) {
        if (msgA.m != 'SYNC' || msgB.m != 'SYNC') throw "Preamble mismatch";

        //console.log('t', msgA, msgA.d, msgB.d);

        return [
          Msg('START', {k: 'a', t:Date.now()}),
          Msg('START', {k: 'b', t:Date.now()})];
      }));
    
    var aOut = preamble.select(function(pair) {
      console.log('got', pair, pair[0])
      return pair[0];
    }).concat(b);

    var bOut = preamble.select(function(pair) {
      return pair[1];
    }).concat(a);

    return Rx.Observable.fromArray([aOut, bOut]);

  }).zip(server, function(conn, out) {
    conn.subscribe(out);
    return out.map(function(msg) { 
      return ['LOG', msg];
    });
  }).mergeAll();

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
