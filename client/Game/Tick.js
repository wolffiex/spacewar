var Point = require('../Point');
var _ = require('underscore');
var xy = Point.xy;

exports.rocks = function(rocks) {
  rocks.forEach(rock => {
    updatePosWithSpd(rock);
    rock.rot += rock.rotspd;
  });

  return rocks;
}

var rotSpeed = 0.003;
var thrustAccel = xy(0.0004, 0);
exports.ship = function(ship, keys) {
  updatePosWithSpd(ship);

  if (keys.left)  ship.rot -= rotSpeed;
  if (keys.right) ship.rot += rotSpeed;

  if (keys.thrust) {
    var spd = ship.spd;
    spd.x += Point.rotateX(thrustAccel, ship.rot);
    spd.y += Point.rotateY(thrustAccel, ship.rot);
    ship.spd = limitShipSpeed(spd);
  }

  return ship;
}

var SHOT_LIFE = 1600;
exports.shots = function(shots) {
  var keepAll = true;
  shots.forEach(function(shot) {
    updatePosWithSpd(shot);
    if (shot.age++ >= SHOT_LIFE) keepAll = false;
  });

  return keepAll ? shots : _.filter(shots, function(shot) {
    return shot.age < SHOT_LIFE;
  });
}

var COLLISION_LIFE = 400;
exports.collisions = function (collisions) {
  var keepAll = true;
  for (var i=0; i < collisions.length; i++) {
    var c = collisions[i];
    if (++c.age > COLLISION_LIFE) keepAll = false;
    updatePosWithSpd(c);
  }

  return keepAll ? collisions : _.filter(collisions, function(c) {
    return c.age < COLLISION_LIFE;
  });

}

var maxSpd = xy(0.2, 0);
var maxSpdHyp = maxSpd.x * maxSpd.x;
function limitShipSpeed(spd) {
  var spdX = spd.x;
  var spdY = spd.y;

  // Limit speed by scaling the speed vector if
  // necessary
  if (spdX*spdX + spdY*spdY > maxSpdHyp) {
    var theta = Math.atan(spdY/spdX);

    var newSpdX = Point.rotateX(maxSpd, theta);
    var newSpdY = Point.rotateY(maxSpd, theta);

    if (spdX * newSpdX < 0 ) {
      newSpdX *= -1;
    }

    if (spdY * newSpdY < 0 ) {
      newSpdY *= -1;
    }

    return xy(newSpdX, newSpdY);
  }

  return spd;
}
exports.limitShipSpeed = limitShipSpeed;

var PtSSX = Point.screenSize.x;
var PtSSY = Point.screenSize.y;
function updatePosWithSpd(obj) {
  var pos = obj.pos;
  pos.x += obj.spd.x;
  pos.y += obj.spd.y;
  if (pos.x < 0) pos.x += PtSSX;
  if (pos.y < 0) pos.y += PtSSY;
  if (pos.x > PtSSX) pos.x -= PtSSX;
  if (pos.y > PtSSY) pos.y -= PtSSY;
}
