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

  var actionStream = Rx.Observable.returnValue(initialKeys).concat(
    keyStream.scan(initialKeys, function(old, input) {
      var nextKeys = _.clone(old.k);
      nextKeys[input.action] = input.isDown;
      return {t: Date.now(), k: nextKeys};
    }));

  function isShotKey(keyCode) {
    return keyCode == 32;
  }

  function shotKeyMapper(isDown) {
    return function() {
      return {t: Date.now(), s: isDown};
    }
  }
  var SHOTS = {
    max : 8,
    delay: 200,
    life: 2000,
  };

  var shotTimes = Rx.Observable.returnValue({t:0, s:false}).concat(
    keyUps.filter(isShotKey).map(shotKeyMapper(false))
    .merge(keyDowns.filter(isShotKey).map(shotKeyMapper(true)))
    .distinctUntilChanged(function(val){
      return val.s;
    })).scan([], function(oldShots, input) {
      // first truncate the existing list to the current time
      // and remove any old shots
      var nextShots = oldShots.filter(function(t) {
        return t < input.t && t + SHOTS.life > input.t;
      });

      if (!input.s) return nextShots;

      // now if key is down, add shots to fill
      return nextShots.concat(_.range(0, SHOTS.max-nextShots.length).map(function (i) {
        return input.t + i * SHOTS.delay;
      }));

    });

  // When we push a time value onto the updateStream, it makes a new entry
  // in the keyState stream for that time. This produces a new value for the
  // ship position
  var updater = new Rx.Subject();
  var updateStream = updater.combineLatest(actionStream, 
    function(updateTime, lastAction) {
      return lastAction.t > updateTime ?  lastAction : {
        t: updateTime,
        k: lastAction.k,
      };
    });

  function updateSimulation() {
    updater.onNext(Date.now());
  }

  // Elements of the inputPeriod stream are slices of time when
  // the input state was stable. This drives the simulation.
  var inputPeriod = updateStream.bufferWithCount(2, 1).map(
    function(keyStates) {
      var oldState = keyStates[0];
      var newState = keyStates[1];

      return {
        t: newState.t,
        tLast: oldState.t,
        k: oldState.k,
      };
    });

  var shotStream = shotTimes.combineLatest(inputPeriod,
    function(shotList, input) {
      return _.filter(shotList, function(shotTime) {
        return shotTime > input.tLast && shotTime < input.t;
      });
    }).flatMap(function(ar) {
      return Rx.Observable.fromArray(ar);
    });


  shotStream.subscribe(function(v){ console.log(v)});


  var initialShip = {
    t: 0,
    pos: {x: 100, y: 100},
    spd: {x: 0, y: 0},
    rot: Math.PI,
  };

  var ship = inputPeriod.scan(initialShip, applyInputToShip);

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

var rotSpeed = 0.003;
var thrustAccel = {x: 0.0001, y: 0};
var maxSpd = {x:0.4, y:0};
var maxSpdHyp = maxSpd.x * maxSpd.x;
function applyInputToShip (oldShip, input) {
  var dt = input.t - input.tLast;
  var rot = oldShip.rot;
  var pos = oldShip.pos;
  var spd = oldShip.spd;

  if (input.k.thrust) {
    // It might be better to express this as continuous function rather than a
    // discrete simulation, but I suck at math
    var spdX = spd.x;
    var spdY = spd.y;

    var posX = pos.x;
    var posY = pos.y;


    // For every millisecond, we're just going to simulate
    // what happened
    for (var i = 0; i  < dt; i++) {
      if (input.k.left)  rot -= rotSpeed;
      if (input.k.right) rot += rotSpeed;

      posX += spdX;
      posY += spdY;

      spdX += rotatePointX(thrustAccel, rot);
      spdY += rotatePointY(thrustAccel, rot);

      // Limit speed by scaling the speed vector if
      // necessary
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
    // When the thrusters are off, the continuous
    // function is easy
    if (input.k.left)  rot -= dt*rotSpeed;
    if (input.k.right) rot += dt*rotSpeed;
    
    pos = {
      x: oldShip.pos.x + dt * oldShip.spd.x,
      y: oldShip.pos.y + dt * oldShip.spd.y,
    };

  }

  // Screen wrapping
  if (pos.x < 0) pos.x += screenSize.x;
  if (pos.x > screenSize.x) pos.x -= screenSize.x;
  if (pos.y < 0) pos.y += screenSize.y;
  if (pos.y > screenSize.y) pos.y -= screenSize.y;


  return {
    pos: pos,
    rot: rot,
    spd: spd,
  }
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
