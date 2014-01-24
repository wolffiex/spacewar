var _ = require('underscore');
var Rx = require('Rx');

var KEY_CODES = {
  37: 'left',
  38: 'thrust',
  39: 'right',
  32: 'fire',
};

exports.actions = _.values(KEY_CODES);

exports.getStream = (doc) => {

  // Get keyCode of first event
  var getKeyCode = args => args[0].keyCode;

  var keyUps = Rx.Observable.fromEvent(doc, 'keyup', getKeyCode);
  var keyDowns = Rx.Observable.fromEvent(doc, 'keydown', getKeyCode);

  var isPositionKey = keyCode => keyCode in KEY_CODES;

  function keyMapper(isDown) {
    return keyCode => ({
      action: KEY_CODES[keyCode],
      isDown: isDown,
    });
  }

  return keyUps.filter(isPositionKey).map(keyMapper(false))
    .merge(keyDowns.filter(isPositionKey).map(keyMapper(true)))
    .distinctUntilChanged(function(val){
      // putting the filter here rather means that we end up creating some
      // duplicate key states when two keys are down, but this is harmless
      return val.action + (val.isDown ? '1' : '0');
    });
}
