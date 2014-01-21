var Rx = require('../common/rx/rx.js');
require('../common/rx/rx.aggregates');
require('../common/rx/rx.async');
require('../common/rx/rx.binding');
require('../common/rx/rx.coincidence');
require('../common/rx/rx.time');

var _ = require('../common/underscore');

var Ship = require('./Ship');
var Point = require('./Point');
var Keys = require('./Keys');
var Shots = require('./Shots');

var GameRenderer = null;
global.tGameStart = null;

function startGame(t, otherInput) {
  if (!GameRenderer) throw "Game didn't init"
  tGameStart = t;

  otherInput.subscribe(OtherInput);
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
  var inputStreamRaw = KeyInput.merge(OtherInput).map(input => {
    input.k = input.l && amA ? 'a' : 'b';
    return input;
  });


  var inputBufferList = [{t:0}];

  var inputBuffer = inputStreamRaw.map(next => {
    var list = inputBufferList;
    var ot = _.last(list).t;

    // we need to put this at the last possible spot
    // e.g. list = {t:0}, {t:1}, {t:1}, {t:3}
    // and we receive a new {t:1}, it has to go right before t:3
    var z = list.length;
    var y = z-1;
    list.push(next);

    var needsBuffering = false;
    while(list[y].t > list[z].t) {
      needsBuffering = true;
      var tmp = list[z];
      list[z] = list[y];
      list[y] = tmp;
      y--; z--;
    }

    if (needsBuffering) {
      //console.log('bout of order', next, list.slice(y+1));
      return {
        idx: y+1,
        buffer: list
      };
    }

    // TODO: Trim list
  }).filter(x => !!x);

  var replay = inputBuffer.map(info => Rx.Observable.fromArray(
    info.buffer.slice(info.idx)));

  var orderT = 0;
  var ordered = inputStreamRaw.filter(o => {
    if (orderT > o.t) {
      return false;
    }
    orderT = o.t;
    return true;
  });

  var inputStream = replay.switch().merge(ordered);

  // When we push a time value onto the updater, it makes a new entry in the
  // keyBuffer for that time. This produces a new value for the ship
  // position
  var simulator = new Rx.Subject();
  var carrier = {t:null};
  function updateSimulation() {
    carrier.t = Date.now() - tGameStart;
    simulator.onNext(carrier);
  }


  var initialState = Object.freeze(getInitialState()); 

  var stateBuffer = [initialState];
  // This is an optimization
  var lastState = deepCopy(initialState);
  var playerList = ['a', 'b'];
  var showNextTick = false;
  var loop = inputStream.merge(simulator).map(input => {
    if (lastState.t > input.t) {
      // At the very least, lastState is out of date, so we will
      // take the last state from the stateBuffer. It's possible
      // that the last entry on the stateBuffer is good, though

      // Out of order input, need to fix up stateBuffer
      // and reassign state
      var sbl = stateBuffer.length;
      var idx = sbl-1;
      while(stateBuffer[idx].t > input.t) {
        if (idx ==0) throw "Fell too far behind";
        idx--;
      }

      showNextTick = true;

      if (idx < sbl-1) {
        //console.log('drop', stateBuffer, lastState.t, input.t, idx+1 - stateBuffer.length);
        stateBuffer = stateBuffer.slice(0, idx+1);
      }

      lastState = deepCopy(_.last(stateBuffer));
    }

    if (lastState.t > _.last(stateBuffer.t)) {
      //console.log(lastState, stateBuffer)
      throw 'whaa';
    }

    var state = lastState;

    var isNewInput = !!input.keys;
    var shipA = state.ships.a;
    var shipB = state.ships.b;

    for (var t = state.t; t < input.t; t++) {
      state.collisions = Shots.tickCollisions(state.collisions);

      playerList.forEach(k => { //shipTick
        var ship = state.ships[k];
        var keys = state.keys[k];

        var oShip = state.ships[k == 'a' ? 'b' : 'a'];

        ship = Ship.inputTick(ship, keys);
        ship.shots = Shots.tickShots(ship.shots);

        if (keys.fire) {
          ship.shots = Shots.repeatFire(ship);
        }
        state.ships[k] = ship;

        var newCollisions = Ship.checkShots(oShip, ship.shots);

        if (newCollisions.length) {
          // this mutates shipA.shots
          var shots = ship.shots;

          _.each(newCollisions, function(shotIndex) {
            //
            var collision = shots[shotIndex];
            shots[shotIndex] = null;
            collision.age = 0;
            collision.spd.x /= 2;
            collision.spd.y /= 2;

            state.collisions = state.collisions.concat(collision);
          });

          ship.shots = _.compact(shots);
        }
      });

    }

    var startFire = isNewInput && input.keys.fire;
    if (startFire) {
      var ship = state.ships[input.k];
      ship.shots = Shots.startFire(ship, t);
    }

    state.t = input.t;
    // not necessary since these functions are mutative, but
    // it would be nice if they didn't have to be
    state.ships.a = shipA;
    state.ships.b = shipB;
    if (isNewInput) {
      state.keys[input.l ? 'a' : 'b'] =  input.keys;
      // save a copy of state in case we need to rewind
      stateBuffer.push(Object.freeze(deepCopy(state)));
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
    ships : initialState.ships,
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

    var shotsB = renderInfo.ships.b.shots;
    ctx.fillStyle = '#F0F';
    if (shotsB.length) Shots.draw(ctx, shotsB);

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

function getInitialState() {
  var t = 0;

  var initialKeys = _.reduce(Keys.actions, (o, action) =>{
    o[action] = false;
    return o;
  }, {});

  var keys = {a: initialKeys, b: initialKeys};
  var collisions = [];

  var shipA = {
    pos: {x:100, y:100},
    spd: {x:0, y:0},
    rot: Math.PI,
    shots: [],
  };

  var shipB = {
    pos: {x:200, y:200},
    spd: {x:0, y:0},
    rot: 0,
    shots: [],
  };

  var ships = {a: shipA, b: shipB}

  return {t, keys, collisions, ships};
}

function deepCopy(o) {
  return JSON.parse(JSON.stringify(o));
}
