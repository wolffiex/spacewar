var _ = require('underscore');

var Pt = (x,y) => ({x,y});
var screenSize = Pt(800, 400);

exports.screenSize = screenSize;

exports.rotate = function(pt, r) {
  return Pt(
    pt.x * Math.cos(r) - pt.y * Math.sin(r),
    pt.x * Math.sin(r) + pt.y * Math.cos(r));
}

exports.rotateX = function(pt, r) {
  return pt.x * Math.cos(r) - pt.y * Math.sin(r);
}

exports.rotateY = function(pt, r) {
  return pt.x * Math.sin(r) + pt.y * Math.cos(r);
}

exports.translate = function(pt, dxdy) {
  return Pt(pt.x + dxdy.x, pt.y + dxdy.y);
}


var tolerance = 20;
exports.foldOnScreen = function(pt) {
  var foldedPt = null;

  if (pt.x < tolerance) {
    foldedPt = Pt(pt.x + screenSize.x, pt.y);
  } else if (pt.x > screenSize.x - tolerance) {
    foldedPt = Pt(pt.x - screenSize.x, pt.y);
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
exports.Pt = Pt;
