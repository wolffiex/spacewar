var Point = require('./Point');
var _ = require('./underscore');

var shipPoly = [
  {x:   15, y: 0},
  {x:  -15, y:  10},
  {x:   -4, y:   0},
  {x:  -15, y:  -10},
];


function draw(ctx, pos, r) {
  var ship = shipPoly.map(function(pt) {
    var newPt = Point.rotate(pt, r);
    // don't make an extra array by calling translatePt
    newPt.x += pos.x
    newPt.y += pos.y

    return newPt;
  });

  ctx.fillStyle = '#F00';
  ctx.beginPath();

  var start = _.last(ship); 
  ctx.moveTo(start.x, start.y);

  _.forEach(ship, function(pt) {
    ctx.lineTo(pt.x, pt.y);
  });

  ctx.fill();
}

var rotSpeed = 0.003;
var thrustAccel = {x: 0.0002, y: 0};
var maxSpd = {x:0.4, y:0};
var maxSpdHyp = maxSpd.x * maxSpd.x;
function applyInput(oldShip, input) {
  var dt = input.t - oldShip.t;
  if (dt < 0) throw "Reverse time for input";
  var rot = oldShip.rot;
  var pos = oldShip.pos;
  var spd = oldShip.spd;

  if (input.k.thrust) {
    // It might be better to express this as continuous function rather than a
    // discrete simulation, but I suck at math
    var spdX = spd.x;
    var spdY = spd.y;

    var posX = pos.x;
    var posY = pos.y;


    // For every millisecond, we're just going to simulate
    // what happened
    for (var i = 0; i  < dt; i++) {
      if (input.k.left)  rot -= rotSpeed;
      if (input.k.right) rot += rotSpeed;

      posX += spdX;
      posY += spdY;

      spdX += Point.rotateX(thrustAccel, rot);
      spdY += Point.rotateY(thrustAccel, rot);

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
    }

    spd = {x: spdX, y: spdY};
    pos = {x: posX, y: posY};
  } else {
    // When the thrusters are off, the continuous
    // function is easy
    if (input.k.left)  rot -= dt*rotSpeed;
    if (input.k.right) rot += dt*rotSpeed;
    
    pos = {
      x: oldShip.pos.x + dt * oldShip.spd.x,
      y: oldShip.pos.y + dt * oldShip.spd.y,
    };

  }

  // Screen wrapping
  if (pos.x < 0) pos.x += Point.screenSize.x;
  if (pos.x > Point.screenSize.x) pos.x -= Point.screenSize.x;
  if (pos.y < 0) pos.y += Point.screenSize.y;
  if (pos.y > Point.screenSize.y) pos.y -= Point.screenSize.y;

  return {
    pos: pos,
    rot: rot,
    spd: spd,
    t: input.t,
  }
}

exports.nose = shipPoly[0];
exports.draw = draw;
exports.applyInput = applyInput;

// This mutatates the shp data!
exports.inputTick = function(ship, keys) {
  if (keys.left)  ship.rot -= rotSpeed;
  if (keys.right) ship.rot += rotSpeed;

  ship.pos.x += ship.spd.x;
  ship.pos.y += ship.spd.y;

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
  return ship;
}
