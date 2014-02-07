var Rx = require('Rx');
var Point = require('../Point');
var Shapes = require('../Shapes');
var _ = require('underscore');
var deepCopy = require('utils').deepCopy;
var xy = Point.xy;

var MAXROCKS = 4;
var EMPTY_LIST = [];

var splitRockSubject = null;
exports.getRockStream = function(simulation) {
  splitRockSubject = new Rx.Subject();

  return simulation.sample(2500)
    .filter(state => Math.random() < (MAXROCKS-state.rocks.length)/MAXROCKS)
    .map(() => generateRock(0, xy(
      Math.random() * Point.screenSize.x,
      Math.random() * Point.screenSize.y)))
    .merge(splitRockSubject);
}

var ROCK_TYPES = [
  {
    maxRot : 0.002,
    accel : xy(0.03, 0),
    radius: 20,
    sides: 10,
  },
  {
    maxRot : 0.004,
    accel : xy(0.05, 0),
    radius: 10,
    sides: 8,
  },
  {
    maxRot : 0.006,
    accel : xy(0.07, 0),
    radius: 4,
    sides: 6,
  },
];

function generateRock(rocktype, pos) {
  var ROCKTYPE = ROCK_TYPES[rocktype];

  var rotspd = ROCKTYPE.maxRot * 2 * Math.random() - ROCKTYPE.maxRot;
  var spd = Point.rotate(ROCKTYPE.accel, Math.random() * 2 * Math.PI);
  var radius = ROCKTYPE.radius;

  return {
    type: 'ROCK',
    rocktype,
    pos,
    spd,
    rot: 0,
    rotspd,
    radius,
    shape: Shapes.makeRock(ROCKTYPE.sides, radius),
    id: "" + Math.random(),
  };
}

var seenRocks = {};
exports.splitRock = function(rock) {
  _.defer(function() {
    if (seenRocks[rock.id]) return;
    var moreRocks = EMPTY_LIST;
    var pos = () => deepCopy(rock.pos);
    switch(rock.rocktype) {
      case 0:
        moreRocks = [generateRock(2, pos()), generateRock(1, pos())];
        break;
      case 1:
        moreRocks = [generateRock(2, pos()), generateRock(2, pos())];
        break;
    }

    if (!moreRocks.length) return;
    seenRocks[rock.id] = true;
    moreRocks.forEach(rock => {
      splitRockSubject.onNext(rock);
    });
  });
}

