var Point = require('./Point');
var xy = Point.xy;

var ship = [
  xy( 15,  0),
  xy(-15, 10),
  xy( -4,  0),
  xy(-15,-10),
];

exports.ship = ship;
exports.shipNose = ship[0];
