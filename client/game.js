var Rx = require('./rx/rx.js');
require('./rx/rx.aggregates');
require('./rx/rx.async');
require('./rx/rx.binding');
require('./rx/rx.coincidence');
require('./rx/rx.time');

var _ = require('./underscore');

var Ship = require('./Ship');
var Point = require('./Point');
var Keys = require('./Keys');
var Shots = require('./Shots');

function initGame(canvas){
  var ctx = canvas.getContext('2d');

  var keyInput = Keys.getStream(document);

  // When we push a time value onto the updateStream, it makes a new entry
  // in the keyState stream for that time. This produces a new value for the
  // ship position
  var updater = new Rx.Subject();
  var carrier = {t:null};
  function updateSimulation() {
    carrier.t = Date.now();
    updater.onNext(carrier);
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

  var keyBuffer = keyInput.merge(updater).scan({
    last: {t:null, k:null},
    next: {t:null, k:null},
  }, function(input, next) {
    // This is tricky, but it's optimized for render loop,
    // to avoid object creation
    input.last.t = input.next.t;
    input.last.k = input.next.k;

    if (next.k) {
      // This is actual input
      input.next = next;
    } else {
      // This is input we're fabricating to drive the render loop
      input.next.t = next.t;
      input.next.k = input.last.k;
    }

    // FIXME
    if (!input.last.t) {
      input.last.t = input.next.t;
    }

    return input;
  });

  var loop = keyBuffer.scan(initialState, function(state, inputs) {
    var shipA = state.ships.a;
    var shipB = state.ships.b;

    var keys = inputs.last.k;

    for (var t = inputs.last.t; t < inputs.next.t; t++) {
      if (keys) {
        shipA = Ship.inputTick(shipA, keys);
        if (keys.fire) shipA.shots = Shots.doFire(shipA, t);
      }
    }

    // not necessary since these functions are mutative, but
    // it would be nice if they didn't have to be
    state.ships.a = shipA;
    state.ships.b = shipB;
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
    var shotsA = renderInfo.ships.a.shots;
    if (shotsA.length) Shots.draw(ctx, shotsA);

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

  }

  requestAnimationFrame(render);

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

global.initGame = initGame;
