var shipPoly = [
  [ 15, 0],
  [-15, 10],
  [-7, 0],
  [-15,-10],
];

function drawShip(ctx, dx, dy, r) {
  var ship = shipPoly.map(function(pt) {
    var x = pt[0];
    var y = pt[1];

    x2 = x * Math.cos(r) - y * Math.sin(r);
    y2 = x * Math.sin(r) + y * Math.cos(r);

    return [x2 + dx, y2 + dy];
  });

  // clear
  ctx.clearRect(dx - 20, dy - 20, 40, 40);

  ctx.fillStyle = '#F00';
  ctx.beginPath();

  var start = _.last(ship); 
  ctx.moveTo(start[0], start[1]);

  _.forEach(ship, function(pt) {
    ctx.lineTo(pt[0], pt[1]);
  });

  ctx.fill();
}

function initGame(canvas){
  var ctx = canvas.getContext('2d');
  drawShip(ctx, 100, 100, 0);

  var timer = Rx.Observable.timer(10, 10);

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

  var rotSpeed = 0.01;
  var leftRot = valueForDownKey(leftKey, rotSpeed * -1);
  var rightRot = valueForDownKey(rightKey, rotSpeed );

  function valueForDownKey(keyStream, val) {
    return keyStream.combineLatest(timer, function(isDown, t) {
      return isDown ? val : 0;
    }).filter(isNonZero);
  };

  var rotation = leftRot.merge(rightRot).scan(0, function(acc, v) {
    return acc + v;
  });

  rotation.subscribe(function(val) {
    drawShip(ctx, 100, 100, val);
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
