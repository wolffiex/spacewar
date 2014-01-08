var screenSize = {
  x: 800,
  y: 400, 
}

var shipPoly = [
  {x:   15, y: 0},
  {x:  -15, y:  10},
  {x:   -4, y:   0},
  {x:  -15, y:  -10},
];

function rotatePoint(pt, r) {
  return { 
    x: pt.x * Math.cos(r) - pt.y * Math.sin(r),
    y: pt.x * Math.sin(r) + pt.y * Math.cos(r),
  };
}

function rotatePointX(pt, r) {
  return pt.x * Math.cos(r) - pt.y * Math.sin(r);
}

function rotatePointY(pt, r) {
  return pt.x * Math.sin(r) + pt.y * Math.cos(r);
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

  var positionKeys = {
    37: 'left',
    38: 'thrust',
    39: 'right',
  }

  // Get keyCode of first event
  var getKeyCode = function(args) {
    return args[0].keyCode;
  }
  var keyUps = Rx.Observable.fromEvent(document, 'keyup', getKeyCode);
  var keyDowns = Rx.Observable.fromEvent(document, 'keydown', getKeyCode);

  function isPositionKey(keyCode) {
    return keyCode in positionKeys;
  }

  function keyMapper(isDown) {
    return function(keyCode) {
      return {
        action: positionKeys[keyCode],
        isDown: isDown,
      };
    }
  }

  var initialKeys = {
    t: 0,
    k: {
      left: false,
      thrust: false,
      right: false,
    },
  };

  var keyStream = keyUps.filter(isPositionKey).map(keyMapper(false))
    .merge(keyDowns.filter(isPositionKey).map(keyMapper(true)))
    .distinctUntilChanged(function(val){
      return val.action + (val.isDown ? '1' : '0');
    });

  var actionStream = Rx.Observable.returnValue(initialKeys).concat(
    keyStream.scan(initialKeys, function(old, input) {
      var nextKeys = _.clone(old.k);
      nextKeys[input.action] = input.isDown;
      return {t: Date.now(), k: nextKeys};
    }));

  var inputPeriod = actionStream.bufferWithCount(2, 1).map(
    function(keyStates) {
      var oldState = keyStates[0];
      var newState = keyStates[1];

      return {
        dt: newState.t - oldState.t,
        k: oldState.k,
      };
    });



  var initialShip = {
    pos: {x: 100, y: 100},
    spd: {x: 0, y: 0},
    rot: 0,
  };

  var rotSpeed = 0.003;
  var thrustAccel = {x: 0.00003, y: 0};
  var ship = inputPeriod.scan(initialShip, function(oldShip, input) {

    var dt = input.dt;
    var rot = oldShip.rot;
    var pos = oldShip.pos;
    var spd = oldShip.spd;

    if (input.k.thrust) {
      // This is easier for to express as a simulation than
      // a continuous function, but I suck at math
      var spdX = spd.x;
      var spdY = spd.y;

      var posX = pos.x;
      var posY = pos.y;


      for (var i = 0; i  < dt; i++) {
        if (input.k.left)  rot -= rotSpeed;
        if (input.k.right) rot += rotSpeed;

        posX += spdX;
        posY += spdY;

        spdX += rotatePointX(thrustAccel, rot);
        spdY += rotatePointY(thrustAccel, rot);
      }

      spd = {x: spdX, y: spdY};
      pos = {x: posX, y: posY};
    } else {
      if (input.k.left)  rot -= dt*rotSpeed;
      if (input.k.right) rot += dt*rotSpeed;
      
      pos = {
        x: oldShip.pos.x + dt * oldShip.spd.x,
        y: oldShip.pos.y + dt * oldShip.spd.y,
      };

    }

    if (pos.x < 0) pos.x += screenSize.x;
    if (pos.x > screenSize.x) pos.x -= screenSize.x;
    if (pos.y < 0) pos.y += screenSize.y;
    if (pos.y > screenSize.y) pos.y -= screenSize.y;


    return {
      pos: pos,
      rot: rot,
      spd: spd,
    }

  });

  var shipInfo = null;
  ship.subscribe(function(k) {
    shipInfo = k;
  });

  function render(time) {
    if (shipInfo) {
      //ctx.clearRect(0, 0, screenSize.x, screenSize.y);

      drawShip(ctx, shipInfo.pos, shipInfo.rot);

      /*
      var otherSide = foldPointOnScreen(pos);

      if (otherSide) {
        drawShip(ctx, otherSide, curr[1]);
      }
      */
    } 
    requestAnimationFrame(render);
  };

  requestAnimationFrame(render);


  /*
  var positionKeys
  function keyStream(keyCode) {
    var isKey = eq(keyCode);
    return allKeyUps.filter(isKey).map(timedValue(false))
      .merge(
        allKeyDowns.filter(isKey).map(timedValue(true))
      ).distinctUntilChanged(function(pair) {
        return pair[1];
      });
  };



  var leftKey = keyStream(keyMap.left);
  leftKey.subscribe(function(k) {
    console.log(k)
  });


  var rightKey = keyStream(keyMap.right);
  var thrustKey = keyStream(keyMap.thrust);



  var inputStream = leftKey.combineLatest(rightKey, thrustKey,
    function(l, r, t) {
      return {
        left: l,
        right: r,
        thrust: t,
      };
    }); 

  var keys = null;
  inputStream.subscribe(function(v) {
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

  var maxSpeed = {x:0, y:-4};
  var maxHyp = maxSpeed.y * maxSpeed.y;

  var speed = timer.zip(rotation, function(dt, r) {
    return keys.thrust ? rotatePoint({x: 0, y: thrustSpeed * dt}, r) : noAccel;
  }).scan(noAccel, function(oldSpeed, accel) {
    var s = translatePt(oldSpeed, accel);
    var sHyp = s.x * s.x + s.y * s.y;
    if (sHyp > maxHyp) {
      var theta = Math.atan(s.x == 0 ? 0 : s.x/s.y);
      newS = rotatePoint(maxSpeed, theta);
      if (s.x * newS.x < 0 ) {
        newS.x *= -1;
      }

      if (s.y * newS.y < 0 ) {
        newS.y *= -1;
      }

      s = newS;
    }

    return s;
  });

  var iPos = {x:100, y:100};
  var position = timer.zip(speed, function(dt, s) {
    var dtScaled = dt/10;
    return {x:s.x*dtScaled, y:s.y*dtScaled}
  }).scan(iPos, function(oldPos, speed) {
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
  */
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
var timedValue = function(val) {
  return function() {return [Date.now(), val]};
}
