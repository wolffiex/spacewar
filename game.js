var screenSize = {
  x: 800,
  y: 400, 
}

var shipPoly = [
  [  0, -15],
  [-10,  15],
  [  0,   4],
  [ 10,  15],
];

function rotatePoint(pt, r) {
  var x = pt[0];
  var y = pt[1];

  var x2 = x * Math.cos(r) - y * Math.sin(r);
  var y2 = x * Math.sin(r) + y * Math.cos(r);
  return [x2, y2];
}

function translatePt(pt, dxdy) {
  return [pt[0] + dxdy[0], pt[1] + dxdy[1]];
}

function clearShip(ctx, pos) {
  ctx.clearRect(pos[0] - 20, pos[1] - 20, 40, 40);
}

function drawShip(ctx, pos, r) {
  var ship = shipPoly.map(function(pt) {
    var newPt = rotatePoint(pt, r);
    // don't make an extra array
    newPt[0] += pos[0];
    newPt[1] += pos[1];

    return newPt;
  });

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
    'left'   : 37,
    'thrust' : 38,
    'right'  : 39,
  }

  // Get keyCode of first event
  var getKeyCode = function(args) {
    return args[0].keyCode;
  }

  var allKeyUps = Rx.Observable.fromEvent(document, 'keyup', getKeyCode);
  var allKeyDowns = Rx.Observable.fromEvent(document, 'keydown', getKeyCode);

  function keyStream(keyCode) {
    var isKey = eq(keyCode);
    return Rx.Observable.returnValue(false).concat(
      allKeyUps.filter(isKey).map(constF(false))
        .merge(
          allKeyDowns.filter(isKey).map(constF(true))
        ).distinctUntilChanged());
  };


  var leftKey = keyStream(keyMap.left);
  var rightKey = keyStream(keyMap.right);

  var rotSpeed = 0.03;

  var ir = 0;
  var rotation = timer.combineLatest(leftKey, rightKey, 
    function(t, leftIsDown, rightIsDown) {
      var v = 0;
      if (leftIsDown) v -= rotSpeed;
      if (rightIsDown) v += rotSpeed;
      return v;
    }).scan(ir, function(acc, v) {
      return acc + v;
    });

  var noAccel = [0,0];
  var thrustSpeed = [0, -0.02];

  var speed = rotation.combineLatest(keyStream(keyMap.thrust),
    function(r, thrustIsDown) {
      return thrustIsDown ? rotatePoint(thrustSpeed, r) : noAccel;
    }).scan([0,0], function(oldSpeed, accel) {
      return translatePt( oldSpeed, accel);
    });

  var iPos = [100, 100];
  var position = speed.scan(iPos, function(oldPos, speed) {
    var newPos = translatePt(oldPos, speed);
    if (newPos[0] < 0) newPos[0] += screenSize.x;
    if (newPos[0] > screenSize.x) newPos[0] -= screenSize.x;
    if (newPos[1] < 0) newPos[1] += screenSize.y;
    if (newPos[1] > screenSize.y) newPos[1] -= screenSize.y;
    return newPos;
  });

  // shipCoords = [ [[oldX, oldY], oldR], [[newX, newY], newR]]; 
  var shipCoords = rotation.zip(position, function(r, pt) {
    return [pt, r];
  }).bufferWithCount(2, 1);


  shipCoords.subscribe(function(lastTwo) {
    var prev = lastTwo[0];

    clearShip(ctx, prev[0]);

    var oldOtherSide = foldPointOnScreen(prev[0]);
    if (oldOtherSide) {
      clearShip(ctx, oldOtherSide);
    }

    var curr = lastTwo[1];
    drawShip(ctx, curr[0], curr[1]);
    var pos = curr[0];

    var otherSide = foldPointOnScreen(pos);

    if (otherSide) {
      drawShip(ctx, otherSide, curr[1]);
    }

  });
}

var tolerance = 20;
function foldPointOnScreen(pt) {
  var x = pt[0];
  var y = pt[1];

  var foldedPt = null;

  if (x < tolerance) {
    foldedPt = [x + screenSize.x, y];
  } else if (x > screenSize.x - tolerance) {
    foldedPt = [x - screenSize.x, y];
  }

  if (y < tolerance) {
    foldedPt = foldedPt || pt.concat();
    foldedPt[1] = y + screenSize.y
  } else if (y > screenSize.y - tolerance) {
    foldedPt = foldedPt || pt.concat();
    foldedPt[1] = y - screenSize.y
  }

  return foldedPt;
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
