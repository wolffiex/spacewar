var _ = require('./underscore');
var Rx = require('./rx/rx');

module.exports.getStreams = (doc) => {

  var positionKeys = {
    37: 'left',
    38: 'thrust',
    39: 'right',
  }

  // Get keyCode of first event
  var getKeyCode = args => args[0].keyCode;

  var keyUps = Rx.Observable.fromEvent(doc, 'keyup', getKeyCode);
  var keyDowns = Rx.Observable.fromEvent(doc, 'keydown', getKeyCode);

  var isPositionKey = keyCode => keyCode in positionKeys;

  function keyMapper(isDown) {
    return keyCode => ({
      action: positionKeys[keyCode],
      isDown: isDown,
    });
  }

  var keyStream = keyUps.filter(isPositionKey).map(keyMapper(false))
    .merge(keyDowns.filter(isPositionKey).map(keyMapper(true)))
    .distinctUntilChanged(function(val){
      // putting the filter here rather than on the action stream
      // means that we end up creating some duplicate key states
      // but this is harmless, and it saves object creation in the
      // common case
      return val.action + (val.isDown ? '1' : '0');
    });

  var initialKeys = {
    t: 0,
    k: {
      left: false,
      thrust: false,
      right: false,
    },
  };

  var _actionStream = keyStream.scan(initialKeys, function(old, input) {
      var nextKeys = _.clone(old.k);
      nextKeys[input.action] = input.isDown;
      return {t: Date.now(), k: nextKeys};
    }).publish();

  _actionStream.connect();

  var motionKeys = Rx.Observable.returnValue(initialKeys)
    .concat(_actionStream);

  function isShotKey(keyCode) {
    return keyCode == 32;
  }

  function shotKeyMapper(isDown) {
    return function() {
      return {t: Date.now(), s: isDown, u: Math.random()};
    }
  }

  var _shotKeys = keyUps.filter(isShotKey).map(shotKeyMapper(false))
    .merge(keyDowns.filter(isShotKey).map(shotKeyMapper(true)))
    .distinctUntilChanged(val => val.s)
    .publish();

  _shotKeys.connect();
  shotKeys = Rx.Observable.returnValue({t:0, s:false}).concat(_shotKeys);

  return {motionKeys, shotKeys};
}
