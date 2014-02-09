var Rx = require('Rx');
var _ = require('underscore');
var deepCopy = require('utils').deepCopy;

var Collisions = require('./Collisions');
var Fire = require('./Fire');
var Tick = require('./Tick');

var initialState = require('./initialState');

var gameList = [{state: initialState, input: null}];

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

  // If a long time goes between inputs, it may take a while to redo the
  // simulation up to the current time. This could be fixed by optimizing
  // simulate() to recognize cases where it can use its last computed value.
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

        state = mergeInput(simulate(state, input.t), input);
        gameList[p].state = Object.freeze(state);
      }

      if (gameList.length > 60) {
        gameList = gameList.slice(30);
      }
      return state;
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

  var sCollisions = Collisions.shipCollisions(oShip, ship.shots);
  if (sCollisions.length) {
    state.ships[oPlayer] = shotsImpactShip(oShip, ship.shots, sCollisions);
    state.collisions = state.collisions.concat(
      createShotCollisions(ship.shots, oShip, sCollisions));
    ship.shots = removeCollided(ship.shots, sCollisions);
  }

  var rCollisions = Collisions.rockCollisions(ship.shots, state.rocks);
  if (rCollisions.length) {
    state.rocks = removeCollided(state.rocks, _.pluck(rCollisions, 'rock'));
    ship.shots = removeCollided(ship.shots, _.pluck(rCollisions, 'shot'));
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

function removeCollided(list, collisions) {
  collisions.forEach(function (idx) {
    list[idx] = null;
  });

  return _.compact(list);
}

// special case to avoid slow call to splice in
// the common case
function fastSplice(list, idx, item) {
  if (idx == list.length) list.push(item);
  else list.splice(idx, 0, item);
  return list;
}


// calls f() with the last value of oCache
// for every value of oStream, as long as
// there's at least one value for oCache
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
