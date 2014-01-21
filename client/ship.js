var Point = require('./Point');
var _ = require('../common/underscore');
var Pt = Point.Pt;

var shipPoly = [
  Pt( 15,  0),
  Pt(-15, 10),
  Pt( -4,  0),
  Pt(-15,-10),
];


function draw(ctx, ship) {
  _draw(ctx, ship.pos, ship.rot);
  var otherSide = Point.foldOnScreen(ship.pos);

  if (otherSide) {
    _draw(ctx, otherSide, ship.rot);
  }
}

function _draw(ctx, pos, r) {
  var pts = shipPoly.map(function(pt) {
    var newPt = Point.rotate(pt, r);
    // don't make an extra array by calling translatePt
    newPt.x += pos.x
    newPt.y += pos.y

    return newPt;
  });

  ctx.beginPath();

  var start = _.last(pts); 
  ctx.moveTo(start.x, start.y);

  _.forEach(pts, function(pt) {
    ctx.lineTo(pt.x, pt.y);
  });

  ctx.fill();
}

var rotSpeed = 0.003;
var thrustAccel = Pt(0.0002, 0);
var maxSpd = Pt(0.4, 0);
var maxSpdHyp = maxSpd.x * maxSpd.x;

// Mutates ship
exports.inputTick = function(ship, keys) {
  if (keys.left)  ship.rot -= rotSpeed;
  if (keys.right) ship.rot += rotSpeed;

  var pos = ship.pos;
  pos.x += ship.spd.x;
  pos.y += ship.spd.y;

  if (keys.thrust) {
    var spdX = ship.spd.x;
    var spdY = ship.spd.y;
    spdX += Point.rotateX(thrustAccel, ship.rot);
    spdY += Point.rotateY(thrustAccel, ship.rot);

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

      spdX = newSpdX;
      spdY = newSpdY;
    }

    ship.spd.x = spdX;
    ship.spd.y = spdY;
  }

  if (pos.x < 0) pos.x += Point.screenSize.x;
  if (pos.x > Point.screenSize.x) pos.x -= Point.screenSize.x;
  if (pos.y < 0) pos.y += Point.screenSize.y;
  if (pos.y > Point.screenSize.y) pos.y -= Point.screenSize.y;
  return ship;
}

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
