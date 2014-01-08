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

  var updateObserver = null;
  var updateStream = Rx.Observable.create(function (observer) {
    updateObserver = observer;
  }).combineLatest(actionStream, function(updateTime, lastAction) {
    return lastAction.t > updateTime ? 
      lastAction : {
        t: updateTime,
        k: lastAction.k,
      };
  });
  
  function updateSimulation() {
    if (updateObserver) updateObserver.onNext(Date.now());
  }

  var inputPeriod = updateStream.bufferWithCount(2, 1).map(
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
    rot: Math.PI,
  };

  var rotSpeed = 0.003;
  var thrustAccel = {x: 0.0001, y: 0};
  var maxSpd = {x:0.4, y:0};
  var maxSpdHyp = maxSpd.x * maxSpd.x;

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

        if (spdX*spdX + spdY*spdY > maxSpdHyp) {
          var theta = Math.atan(spdY/spdX);

          var newSpdX = rotatePointX(maxSpd, theta);
          var newSpdY = rotatePointY(maxSpd, theta);

          if (spdX * newSpdX < 0 ) {
            newSpdX *= -1;
          }

          if (spdY * newSpdY < 0 ) {
            newSpdY *= -1;
          }

          spdX = newSpdX;
          spdY = newSpdY;
        }
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
      ctx.clearRect(0, 0, screenSize.x, screenSize.y);

      drawShip(ctx, shipInfo.pos, shipInfo.rot);

      var otherSide = foldPointOnScreen(shipInfo.pos);

      if (otherSide) {
        drawShip(ctx, otherSide, shipInfo.rot);
      }
    } 
    requestAnimationFrame(render);
    _.defer(updateSimulation);
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
var timedValue = function(val) {
  return function() {return [Date.now(), val]};
}
