var Rx = require('./rx/rx.js');
require('./rx/rx.aggregates');
require('./rx/rx.async');
require('./rx/rx.binding');
require('./rx/rx.coincidence');
require('./rx/rx.time');

var _ = require('./underscore');

var shipF = require('./ship');
var Point = require('./Point');

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

  var ship = inputPeriod.scan(initialShip, shipF.applyInput);

  var SHOTS = {
    max : 8,
    delay: 200,
    life: 3000,
    accel: {x: 0.2, y: 0},
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

      var shotTime = currShip.t - diff % SHOTS.delay;

      // Bail if last shot doesn't fall in this window
      if (shotTime <= lastShip.t) return null;

      // This is an optimization, but here we assume that the render
      // period is shorter than the shot period. That is, we never
      // create two shots in a single render tick
      
      // This could be more awesome, but for now we just average the ship
      // states over the interval to take the shot position and speed. A
      // higher fidelity implementation woiuld be to examine the key states
      // and use the function to calculate the ship state directly

      var shot =  averageBodies(lastShip, currShip, shotTime);
      shot.pos.x += Point.rotateX(shipF.nose, shot.rot);
      shot.pos.y += Point.rotateY(shipF.nose, shot.rot);

      shot.spd.x += Point.rotateX(SHOTS.accel, shot.rot);
      shot.spd.y += Point.rotateY(SHOTS.accel, shot.rot);
      return shot;
    }).filter(function(shot) {
      return !!shot;
    });

  // Interesting, the shotStream should conceptually just be the list of every
  // shot, but we can trim it here and it seems like it will be much more
  // efficient
  var shotStream = shotEmitter.scan([], function(_shotList, nextShot) {
    var t = nextShot.t;
    var shotList = _.filter(_shotList, function(shot) {
      return t - shot.t < SHOTS.life;
    });
    if (shotList.length < SHOTS.max) shotList.push(nextShot);
    return shotList;
  });

  var EMPTY_LIST = [];
  var shots = shotStream.combineLatest(updater, function(shotList, t) {
    if (!shotList.length) return shotList;
    var firstShot = shotList[0];

    // Optimization for last shot is old
    var lastShot = _.last(shotList);
    if (t - lastShot.t > SHOTS.life) return EMPTY_LIST;

    // or first shot is young
    if (t - firstShot.t < SHOTS.life) return shotList;

    return _.filter(shotList, function(shot) {
      return t - shot.t < SHOTS.life;
    });
  });


  var renderInfo = {ship: null, shots:[]};
  ship.subscribe(function(k) {
    renderInfo.ship = k;
  });

  shots.subscribe(function(k) {
    renderInfo.shots = k;
  });


  function render(time) {
    var ship = renderInfo.ship;
    var shots = renderInfo.shots;

    ctx.clearRect(0, 0, Point.screenSize.x, Point.screenSize.y);

    if (ship) {
      shipF.draw(ctx, ship.pos, ship.rot);
      var otherSide = Point.foldOnScreen(ship.pos);

      if (otherSide) {
        shipF.draw(ctx, otherSide, ship.rot);
      }
    }

    if (shots.length) drawShots(ctx, renderInfo.shots);

    requestAnimationFrame(render);
    _.defer(updateSimulation);
  };

  requestAnimationFrame(render);
}

function drawShots(ctx, shotList) {
  shotList.forEach(function(shot) {
    var dt = Date.now() - shot.t;
    var x = shot.pos.x + shot.spd.x * dt;;
    var y = shot.pos.y + shot.spd.y * dt;;
    x = x % Point.screenSize.x;
    y = y % Point.screenSize.y;
    if (x < 0) x += Point.screenSize.x;
    if (y < 0) y += Point.screenSize.y;
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI*2, true); 
    ctx.closePath();
    ctx.fill();
  });
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

    r[k] = {
      x: d0[k].x + incX*dt,
      y: d0[k].y + incY*dt,
    };
  });
  
  return r;
}

global.initGame = initGame;
