var Point = require('../Point');
var Shapes = require('../Shapes');
var _ = require('underscore');
var deepCopy = require('utils').deepCopy;
var xy = Point.xy;

var SHOTS = {
  max : 18,
  delay: 400,
  accel: xy(0.2, 0),
};

// Mutates ship.shots
function tryFire(ship) {
  var shots = ship.shots;
  if (shots.length < SHOTS.max) {
    var r = ship.rot;
    var shot = {
      age : 0,
      pos : Point.translate(ship.pos, Point.rotate(Shapes.shipNose, r)),
      spd : Point.translate(ship.spd, Point.rotate(SHOTS.accel, r)),
    };
    shots.push(shot);
  }

  return shots;
}

// Mutates ship.shots
exports.startFire = function(ship) {
  return tryFire(ship);
}

// Mutates ship.shots
exports.repeatFire = function(ship) {
  var shots = ship.shots;
  var lastAge = shots.length ? _.last(shots).age : Infinity;
  if (lastAge > SHOTS.delay ) shots = tryFire(ship);
  return shots;
}

var shipBoundingRadius = 15;
exports.shipCollisions = function(ship, shots) {
  return getShotCollisions(shots, ship.pos, Shapes.ship, shipBoundingRadius);
}

exports.rockCollisions = function(shots, rocks) {
  var collisions = EMPTY_LIST;
  if (shots.length) {
    for (var i=0; i < rocks.length; i++) {
      var rock = rocks[i];
      var nextCollisions = getShotCollisions(shots, rock.pos, rock.shape, 15);
      if (nextCollisions.length) {
        console.log('here', nextCollisions, collisions, i);
        collisions = collisions.concat(
          _.map(nextCollisions, (idx) => ({
            rock: i,
            shot: idx,
          }))
        );
      }
    }
  }
  return collisions;
}

var EMPTY_LIST = [];
// For now, let's pretend shots have no dimension,
// they're just a point
function getShotCollisions(shots, pos, shape, bounding) {
  var collisions = EMPTY_LIST;
  for (var i=0; i < shots.length; i++) {
    var shot = shots[i];

    // First check bounding box
    if (Math.abs(pos.x - shot.pos.x) < bounding) {
      if (Math.abs(pos.y - shot.pos.y) < bounding) {
        // Now need to do detailed check
        collisions = collisions.concat(i);
      }
    }
  }

  return collisions;
}

var MAXROCKS = 4;
exports.getRockStream = function(simulation) {
  return simulation.sample(2500)
    .filter(state => Math.random() < (MAXROCKS-state.rocks.length)/MAXROCKS)
    .map(() => generateRock(0, xy(
      Math.random() * Point.screenSize.x,
      Math.random() * Point.screenSize.y)));
}

var ROCK_TYPES = [
  {
    maxRot : 0.002,
    accel : xy(0.03, 0),
    radius: 20,
    sides: 10,
  },
  {
    maxRot : 0.004,
    accel : xy(0.05, 0),
    radius: 10,
    sides: 8,
  },
  {
    maxRot : 0.006,
    accel : xy(0.07, 0),
    radius: 4,
    sides: 6,
  },
];

function generateRock(rocktype, pos) {
  var ROCKTYPE = ROCK_TYPES[rocktype];

  var rotspd = ROCKTYPE.maxRot * 2 * Math.random() - ROCKTYPE.maxRot;
  var spd = Point.rotate(ROCKTYPE.accel, Math.random() * 2 * Math.PI);
  var radius = ROCKTYPE.radius;

  return {
    type: 'ROCK',
    rocktype,
    pos,
    spd,
    rot: 0,
    rotspd,
    radius,
    shape: Shapes.makeRock(ROCKTYPE.sides, radius),
  };
}

exports.splitRock = function(rock) {
  var pos = () => deepCopy(rock.pos);
  switch(rock.rocktype) {
    case 0:
      return [generateRock(2, pos()), generateRock(1, pos())];
    case 1:
      return [generateRock(2, pos()), generateRock(2, pos())];
    default:
      return EMPTY_LIST;
  }
}
