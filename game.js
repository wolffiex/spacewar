var screenSize = {
  x: 800,
  y: 400, 
}

var shipPoly = [
  {x:   0, y: -15},
  {x: -10, y:  15},
  {x:   0, y:   4},
  {x:  10, y:  15},
];

function rotatePoint(pt, r) {
  return { 
    x: pt.x * Math.cos(r) - pt.y * Math.sin(r),
    y: pt.x * Math.sin(r) + pt.y * Math.cos(r),
  };
}

function translatePt(pt, dxdy) {
  return {
    x: pt.x + dxdy.x,
    y: pt.y + dxdy.y,
  };
}

function drawShip(ctx, pos, r) {
  var ship = shipPoly.map(function(pt) {
    var newPt = rotatePoint(pt, r);
    // don't make an extra array by calling translatePt
    newPt.x += pos.x
    newPt.y += pos.y

    return newPt;
  });

  ctx.fillStyle = '#F00';
  ctx.beginPath();

  var start = _.last(ship); 
  ctx.moveTo(start.x, start.y);

  _.forEach(ship, function(pt) {
    ctx.lineTo(pt.x, pt.y);
  });

  ctx.fill();
}

fS = {a : "rgb(200,0,0)", b: "rgb(0,200,0)", isA: false};

function getTimer() {
  var lastTime = Date.now();
  var generator = Rx.Observable.generateWithRelativeTime(
    Date.now(), 
    constF(true),
    function(nowTime) { 
      lastTime = nowTime;
      var nowTime = Date.now();
      return nowTime;
    },
    function(nowTime) {
      var diff = nowTime - lastTime;
      return diff;
    },
    function() { return 10; }
  );

  var timer = generator.publish();
  var connect = timer.connect();

  return timer;

}

function initGame(canvas){
  var ctx = canvas.getContext('2d');
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
  var thrustKey = keyStream(keyMap.thrust);

  var keyStream = leftKey.combineLatest(rightKey, thrustKey,
    function(l, r, t) {
      return {
        left: l,
        right: r,
        thrust: t,
      };
    }); 

  var keys = null;
  keyStream.subscribe(function(v) {
    keys = v;
  });

  var timer = getTimer();

  var rotSpeed = 0.003;
  var ir = 0;

  var rotation = timer.map(function(dt) {
    var dr = 0;
    if (keys.left) dr -= dt * rotSpeed;
    if (keys.right) dr += dt * rotSpeed;
    return dr;
  }).scan(ir, function(rot, dr) {
    return rot + dr;
  });

  var noAccel = {x:0, y:0};
  var thrustSpeed = -0.002;

  var maxSpeed = {x:4, y:0};
  var maxHyp = maxSpeed.x * maxSpeed.x;

  var speed = timer.zip(rotation, function(dt, r) {
    return keys.thrust ? rotatePoint({x: 0, y: thrustSpeed * dt}, r) : noAccel;
  }).scan(noAccel, function(oldSpeed, accel) {
    var s = translatePt(oldSpeed, accel);
    var sHyp = s.x * s.x + s.y * s.y;
    if (sHyp > maxHyp) {
      var r = Math.atan(s.x == 0 ? 0 : s.y/s.x);
      newS = rotatePoint(maxSpeed, r);
      if (s.x < 0 ) {
        newS.x *= -1;
        newS.y *= -1;
      }

      s = newS;
    }

    return s;
  });

  var iPos = {x:100, y:100};
  var position = speed.scan(iPos, function(oldPos, speed) {
    var newPos = translatePt(oldPos, speed);
    if (newPos.x < 0) newPos.x += screenSize.x;
    if (newPos.x > screenSize.x) newPos.x -= screenSize.x;
    if (newPos.y < 0) newPos.y += screenSize.y;
    if (newPos.y > screenSize.y) newPos.y -= screenSize.y;
    return newPos;
  });

  // info = [[newX, newY], newR]; 
  var info = rotation.zip(position, function(r, pt) {
    return [pt, r];
  });


  var drawInfo = null;
  info.subscribe(function(v) {
    drawInfo = v;
  });


  var oldTime = null;
  function render(time) {
    //fS.isA = !fS.isA;
    oldTime = time;
    curr = drawInfo;
    if (drawInfo) {
      var curr = drawInfo;
      drawInfo = null;

      ctx.clearRect(0, 0, screenSize.x, screenSize.y);

      drawShip(ctx, curr[0], curr[1]);
      var pos = curr[0];

      var otherSide = foldPointOnScreen(pos);

      if (otherSide) {
        drawShip(ctx, otherSide, curr[1]);
      }
    }
    requestAnimationFrame(render);
  };

  requestAnimationFrame(render);
}

var tolerance = 20;
function foldPointOnScreen(pt) {
  var foldedPt = null;

  if (pt.x < tolerance) {
    foldedPt = {x: pt.x + screenSize.x, y: pt.y};
  } else if (pt.x > screenSize.x - tolerance) {
    foldedPt = {x: pt.x - screenSize.x, y: pt.y};
  }

  if (pt.y < tolerance) {
    foldedPt = foldedPt || _.clone(pt);
    foldedPt.y = pt.y + screenSize.y
  } else if (pt.y > screenSize.y - tolerance) {
    foldedPt = foldedPt || _.clone(pt);
    foldedPt.y = pt.y - screenSize.y
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
