var Shapes = require('./Shapes');
var Point = require('./Point');
var _ = require('underscore');

function _drawFill(ctx, pos, r, shape) {
  ctx.save();

  ctx.translate(pos.x, pos.y);
  ctx.rotate(r);

  ctx.beginPath();
  drawShape(ctx, shape);
  ctx.fill();

  ctx.restore();
}

function _drawRock(ctx, rock, pos) {
  ctx.translate(pos.x, pos.y);
  ctx.rotate(rock.rot);
  ctx.beginPath();
  drawShape(ctx, rock.shape);
  ctx.stroke();
}

function drawShape(ctx, shape) {
  var start = _.last(shape); 
  ctx.moveTo(start.x, start.y);

  _.forEach(shape, function(pt) {
    ctx.lineTo(pt.x, pt.y);
  });
}

exports.rocks = function(ctx, rocks) {
  ctx.save();
  ctx.strokeStyle = '#FFF'
  ctx.lineWidth = 1;
  rocks.forEach(rock => {
    _drawRock(ctx, rock, rock.pos);
    var otherSide = Point.foldOnScreen(rock.pos);

    if (otherSide) {
      _drawRock(ctx, rock, otherSide);
    }

  });

  ctx.restore();
}

exports.ship = function(ctx, ship) {
  _drawFill(ctx, ship.pos, ship.rot, Shapes.ship);
  var otherSide = Point.foldOnScreen(ship.pos);

  if (otherSide) {
    _drawFill(ctx, otherSide, ship.rot, Shapes.ship);
  }
}

exports.shots = function(ctx, shotList) {
  shotList.forEach(function(shot) {
    var x = shot.pos.x;
    var y = shot.pos.y;

    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI*2, true); 
    ctx.closePath();
    ctx.fill();
  });
}

exports.collisions = function(ctx, collisions) {
  ctx.fillStyle = '#FFA500';
  collisions.forEach(function(c) {
    var x = c.pos.x;
    var y = c.pos.y;

    // FIXME: DRY this constant
    var p = c.age/400;

    ctx.globalAlpha = 1-p;
    ctx.beginPath();
    ctx.arc(x, y, p*50, 0, Math.PI*2, true); 
    ctx.closePath();
    ctx.fill();
  });

  ctx.globalAlpha = 1;
}
