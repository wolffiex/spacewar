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

  // Get keyCode of first event
  var getKeyCode = function(args) {
    return args[0].keyCode;
  }

  var allKeyUps = Rx.Observable.fromEvent(document, 'keyup', getKeyCode);
  var allKeyDowns = Rx.Observable.fromEvent(document, 'keydown', getKeyCode);

  function keyStream(keyCode) {
    var isKey = eq(keyCode);
    return allKeyUps.filter(isKey).map(constF(false))
      .merge(
        allKeyDowns.filter(isKey).map(constF(true))
      ).distinctUntilChanged();
  };


  var leftKey = keyStream(keyMap.left);
  var rightKey = keyStream(keyMap.right);
  var rotSpeed = .2;
  var leftRot = valueForDownKey(leftKey, rotSpeed * -1);
  var rightRot = valueForDownKey(rightKey, rotSpeed );

  function valueForDownKey(keyStream, val) {
    return keyStream.combineLatest(timer, function(l, r) {
      return l ? val : 0;
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

var eq = function(val) {
  return function(input) {
    return input == val;
  }
}
var constF = function(val) {
  return function() {return val};
}
