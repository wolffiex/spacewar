var Rx = require('Rx');
var _ = require('underscore');
var deepCopy = require('utils').deepCopy;

var Ship = require('../Ship');
var Shots = require('../Shots');

var initialState = require('./initialState');
var TimeBuffer = require('./TimeBuffer');

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

var stateBuffer = new TimeBuffer(initialState);

function simulate(input) {
  state = stateBuffer.getBefore(input.t);

  var isNewInput = !!input.action;

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
  if (isNewInput) {
    var keys = state.keys[input.k];
    keys[input.action] = input.isDown;
  }

  stateBuffer.save(state, isNewInput);

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

  var newCollisions = Ship.checkShots(oShip, ship.shots);

  if (newCollisions.length) {
    // this mutates shipA.shots
    var shots = ship.shots;

    // shots also affect speed of ship that was hit
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
