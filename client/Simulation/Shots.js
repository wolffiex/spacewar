var Point = require('../Point');
var Shapes = require('../Shapes');
var _ = require('underscore');
var xy = Point.xy;

var SHOTS = {
  max : 18,
  delay: 400,
  life: 1600,
  accel: xy(0.2, 0),
};

// mutates pos
var PtSSX = Point.screenSize.x;
var PtSSY = Point.screenSize.y;
function updatePosWithSpd(pos, spd) {
  var x = pos.x;
  var y = pos.y;

  x += spd.x;
  y += spd.y;

  if (x < 0) x += PtSSX;
  if (y < 0) y += PtSSY;
  if (x > PtSSX) x -= PtSSX;
  if (y > PtSSY) y -= PtSSY;

  pos.x = x;
  pos.y = y;
  return pos;
}

exports.tickShots = function(shots) {
  var keepAll = true;
  for (var i=0; i < shots.length; i++) {
    var shot = shots[i];
    if (shot.age++ >= SHOTS.life) keepAll = false;
    shot.pos = updatePosWithSpd(shot.pos, shot.spd);
  }

  return keepAll ? shots : _.filter(shots, function(shot) {
    return shot.age < SHOTS.life;
  });
}

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

// mutates collisions
var COLLISIONS = {
  life: 400,
}

exports.tickCollisions = function (collisions) {
  var keepAll = true;
  for (var i=0; i < collisions.length; i++) {
    var c = collisions[i];
    if (++c.age > COLLISIONS.life) keepAll = false;
    c.pos = updatePosWithSpd(c.pos, c.spd);
  }

  return keepAll ? collisions : _.filter(collisions, function(c) {
    return c.age < COLLISIONS.life;
  });

}
