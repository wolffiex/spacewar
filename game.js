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

  var _actionStream = keyStream.scan(initialKeys, function(old, input) {
      var nextKeys = _.clone(old.k);
      nextKeys[input.action] = input.isDown;
      return {t: Date.now(), k: nextKeys};
    }).publish();

  _actionStream.connect();

  var actionStream = Rx.Observable.returnValue(initialKeys)
    .concat(_actionStream);

  function isShotKey(keyCode) {
    return keyCode == 32;
  }

  function shotKeyMapper(isDown) {
    return function() {
      return {t: Date.now(), s: isDown, u: Math.random()};
    }
  }

  function constF(val) {
    return function(){ return val; };
  }

  var _shotKeys = keyUps.filter(isShotKey).map(shotKeyMapper(false))
    .merge(keyDowns.filter(isShotKey).map(shotKeyMapper(true)))
    .distinctUntilChanged(function(val){
      return val.s;
    }).publish();

  _shotKeys.connect();
  shotKeys = Rx.Observable.returnValue({t:0, s:false}).concat(_shotKeys);

  // When we push a time value onto the updateStream, it makes a new entry
  // in the keyState stream for that time. This produces a new value for the
  // ship position
  var updater = new Rx.Subject();
  var updateStream = updater.combineLatest(actionStream, shotKeys,
    function(updateTime, lastAction, shotKeyState) {
      var t = Math.max(lastAction.t, updateTime, shotKeyState.t);
      return {
        t: t,
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
        k: oldState.k,
      };
    });

  var initialShip = {
    t: 0,
    pos: {x: 100, y: 100},
    spd: {x: 0, y: 0},
    rot: Math.PI,
  };

  var initialShots = [];

  var ship = inputPeriod.scan(initialShip, applyInputToShip);

  var SHOTS = {
    max : 8,
    delay: 100,
    life: 2000,
    accel: {x: 0.1, y: 0},
  };

  var shotEmitter = ship.bufferWithCount(2,1).combineLatest(shotKeys,
    function(shipStates, shotKeyState) {
      if (!shotKeyState.s) return null;

      var lastShip = shipStates[0];
      var currShip = shipStates[1];

      // Does a shot repetition fall within the interval?
      // lastShip.t - now
      var diff = currShip.t - shotKeyState.t;

      // I think this was fixed by publish()ing the key streams
      // but the behavior was unexpected here before I changed
      // this to publish
      if (diff < 0) throw "Unexpected time difference";

      var lastShotTime = currShip.t - diff % SHOTS.delay;

      // Bail if last shot doesn't fall in this window
      if (lastShotTime <= lastShip.t) return null;

      //console.log(lastShip, currShip, shotKeyState)

      // This is an optimization, but here we assume that the render
      // period is shorter than the shot period. That is, we never
      // create two shots in a single render tick
      
      // This could be more awesome, but for now we just average the ship
      // states over the interval to take the shot position and speed. A
      // higher fidelity implementation woiuld be to examine the key states
      // and use the function to calculate the ship state directly

      var shot =  averageBodies(lastShip, currShip, lastShotTime);
      shot.spd.x += rotatePointX(SHOTS.accel, shot.rot);
      shot.spd.y += rotatePointY(SHOTS.accel, shot.rot);
      return shot;
    }).filter(function(shot) {
      return !!shot;
    });

  var shots = shotEmitter.bufferWithCount(8, 1);


  var renderInfo = {shots:[]};
  ship.subscribe(function(k) {
    renderInfo.ship = k;
  });

  shots.subscribe(function(k) {
    //console.log(k)
    renderInfo.shots = k;
  });


  function render(time) {
    if (renderInfo.ship) {
      var ship = renderInfo.ship;
      ctx.clearRect(0, 0, screenSize.x, screenSize.y);

      drawShip(ctx, ship.pos, ship.rot);
      if (renderInfo.shots.length) drawShots(ctx, renderInfo.shots);

      var otherSide = foldPointOnScreen(ship.pos);

      if (otherSide) {
        drawShip(ctx, otherSide, ship.rot);
      }
    } 
    requestAnimationFrame(render);
    _.defer(updateSimulation);
  };

  requestAnimationFrame(render);
}

function drawShots(ctx, shotList) {
  shotList.forEach(function(shot) {
    //console.log('a', shot)
    var x = shot.pos.x;
    var y = shot.pos.y;
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI*2, true); 
    ctx.closePath();
    ctx.fill();
  });
}

var rotSpeed = 0.003;
var thrustAccel = {x: 0.0001, y: 0};
var maxSpd = {x:0.4, y:0};
var maxSpdHyp = maxSpd.x * maxSpd.x;
function applyInputToShip (oldShip, input) {
  var dt = input.t - oldShip.t;
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
    t: input.t,
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

var posAndSpd = ['pos', 'spd'];
function averageBodies(d0, d1, t) {
  // NEXT: Average rotation for ship
  var dt = t - d0.t;
  if (dt < 0) throw "Point average underflow";
  if (d0.t + dt > d1.t) throw "Point average overflow";

  var timePeriod = d1.t - d0.t;
  var dr = d1.rot - d0.rot;
  var r = {
    t: t,
    rot: d0.rot + (dr/dt) * timePeriod,
  };
  posAndSpd.forEach(function(k) {
    var dt = d1.t - d0.t;
    var dx = d1[k].x - d0[k].x;
    var dy = d1[k].y - d0[k].y;

    var incX = dx/timePeriod;
    var incY = dy/timePeriod;
    //console.log(k, dx, dy, timePeriod, incX, incY, d0[k].x, d0[k].y)

    r[k] = {
      x: d0[k].x + incX*dt,
      y: d0[k].y + incY*dt,
    };
  });
  
  //console.log(timePeriod, r);
  return r;
}
