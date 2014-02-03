var Point = require('./Point');
var _ = require('underscore');
var xy = Point.xy;

var shipPoly = [
  xy( 15,  0),
  xy(-15, 10),
  xy( -4,  0),
  xy(-15,-10),
];


function draw(ctx, ship) {
  _draw(ctx, ship.pos, ship.rot);
  var otherSide = Point.foldOnScreen(ship.pos);

  if (otherSide) {
    _draw(ctx, otherSide, ship.rot);
  }
}

var DrawStart = _.last(shipPoly); 
function _draw(ctx, pos, r) {
  ctx.save();
  ctx.beginPath();

  ctx.translate(pos.x, pos.y);
  ctx.rotate(r);
  ctx.moveTo(DrawStart.x, DrawStart.y);

  _.forEach(shipPoly, function(pt) {
    ctx.lineTo(pt.x, pt.y);
  });

  ctx.fill();
  ctx.restore();
}

var rotSpeed = 0.003;
var thrustAccel = xy(0.0004, 0);

// Mutates ship
exports.inputTick = function(ship, keys) {
  if (keys.left)  ship.rot -= rotSpeed;
  if (keys.right) ship.rot += rotSpeed;

  var pos = ship.pos;
  var spd = ship.spd;
  pos.x += spd.x;
  pos.y += spd.y;

  if (keys.thrust) {
    spd.x += Point.rotateX(thrustAccel, ship.rot);
    spd.y += Point.rotateY(thrustAccel, ship.rot);
    ship.spd = limitSpeed(spd);
  }


  if (pos.x < 0) pos.x += Point.screenSize.x;
  if (pos.x > Point.screenSize.x) pos.x -= Point.screenSize.x;
  if (pos.y < 0) pos.y += Point.screenSize.y;
  if (pos.y > Point.screenSize.y) pos.y -= Point.screenSize.y;

  return ship;
}

var maxSpd = xy(0.2, 0);
var maxSpdHyp = maxSpd.x * maxSpd.x;
function limitSpeed(spd) {
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

exports.limitSpeed = limitSpeed;
exports.nose = shipPoly[0];
exports.draw = draw;

var boundingRadius = 15;
var EMPTY_LIST = [];
var checkResult = {collisions: null, shots: null};

exports.checkShots = function(ship, shots) {
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
