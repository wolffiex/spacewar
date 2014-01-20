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

var GameRenderer = null;
global.tGameStart = null;
function startGame(t, otherInput) {
  if (!GameRenderer) throw "Game didn't init"
  tGameStart = t;

  //otherInput.subscribe(OtherInput);
  requestAnimationFrame(GameRenderer);
  return KeyInput;

}

var KeyInput = null;
var OtherInput = null;
var amA = true;
function initGame(canvas){
  var ctx = canvas.getContext('2d');

  KeyInput = Keys.getStream(document);
  OtherInput = new Rx.Subject();

  // This must syncrhonize the input stream
  var inputStream = KeyInput.merge(OtherInput);

  // When we push a time value onto the updater, it makes a new entry in the
  // keyBuffer for that time. This produces a new value for the ship
  // position
  var simulator = new Rx.Subject();
  var carrier = {t:null};
  function updateSimulation() {
    carrier.t = Date.now() - tGameStart;
    simulator.onNext(carrier);
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
    t: 0,
    k: {},
    collisions: [],
    ships: initialShips,
  } 

  var stateBuffer = [initialState];
  // This is an optimization
  var lastState = initialState;
  var loop = KeyInput.merge(simulator).map(input => {
    var state = lastState;
    if (lastState.t > input.t) {
      // Out of order input, need to fix up stateBuffer
      // and reassign state
    }

    var isNewInput = !!input.k;
    var shipA = state.ships.a;
    var shipB = state.ships.b;
    var keys = state.k;

    for (var t = state.t; t < input.t; t++) {
      if (keys) {
        shipA = Ship.inputTick(shipA, keys);
        shipA.shots = Shots.tickShots(shipA.shots);

        if (keys.fire) {
          shipA.shots = Shots.repeatFire(shipA);
        }
      }

      state.collisions = Shots.tickCollisions(state.collisions);

      var newCollisions = Ship.checkShots(shipB, shipA.shots);

      if (newCollisions.length) {
        // this mutates shipA.shots
        var shots = shipA.shots;

        _.each(newCollisions, function(shotIndex) {
          //
          var collision = shots[shotIndex];
          shots[shotIndex] = null;
          collision.age = 0;
          collision.spd.x /= 2;
          collision.spd.y /= 2;

          state.collisions = state.collisions.concat(collision);
        });
        shipA.shots = _.compact(shots);
      }
    }

    var startFire = isNewInput && !keys.fire && input.k.fire;
    if (startFire) shipA.shots = Shots.startFire(shipA, t);

    state.t = input.t;
    // not necessary since these functions are mutative, but
    // it would be nice if they didn't have to be
    state.ships.a = shipA;
    state.ships.b = shipB;
    if (isNewInput) {
      state.k = input.k;
      // save a copy of state in case we need to rewind
      stateBuffer[stateBuffer.length-1] = deepCopy(state);
      stateBuffer.push(state);
      if (stateBuffer.length > 30) {
        stateBuffer = stateBuffer.slice(15);
      }
    }

    // Only spit out state for simulator times
    // This doesn't matter much here, but it could if
    // the simulator were driving the renderer
    return isNewInput ? null : state;
  }).filter(s => !!s);
  
  var renderInfo = {
    ships : initialShips,
    collisions : [],
  };

  // This is optimized not to create an object
  loop.subscribe(state => {
    if (state) {
      renderInfo.ships = state.ships;
      renderInfo.collisions = state.collisions;
    }
  });

  GameRenderer = function (time) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, Point.screenSize.x, Point.screenSize.y);

    ctx.fillStyle = '#0FF';
    Ship.draw(ctx, renderInfo.ships.a);
    ctx.fillStyle = '#F0F';
    Ship.draw(ctx, renderInfo.ships.b);

    ctx.fillStyle = '#0FF';
    var shotsA = renderInfo.ships.a.shots;
    if (shotsA.length) Shots.draw(ctx, shotsA);

    if (renderInfo.collisions.length) {
      Shots.drawCollisions(ctx, renderInfo.collisions);
    }

    requestAnimationFrame(GameRenderer);
    _.defer(updateSimulation);
  };

}

global.initGame = initGame;

var socket = new WebSocket("ws://localhost:3001");
socket.onopen = function (event) {
  console.log('socket is open')
};

function send(message, data) {
  socket.send(JSON.stringify({m: message, d:data}));
}


var otherInput = new Rx.Subject();
socket.onmessage = function (event) {
  var o = JSON.parse(event.data);
  //console.log(o);
  switch (o.m) {
    case 'CONNECT':
      send('CONNECT', Date.now());
      break;
    case 'START':
      var input = startGame(Date.now(), otherInput);
      input.subscribe(k => send('INPUT', k));
      break;
    case 'INPUT':
      //console.log('input', o.d)
      otherInput.onNext(o.d);
      break;
  }
}

function deepCopy(o) {
  return JSON.parse(JSON.stringify(o));
}
