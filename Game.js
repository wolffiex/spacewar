var Rx = require('./common/rx/rx');
var connections = new Rx.Subject();

var games 

exports.getOut = function(connection) {
  connections.onNext(connection);
  return Rx.Observable.empty();
}
