var Rx = require('Rx');
var _ = require('underscore');
var deepCopy = require('utils').deepCopy;

var Collisions = require('./Collisions');
var Rocks = require('./Rocks');
var Fire = require('./Fire');
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
        ship.shots = Fire.start(ship, input.t);
      }
      break;
    case 'ROCK':
      state.rocks.push(deepCopy(input));
      break;
  }

  return state;
}

function simulation(rawInput, updater) {
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

        if (gameList.length > 60) {
          gameList = gameList.slice(30);
        }
        return state
      }));

  return snapshot(simState.map(deepCopy), updater,
    function(state, t) {
      return simulate(state, t);
    });
}

function simulate (state, newT) {
  if (newT < state.t) console.log('backwards', state.t - newT);

  for (var t = state.t+1; t < newT; t++) {
    state.collisions = Tick.collisions(state.collisions);

    state = doPlayerTick('a', state);
    state = doPlayerTick('b', state);
    state.rocks = Tick.rocks(state.rocks);

    state.t = t;
  }

  return state;
}

exports.initialShips = initialState.ships 

exports.getRockStream = Rocks.getRockStream;
exports.simulation = simulation;

function doPlayerTick(player, state) {
  var ship = state.ships[player];
  var keys = state.keys[player];

  var oPlayer = player == 'a' ? 'b' : 'a';
  var oShip = state.ships[oPlayer];

  ship = Tick.ship(ship, keys);
  ship.shots = Tick.shots(ship.shots);

  if (keys.fire) {
    ship.shots = Fire.repeat(ship);
  }

  var newCollisions = Collisions.shipCollisions(oShip, ship.shots);
  if (newCollisions.length) {
    state.ships[oPlayer] = shotsImpactShip(oShip, ship.shots, newCollisions);
    state.collisions = state.collisions.concat(
      createShotCollisions(ship.shots, oShip, newCollisions));
    ship.shots = removeCollidedShots(ship.shots, newCollisions);
  }

  var newRockCollisions = Collisions.rockCollisions(ship.shots, state.rocks);
  if (newRockCollisions.length) {
    state.rocks = replaceCollidedRocks(
      state.rocks, _.pluck(newRockCollisions, 'rock'));
    ship.shots = removeCollidedShots(
      ship.shots, _.pluck(newRockCollisions, 'shot'));
  }

  state.ships[player] = ship;
  return state;
}

function shotsImpactShip(oShip, shots, collisions) {
  collisions.forEach(function(shotIndex) {
    var collision = shots[shotIndex];
    oShip.spd.x += collision.spd.x/8;
    oShip.spd.y += collision.spd.y/8;
    oShip.spd = Tick.limitShipSpeed(oShip.spd);
  });

  return oShip;
}

function createShotCollisions(shots, oShip, collisions) {
  return _.map(collisions, (shotIndex) => {
    var collision = shots[shotIndex];
    collision.age = 0;
    collision.spd.x = oShip.spd.x;
    collision.spd.y = oShip.spd.y;
    return collision;
  });
}

function removeCollidedShots(shots, collisions) {
  collisions.forEach(function (shotIndex) {
    shots[shotIndex] = null;
  });

  return _.compact(shots);
}

function replaceCollidedRocks(_rocks, collisions) {
  var rocks = _rocks;
  collisions.forEach(function (rockIndex) {
    var rock = rocks[rockIndex];
    rocks[rockIndex] = null;
    Rocks.splitRock(rock);
  });

  return _.compact(rocks);
}

function snapshot(oCache, oStream, f) {
  var hasCache = false;
  var _cache;
  oCache.subscribe(c => {
    hasCache = true;
    _cache = c
  });

  return oStream.filter(() => hasCache)
    .map(stream => f(_cache, stream));
}
