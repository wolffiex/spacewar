var _ = require('./underscore');
var Rx = require('./rx/rx');

module.exports.getStream = (doc) => {

  var positionKeys = {
    37: 'left',
    38: 'thrust',
    39: 'right',
    32: 'fire',
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
    keys: {
      left: false,
      thrust: false,
      right: false,
    },
    // l is for local
    l: true,
  };

  return Rx.Observable.returnValue(initialKeys).concat(
    keyStream.scan(initialKeys, function(old, input) {
      var nextKeys = _.clone(old.keys);
      nextKeys[input.action] = input.isDown;
      return {t: Date.now() - global.tGameStart, keys: nextKeys, l:true};
    }).share());

}
