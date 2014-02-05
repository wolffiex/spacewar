var Point = require('./Point');
var xy = Point.xy;

var ship = [
  xy( 15,  0),
  xy(-15, 10),
  xy( -4,  0),
  xy(-15,-10),
];

function makeRock(jags, dist) {
  var shape = [];
  var r = Math.PI * 2 /jags;
  for (var i=0; i < jags; i++) {
    shape.push(
      Point.rotate(xy(dist + Math.random() * dist/2, 0), r*i)
    );
  }

  return shape;
}
exports.ship = ship;
exports.shipNose = ship[0];
exports.makeRock = makeRock;

