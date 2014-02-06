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
exports.start = function(ship) {
  return tryFire(ship);
}

// Mutates ship.shots
exports.repeat = function(ship) {
  var shots = ship.shots;
  var lastAge = shots.length ? _.last(shots).age : Infinity;
  if (lastAge > SHOTS.delay ) shots = tryFire(ship);
  return shots;
}


