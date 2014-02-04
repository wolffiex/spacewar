var Point = require('../Point');
var _ = require('underscore');
var xy = Point.xy;

exports.rocks = function(rocks) {
  rocks.forEach(rock => {
    var pos = rock.pos;
    pos.x += rock.spd.x;
    pos.y += rock.spd.y;

    rock.rot += rock.rotspd;
    if (pos.x < 0) pos.x += Point.screenSize.x;
    if (pos.x > Point.screenSize.x) pos.x -= Point.screenSize.x;
    if (pos.y < 0) pos.y += Point.screenSize.y;
    if (pos.y > Point.screenSize.y) pos.y -= Point.screenSize.y;
  });

  return rocks;
}

var rotSpeed = 0.003;
var thrustAccel = xy(0.0004, 0);
exports.ship = function(ship, keys) {
  if (keys.left)  ship.rot -= rotSpeed;
  if (keys.right) ship.rot += rotSpeed;

  var pos = ship.pos;
  var spd = ship.spd;
  pos.x += spd.x;
  pos.y += spd.y;

  if (keys.thrust) {
    spd.x += Point.rotateX(thrustAccel, ship.rot);
    spd.y += Point.rotateY(thrustAccel, ship.rot);
    ship.spd = limitShipSpeed(spd);
  }


  if (pos.x < 0) pos.x += Point.screenSize.x;
  if (pos.x > Point.screenSize.x) pos.x -= Point.screenSize.x;
  if (pos.y < 0) pos.y += Point.screenSize.y;
  if (pos.y > Point.screenSize.y) pos.y -= Point.screenSize.y;

  return ship;
}

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


var SHOT_LIFE = 1600;
exports.shots = function(shots) {
  var keepAll = true;
  for (var i=0; i < shots.length; i++) {
    var shot = shots[i];
    if (shot.age++ >= SHOT_LIFE) keepAll = false;
    shot.pos = updatePosWithSpd(shot.pos, shot.spd);
  }

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
    c.pos = updatePosWithSpd(c.pos, c.spd);
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
