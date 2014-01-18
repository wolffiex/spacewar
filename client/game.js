var Rx = require('./rx/rx.js');
require('./rx/rx.aggregates');
require('./rx/rx.async');
require('./rx/rx.binding');
require('./rx/rx.coincidence');
require('./rx/rx.time');

var _ = require('./underscore');

var Ship = require('./ship');
var Point = require('./Point');
var Keys = require('./Keys');

function initGame(canvas){
  var ctx = canvas.getContext('2d');

  var keyInput = Keys.getStream(document);

  // When we push a time value onto the updateStream, it makes a new entry
  // in the keyState stream for that time. This produces a new value for the
  // ship position
  var updater = new Rx.Subject();
  function updateSimulation() {
    updater.onNext(Date.now());
  }


  var initialShips = {
    a: {
      pos: {x:100, y:100},
      spd: {x:0, y:0},
      rot: Math.PI,
      shots: [],
    },

    b: {
      pos: {x:300, y:300},
      spd: {x:0, y:0},
      rot: 0,
      shots: [],
    },
  };

  var initialState = {
    ships: initialShips,
  } 

  var loop = keyInput.scan({
      last: null,
      next: {t:null, k:null}
    }, function(keys, next) {
      // Optimized for render loop, to avoid object creation
      keys.last = keys.next;
      keys.next = next;

      // FIXME
      if (!keys.last.t) {
        keys.last.t = keys.next.t;
      }
      return keys;
    }).scan(initialState, function(state, inputs) {
      //console.log(inputs)

      var dt = inputs.next.t - inputs.last.t;
      if (dt < 0) throw "Reverse time for input";

      var shipA = state.ships.a;
      var shipB = state.ships.b;

      var keys = inputs.last.k;
      console.log(dt, keys)
      for (var i = 0; i  < dt; i++) {
        if (keys) shipA = Ship.inputTick(shipA, keys);
      }
      return state;
    });

  var renderInfo = {
    ships : initialShips
  };

  // This is optimized not to create an object
  loop.subscribe(state => {renderInfo.ships = state.ships});

  function render(time) {
    ctx.clearRect(0, 0, Point.screenSize.x, Point.screenSize.y);

    renderShip(renderInfo.ships.a);
    renderShip(renderInfo.ships.b);

    requestAnimationFrame(render);
    _.defer(updateSimulation);
  };

  function renderShip(ship) {
    var shots = ship.shots;

    if (ship) {
      Ship.draw(ctx, ship.pos, ship.rot);
      var otherSide = Point.foldOnScreen(ship.pos);

      if (otherSide) {
        Ship.draw(ctx, otherSide, ship.rot);
      }
    }

    if (shots.length) drawShots(ctx, renderInfo.shots);
  }

  requestAnimationFrame(render);

  var SHOTS = {
    max : 8,
    delay: 200,
    life: 3000,
    accel: {x: 0.2, y: 0},
  };
  /*


  var shotTimes = updater.combineLatest(keyInput,
    function(t, key) {
      if (!key.k.fire) return null;

      var sT = key.t;

      var diff = t - key.t;

      var lastShotTime = t - diff % SHOTS.delay;

      return lastShotTime;
    }).filter(v => !!v).distinctUntilChanged();

  //shotTimes.subscribe(x=>console.log(x));


  var updateStream = shotTimes.merge(updater)
    .combineLatest(keyInput, (updateTime, lastAction) => ({
      t: Math.max(lastAction.t, updateTime),
      k: lastAction.k,
    }));

  // Elements of the inputPeriod stream are slices of time when
  // the input state was stable. This drives the simulation.
  var inputPeriod = updateStream.bufferWithCount(2, 1).map(keyStates => ({
      t: keyStates[1].t,
      k: keyStates[0].k,
    }));

  var initialShip = {
    t: 0,
    pos: {x: 100, y: 100},
    spd: {x: 0, y: 0},
    rot: Math.PI,
  };

  var initialShots = [];

  var shipStream = inputPeriod.scan(initialShip, Ship.applyInput);

  var shotStream = shotTimes.combineLatest(shipStream, function (shotT, ship) {
      if (shotT != ship.t) return null;

      var r = ship.rot;
      return {
        t: shotT,
        rot: r,
        pos : {
          x : ship.pos.x + Point.rotateX(Ship.nose, r),
          y : ship.pos.y + Point.rotateY(Ship.nose, r),
        },
        spd : {
          x : ship.spd.x + Point.rotateX(SHOTS.accel, r),
          y : ship.spd.y + Point.rotateY(SHOTS.accel, r),
        },
      };
    }).filter(v => !!v)
    // Why are we getting dups here?
    .distinctUntilChanged(shot=>shot.t)
    .scan([], function(shotList, nextShot) {
      if (!nextShot) return shotList;
      // Interesting, the shotStream should conceptually just be the list of every
      // shot, but we can trim it here and it seems like it will be much more
      // efficient
      var t = nextShot.t;
      var shotList = _.filter(shotList, function(shot) {
        return t - shot.t < SHOTS.life;
      });
      if (shotList.length < SHOTS.max) shotList.push(nextShot);
      return shotList;
    });

  var activeShots = shotStream.combineLatest(updater, function(shotList, t) {
    if (!shotList.length) return shotList;
    var firstShot = shotList[0];

    // Optimization for last shot is old
    var lastShot = _.last(shotList);
    if (t - lastShot.t > SHOTS.life) return [];

    // or first shot is young
    if (t - firstShot.t < SHOTS.life) return shotList;

    return _.filter(shotList, function(shot) {
      return t - shot.t < SHOTS.life;
    });
  });

  var renderInfo = {ship: null, shots:[]};
  shipStream.subscribe(function(k) {
    renderInfo.ship = k;
  });

  activeShots.subscribe(function(k) {
    renderInfo.shots = k;
  });


  */

}

var ods = null;
function drawShots(ctx, shotList) {
  ods = shotList;
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

global.initGame = initGame;
