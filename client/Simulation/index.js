var Rx = require('Rx');
var _ = require('underscore');
var deepCopy = require('utils').deepCopy;

var Shots = require('./Shots');
var Tick = require('./Tick');

var initialState = require('./initialState');

var gameList = [{state: initialState, input: null}];

// special case to avoid slow call to splice in
// the common case
function fastSplice(list, idx, item) {
  if (idx == list.length) list.push(item);
  else list.splice(idx, 0, item);
  return list;
}

function mergeInput(state, input) {
  switch (input.type) {
    case 'KEY':
      state.keys[input.player][input.action] = input.isDown;

      // We also account for initial shot when we merge input
      if (input.action == 'fire' && input.isDown) {
        var ship = state.ships[input.player];
        ship.shots = Shots.startFire(ship, input.t);
      }
      break;
    case 'ROCK':
      state.rocks.push(input);
      break;
  }

  return state;
}

function Simulation(rawInput, updater) {
  var simState = Rx.Observable.return(initialState).concat(
      rawInput.map(function (input) {
      var p = gameList.length;
      while (input.t < gameList[p-1].state.t) {
        if (--p < 1) throw "Can't find time before " + input.t
      }

      gameList = fastSplice(gameList, p, {input:input, state: null});

      // now run the simulation forward
      for (p; p < gameList.length; p++) {
        var state = deepCopy(gameList[p-1].state);
        var input = gameList[p].input;
        state = simulate(state, input.t);

        state = mergeInput(state, input);

        gameList[p].state = Object.freeze(state);
      }

      // NB: gameList never shrinks for now
      return state
    }));

  return snapshot(simState.map(deepCopy), updater,
    function(state, t) {
      return simulate(state, t);
    });
}

function simulate (state, newT) {
  if (newT < state.t) console.log('backwards')
  for (var t = state.t+1; t < newT; t++) {
    state.collisions = Tick.collisions(state.collisions);

    state.rocks = Tick.rocks(state.rocks);

    state = doPlayerTick('a', state);
    state = doPlayerTick('b', state);
    state.t = t;
  }

  return state;
}


Simulation.initialShips = initialState.ships 
module.exports = Simulation;

function doPlayerTick(player, state) {
  var ship = state.ships[player];
  var keys = state.keys[player];

  var oShip = state.ships[player == 'a' ? 'b' : 'a'];

  ship = Tick.ship(ship, keys);
  ship.shots = Tick.shots(ship.shots);

  if (keys.fire) {
    ship.shots = Shots.repeatFire(ship);
  }

  var newCollisions = Shots.shipCollisions(oShip, ship.shots);

  if (newCollisions.length) {
    var {collisions, shots} = 
      doShotCollisions(state, newCollisions, ship.shots, oShip);
    state.collisions = collisions;
    ship.shots = shots;
  }

  state.ships[player] = ship;
  return state;
}

function doShotCollisions(state, newCollisions, shots, oShip) {
  var collisions = state.collisions.concat(_.map(newCollisions, shotIndex => {
    var collision = shots[shotIndex];
    shots[shotIndex] = null;
    oShip.spd.x += collision.spd.x/8;
    oShip.spd.y += collision.spd.y/8;

    oShip.spd = Tick.limitShipSpeed(oShip.spd);

    collision.age = 0;
    collision.spd.x = oShip.spd.x;
    collision.spd.y = oShip.spd.y;
    return collision;
  }));

  shots = _.compact(shots);
  return {collisions, shots};
}

function snapshot(oCache, oStream, f) {
  var _cache;
  oCache.subscribe(c => {_cache = c});

  return oStream.map(stream => f(_cache, stream));
}
