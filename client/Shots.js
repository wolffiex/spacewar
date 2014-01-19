var Point = require('./Point');
var Ship = require('./Ship');
var _ = require('./underscore');

var SHOTS = {
  max : 8,
  delay: 400,
  life: 3000,
  accel: {x: 0.2, y: 0},
};

// Mutates shots
function cull(shots) {
  return 
}

exports.tick = function(shots) {
  var keepAll = true;
  for (var i=0; i < shots.length; i++) {
    var shot = shots[i];
    if (shot.age++ >= SHOTS.life) keepAll = false;

    var x = shot.pos.x;
    var y = shot.pos.y;

    x += shot.spd.x;
    y += shot.spd.y;

    var ssX = Point.screenSize.x;
    var ssY = Point.screenSize.y;

    if (x < 0) x += ssX;
    if (y < 0) y += ssY;
    if (x > ssX) x -= ssX;
    if (y > ssY) y -= ssY;

    shot.pos.x = x;
    shot.pos.y = y;
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
    shots.push({
      age: 0,
      pos : {
        x : ship.pos.x + Point.rotateX(Ship.nose, r),
        y : ship.pos.y + Point.rotateY(Ship.nose, r),
      },
      spd : {
        x : ship.spd.x + Point.rotateX(SHOTS.accel, r),
        y : ship.spd.y + Point.rotateY(SHOTS.accel, r),
      },
    });
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
  var lastAge = shots.length ? _.last(shots).age : 0;
  if (lastAge > SHOTS.delay ) shots = tryFire(ship);
  return shots;
}

exports.draw = function(ctx, shotList) {
  shotList.forEach(function(shot) {

    var x = shot.pos.x;
    var y = shot.pos.y;

    x = x % Point.screenSize.x;
    y = y % Point.screenSize.y;
    if (x < 0) x += Point.screenSize.x;
    if (y < 0) y += Point.screenSize.y;

    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI*2, true); 
    ctx.closePath();
    ctx.fill();
  });
}

