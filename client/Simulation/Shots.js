var Point = require('../Point');
var Shapes = require('../Shapes');
var _ = require('underscore');
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

var boundingRadius = 15;
var EMPTY_LIST = [];
exports.shipCollisions = function(ship, shots) {
  // For now, let's pretend shots have no dimension,
  // they're just a point

  var collisions = EMPTY_LIST;
  for (var i=0; i < shots.length; i++) {
    var shot = shots[i];
    // First check bounding box
    if (Math.abs(ship.pos.x - shot.pos.x) < boundingRadius) {
      if (Math.abs(ship.pos.y - shot.pos.y) < boundingRadius) {
        // Now need to do detailed check
        collisions = collisions.concat(i);
      }
    }
  }

  return collisions;
}
