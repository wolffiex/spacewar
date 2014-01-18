var Point = require('./Point');
var _ = require('./underscore');

var shipPoly = [
  {x:   15, y: 0},
  {x:  -15, y:  10},
  {x:   -4, y:   0},
  {x:  -15, y:  -10},
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
var thrustAccel = {x: 0.0002, y: 0};
var maxSpd = {x:0.4, y:0};
var maxSpdHyp = maxSpd.x * maxSpd.x;
// This mutatates the ship data!
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
