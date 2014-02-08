var Point = require('../Point');
var Shapes = require('../Shapes');
var _ = require('underscore');
var shipBoundingRadius = 15;

exports.shipCollisions = function(ship, shots) {
  return getShotCollisions(shots, ship.pos, Shapes.ship, shipBoundingRadius);
}

var EMPTY_LIST = [];
exports.rockCollisions = function(shots, rocks) {
  var collisions = EMPTY_LIST;
  if (shots.length) {
    for (var i=0; i < rocks.length; i++) {
      var rock = rocks[i];
      var nextCollisions = 
        getShotCollisions(shots, rock.pos, rock.shape, rock.radius);

      if (nextCollisions.length) {
        collisions = collisions.concat(
          _.map(nextCollisions, (idx) => ({
            rock: i,
            shot: idx,
          }))
        );
      }
    }
  }
  return collisions;
}

// For now, let's pretend shots have no dimension,
// they're just a point
function getShotCollisions(shots, pos, shape, bounding) {
  var collisions = EMPTY_LIST;
  for (var i=0; i < shots.length; i++) {
    var shot = shots[i];

    // First check bounding box
    if (Math.abs(pos.x - shot.pos.x) < bounding) {
      if (Math.abs(pos.y - shot.pos.y) < bounding) {
        // Now need to do detailed check
        collisions = collisions.concat(i);
      }
    }
  }

  return collisions;
}
