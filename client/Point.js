var _ = require('./underscore');

var screenSize = {
  x: 800,
  y: 400, 
};

exports.screenSize = screenSize;

exports.rotate = function(pt, r) {
  return { 
    x: pt.x * Math.cos(r) - pt.y * Math.sin(r),
    y: pt.x * Math.sin(r) + pt.y * Math.cos(r),
  };
}

exports.rotateX = function(pt, r) {
  return pt.x * Math.cos(r) - pt.y * Math.sin(r);
}

exports.rotateY = function(pt, r) {
  return pt.x * Math.sin(r) + pt.y * Math.cos(r);
}

exports.translate = function(pt, dxdy) {
  return {
    x: pt.x + dxdy.x,
    y: pt.y + dxdy.y,
  };
}


var tolerance = 20;
exports.foldOnScreen = function(pt) {
  var foldedPt = null;

  if (pt.x < tolerance) {
    foldedPt = {x: pt.x + screenSize.x, y: pt.y};
  } else if (pt.x > screenSize.x - tolerance) {
    foldedPt = {x: pt.x - screenSize.x, y: pt.y};
  }

  if (pt.y < tolerance) {
    foldedPt = foldedPt || _.clone(pt);
    foldedPt.y = pt.y + screenSize.y
  } else if (pt.y > screenSize.y - tolerance) {
    foldedPt = foldedPt || _.clone(pt);
    foldedPt.y = pt.y - screenSize.y
  }

  return foldedPt;
}

exports.data = (x,y) => {x,y};
