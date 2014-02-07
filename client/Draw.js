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
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(rock.rot);
  ctx.beginPath();
  drawShape(ctx, rock.shape);
  ctx.stroke();
  ctx.restore();
}

function drawShape(ctx, shape) {
  var start = _.last(shape); 
  ctx.moveTo(start.x, start.y);

  _.forEach(shape, function(pt) {
    ctx.lineTo(pt.x, pt.y);
  });
}

drawRocks = function(ctx, rocks) {
  ctx.strokeStyle = '#FFF'
  ctx.lineWidth = 1;
  rocks.forEach(rock => {
    _drawRock(ctx, rock, rock.pos);
    var otherSide = Point.foldOnScreen(rock.pos);

    if (otherSide) {
      _drawRock(ctx, rock, otherSide);
    }

  });
}

drawShip = function(ctx, ship) {
  _drawFill(ctx, ship.pos, ship.rot, Shapes.ship);
  var otherSide = Point.foldOnScreen(ship.pos);

  if (otherSide) {
    _drawFill(ctx, otherSide, ship.rot, Shapes.ship);
  }
}

drawShots = function(ctx, shotList) {
  shotList.forEach(function(shot) {
    var x = shot.pos.x;
    var y = shot.pos.y;

    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI*2, true); 
    ctx.closePath();
    ctx.fill();
  });
}

drawCollisions = function(ctx, collisions) {
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

module.exports = function (ctx, renderInfo) {
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, Point.screenSize.x, Point.screenSize.y);

  ctx.fillStyle = '#FFF';
  if (renderInfo.rocks.length) drawRocks(ctx, renderInfo.rocks);

  ctx.fillStyle = '#0FF';
  drawShip(ctx, renderInfo.ships.a);
  ctx.fillStyle = '#F0F';
  drawShip(ctx, renderInfo.ships.b);

  ctx.fillStyle = '#0FF';
  var shotsA = renderInfo.ships.a.shots;
  if (shotsA.length) drawShots(ctx, shotsA);

  var shotsB = renderInfo.ships.b.shots;
  ctx.fillStyle = '#F0F';
  if (shotsB.length) drawShots(ctx, shotsB);


  if (renderInfo.collisions.length) {
    drawCollisions(ctx, renderInfo.collisions);
  }

  if (renderInfo.countdown != null) {
    ctx.fillStyle = '#FFF';
    ctx.moveTo(200,200);
    var basesize = 200;
    var t = renderInfo.countdown;
    var tSec = t/1000;
    var tSecInt = Math.floor(tSec);
    var tNano = tSec - tSecInt;

    var secPercent = 1 -tNano;
    ctx.globalAlpha = tNano;

    var fontSize = 80 + Math.floor(secPercent * basesize);
    ctx.font=fontSize + "px Courier";
    ctx.fillText(tSecInt+1, 200, 200);
  }
}

