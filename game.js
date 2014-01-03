function initGame(canvas){
  var ctx = canvas.getContext('2d');
  // Create gradient
  var grd=ctx.createLinearGradient(0,0,200,0);
  grd.addColorStop(0,"red");
  grd.addColorStop(1,"white");

  // Fill with gradient
  ctx.fillStyle=grd;
  ctx.fillRect(10,10,150,80);

  var timer = Rx.Observable.timer(100, 100);

  var keyMap = {
    'left' : 37,
    'up'   : 38,
    'right': 39,
  }

  var allKeyUps = Rx.Observable.fromEvent(document, 'keyup', function(args) {
    return [args[0].keyCode, false];
  });

  var allKeyDowns = Rx.Observable.fromEvent(document, 'keydown', function(args) {
    return [args[0].keyCode, true];
  });

  function keyStream(keyCode) {
    function isKey(keyPair) {
      return keyPair[0] == keyCode;
    }

    return allKeyUps.filter(isKey)
      .merge(allKeyDowns.filter(isKey))
      .distinctUntilChanged();
  };


  var leftKey = keyStream(keyMap.left);
  var rightKey = keyStream(keyMap.right);
  var rotSpeed = .2;
  var leftRot = valueForDownKey(leftKey, rotSpeed * -1);
  var rightRot = valueForDownKey(rightKey, rotSpeed );

  function valueForDownKey(keyStream, val) {
    return keyStream.combineLatest(timer, function(l, r) {
      return l[1] ? val : 0;
    }).filter(isNonZero);
  };

  var rotation = leftRot.merge(rightRot).scan(0, function(acc, v) {
    return acc + v;
  });

  rotation.subscribe(function(val) {
    console.log(val)
  });

}

function mapDict(obj, f) {
  var newDict = {};
  for (var k in obj) {
    newDict[k] = f(k);
  }

  return newDict;
}

var isNonZero = function(v) {return v != 0;};
