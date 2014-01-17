var Rx = require('./rx/rx.js');
require('./rx/rx.aggregates');
require('./rx/rx.async');
require('./rx/rx.binding');
require('./rx/rx.coincidence');
require('./rx/rx.time');

var _ = require('./underscore');

var shipF = require('./ship');
var Point = require('./Point');

var tick = () => Rx.Observable.timer(0);

function initGame(canvas){
  var ctx = canvas.getContext('2d');

  var positionKeys = {
    37: 'left',
    38: 'thrust',
    39: 'right',
  }

  // Get keyCode of first event
  var getKeyCode = args => args[0].keyCode;

  var keyUps = Rx.Observable.fromEvent(document, 'keyup', getKeyCode);
  var keyDowns = Rx.Observable.fromEvent(document, 'keydown', getKeyCode);

  var isPositionKey = keyCode => keyCode in positionKeys;

  function keyMapper(isDown) {
    return keyCode => ({
      action: positionKeys[keyCode],
      isDown: isDown,
    });
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

  var _shotKeys = keyUps.filter(isShotKey).map(shotKeyMapper(false))
    .merge(keyDowns.filter(isShotKey).map(shotKeyMapper(true)))
    .distinctUntilChanged(val => val.s)
    .publish();

  _shotKeys.connect();
  shotKeys = Rx.Observable.returnValue({t:0, s:false}).concat(_shotKeys);

  // When we push a time value onto the updateStream, it makes a new entry
  // in the keyState stream for that time. This produces a new value for the
  // ship position
  var updater = new Rx.Subject();
  function updateSimulation() {
    updater.onNext(Date.now());
  }

  var SHOTS = {
    max : 8,
    delay: 200,
    life: 3000,
    accel: {x: 0.2, y: 0},
  };

  var updateWithFirstShots = updater.merge(
    shotKeys.map(key => key.s ? key.t : null).filter(v=>!!v));

  var shotTimes = updater.combineLatest(shotKeys,
    function(t, key) {
      if (!key.s) return null;

      var sT = key.t;

      var diff = t - key.t;

      var lastShotTime = t - diff % SHOTS.delay;

      return lastShotTime;
    }).filter(v => !!v).distinctUntilChanged();


  var updateStream = shotTimes.merge(updater)
    .combineLatest(actionStream,
      function(updateTime, lastAction) {
        var t = Math.max(lastAction.t, updateTime);
        return {
          t: t,
          k: lastAction.k,
        };
      });

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

  var shipStream = inputPeriod.scan(initialShip, shipF.applyInput);

  var shotStream = shotTimes.join(shipStream, tick, tick, function (shotT, ship) {
      if (shotT != ship.t) return null;

      var r = ship.rot;
      return {
        t: shotT,
        rot: r,
        pos : {
          x : ship.pos.x + Point.rotateX(shipF.nose, r),
          y : ship.pos.y + Point.rotateY(shipF.nose, r),
        },
        spd : {
          x : ship.spd.x + Point.rotateX(SHOTS.accel, r),
          y : ship.spd.y + Point.rotateY(SHOTS.accel, r),
        },
      };
    });
  
  shotStream.subscribe(x => console.log(x));

  //FIXME
  /*
  var shotStream = shotTimes.scan([], function(shotList, t) {
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
  */


  var renderInfo = {ship: null, shots:[]};
  shipStream.subscribe(function(k) {
    renderInfo.ship = k;
  });

  /*
  shots.subscribe(function(k) {
    renderInfo.shots = k;
  });
  */


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

global.initGame = initGame;
