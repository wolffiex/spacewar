var Point = require('./Point');
var Ship = require('./Ship');
var _ = require('../common/underscore');
var Pt = Point.Pt;

var SHOTS = {
  max : 8,
  delay: 400,
  life: 3000,
  accel: Pt(0.2, 0),
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

    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI*2, true); 
    ctx.closePath();
    ctx.fill();
  });
}

// mutates collisions
var COLLISIONS = {
  life: 400,
}

exports.tickCollisions = function (collisions) {
  var keepAll = true;
  for (var i=0; i < collisions.length; i++) {
    var c = collisions[i];
    if (c.age++ >= COLLISIONS.life) keepAll = false;
    c.pos = updatePosWithSpd(c.pos, c.spd);
  }

  return keepAll ? collisions : _.filter(collisions, function(c) {
    return c.age < COLLISIONS.life;
  });

}

exports.drawCollisions = function(ctx, collisions) {
  ctx.fillStyle = '#FFA500';
  collisions.forEach(function(c) {
    var x = c.pos.x;
    var y = c.pos.y;

    var p = c.age/COLLISIONS.life;

    ctx.globalAlpha = 1-p;
    ctx.beginPath();
    ctx.arc(x, y, p*50, 0, Math.PI*2, true); 
    ctx.closePath();
    ctx.fill();
  });

  ctx.globalAlpha = 1;
}
