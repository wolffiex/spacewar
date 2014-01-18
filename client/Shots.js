var Point = require('./Point');
var Ship = require('./Ship');
var _ = require('./underscore');

var SHOTS = {
  max : 8,
  delay: 200,
  life: 3000,
  accel: {x: 0.2, y: 0},
};

// Mutates shots
exports.doFire = function(ship, t) {
      /*
      var sT = key.t;

      var diff = t - key.t;

      var lastShotTime = t - diff % SHOTS.delay;
      */

  var shots = ship.shots;
  var lastT = shots.length ? _.last(shots).t : 0;
  if (t - lastT > SHOTS.delay && shots.length < SHOTS.max) {
    var r = ship.rot;
    shots.push({
      t: t,
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

exports.draw = function(ctx, shotList, t) {
  shotList.forEach(function(shot) {
    var dt = Date.now() - shot.t;

    var x = shot.pos.x + shot.spd.x * dt;;
    var y = shot.pos.y + shot.spd.y * dt;;
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

