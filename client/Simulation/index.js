var Rx = require('Rx');
var _ = require('underscore');
var deepCopy = require('utils').deepCopy;

var Ship = require('../Ship');
var Shots = require('../Shots');

var initialState = require('./initialState');
var TimeBuffer = require('./TimeBuffer');

function Simulation(inputStream) {
  var stateBuffer = new TimeBuffer(initialState);
  return inputStream
    .map(simulate.bind(null, stateBuffer))
    .filter(s => !!s);
}

Simulation.initialShips = initialState.ships 
module.exports = Simulation;

function simulate(stateBuffer, input) {
  if (input.t < 0) return;
  var isNewAction = !!input.action;

  if (!isNewAction && !stateBuffer.isLast(input.t)) {
    console.log(input, stateBuffer._last)
    throw "Received input from the future";
  }
    
  state = stateBuffer.getBefore(input.t);


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
  if (input.action) {
    var keys = state.keys[input.k];
    keys[input.action] = input.isDown;
  }

  state = stateBuffer.save(state, !!input.action);

  return input.isUpdate ? state : null;
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

  var newCollisions = Ship.checkShots(oShip, ship.shots);

  if (newCollisions.length) {
    // this mutates shipA.shots
    var shots = ship.shots;

    _.each(newCollisions, function(shotIndex) {
      var collision = shots[shotIndex];
      shots[shotIndex] = null;
      oShip.spd.x += collision.spd.x/8;
      oShip.spd.y += collision.spd.y/8;

      oShip.spd = Ship.limitSpeed(oShip.spd);

      collision.age = 0;
      collision.spd.x = oShip.spd.x;
      collision.spd.y = oShip.spd.y;

      state.collisions = state.collisions.concat(collision);
    });

    ship.shots = _.compact(shots);
  }

  state.ships[k] = ship;
  return state;
}
