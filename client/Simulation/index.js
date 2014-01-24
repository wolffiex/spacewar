var Rx = require('../../common/rx/rx.js');
require('../../common/rx/rx.aggregates');
require('../../common/rx/rx.async');
require('../../common/rx/rx.binding');
require('../../common/rx/rx.coincidence');
require('../../common/rx/rx.time');


var Ship = require('../Ship');
var Shots = require('../Shots');
var _ = require('../../common/underscore');
var deepCopy = require('../../common/deepCopy');

var initialState = require('./initialState');

// When we push a time value onto the updater, it makes a new entry in the
// keyBuffer for that time. This produces a new value for the ship
// position
var driver = new Rx.Subject();
var carrier = {t:null};

exports.initialShips = initialState.ships;

exports.update = (t) => {
  carrier.t = t;
  driver.onNext(carrier);
}

exports.getSimulation = inputStream => 
  inputStream.merge(driver).map(simulate).filter(s => !!s);

var stateBuffer = [initialState];
// This is an optimization
var lastState = deepCopy(initialState);
var showNextTick = false;

function simulate(input) {
  if (lastState.t > input.t) {
    // At the very least, lastState is out of date, so we will
    // take the last state from the stateBuffer. It's possible
    // that the last entry on the stateBuffer is good, though

    var sbl = stateBuffer.length;
    var idx = sbl-1;
    while(stateBuffer[idx].t > input.t) {
      if (idx ==0) throw "Fell too far behind";
      idx--;
    }

    showNextTick = true;

    if (idx < sbl-1) {
      // Out of order input, need to fix up stateBuffer
      stateBuffer = stateBuffer.slice(0, idx+1);
    }

    lastState = deepCopy(_.last(stateBuffer));
  }

  if (lastState.t > _.last(stateBuffer.t)) {
    //console.log(lastState, stateBuffer)
    throw 'whaa';
  }

  // TODO: We should probably save state if a lot of time has passed beteween
  // lastState and last(stateBuffer) It could be costly to rebuild state if
  // we get an out of order update

  var state = lastState;

  var isNewInput = !!input.action;
  var shipA = state.ships.a;
  var shipB = state.ships.b;

  for (var t = state.t; t < input.t; t++) {
    state.collisions = Shots.tickCollisions(state.collisions);
    state = doPlayerTick('a', state);
    state = doPlayerTick('b', state);
  }

  if (input.action == 'fire' && input.isDown) {
    var ship = state.ships[input.k];
    ship.shots = Shots.startFire(ship, t);
  }

  state.t = input.t;
  // not necessary since these functions are mutative, but
  // it would be nice if they didn't have to be
  state.ships.a = shipA;
  state.ships.b = shipB;
  if (isNewInput) {
    var keys = state.keys[input.k];
    keys[input.action] = input.isDown;
    // save a copy of state in case we need to rewind
    stateBuffer.push(Object.freeze(deepCopy(state)));
    if (stateBuffer.length > 30) {
      stateBuffer = stateBuffer.slice(15);
    }
  }

  // Only spit out state for driver times
  return isNewInput ? null : state;
}

function doPlayerTick(k, state) {
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
  return state;
}
