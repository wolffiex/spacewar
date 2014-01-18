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

  // When we push a time value onto the updater, it makes a new entry in the
  // keyBuffer for that time. This produces a new value for the ship
  // position
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
    last: {t:null, k:{}},
    next: {t:null, k:{}},
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
    var startFire = !keys.fire && inputs.next.k.fire;

    for (var t = inputs.last.t; t < inputs.next.t; t++) {
      if (keys) {
        shipA = Ship.inputTick(shipA, keys);
        shipA.shots = Shots.cull(shipA.shots, t);
        if (keys.fire) {
          shipA.shots = Shots.repeatFire(shipA, t);
        }
      }
    }

    if (startFire) shipA.shots = Shots.startFire(shipA, t);

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
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, Point.screenSize.x, Point.screenSize.y);

    ctx.fillStyle = '#0FF';
    Ship.draw(ctx, renderInfo.ships.a);
    ctx.fillStyle = '#F0F';
    Ship.draw(ctx, renderInfo.ships.b);

    ctx.fillStyle = '#0FF';
    var shotsA = renderInfo.ships.a.shots;
    if (shotsA.length) Shots.draw(ctx, shotsA);

    requestAnimationFrame(render);
    _.defer(updateSimulation);
  };

  requestAnimationFrame(render);
}

global.initGame = initGame;
