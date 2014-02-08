var Rx = require('Rx');
var Point = require('./Point');
var Shapes = require('./Shapes');
var _ = require('underscore');
var deepCopy = require('utils').deepCopy;
var notEmpty = require('utils').notEmpty;
var xy = Point.xy;

var MAXROCKS = 4;
var EMPTY_LIST = [];

var oldRocks = [];
exports.getRockStream = function(simulation) {

  // This is in the inner loop, so careful not
  // to make an extra observable on every frame
  var splitRocks = simulation.map(
    function (state) {
      var rocks = state.rocks;
      var r = 0; // pointer to new rocks
      var splits = EMPTY_LIST;

      oldRocks.forEach(oldRock => {
        if (r < rocks.length && oldRock.id == rocks[r].id) {
          r++;
        } else {
          splits = splits.concat(splitRock(oldRock));
        }
      });

      // Doh, can't retain this reference
      oldRocks = rocks.concat();

      return splits;
    })
    .filter(splits => splits != EMPTY_LIST)
    .flatMap(splits => Rx.Observable.fromArray(splits));

  return splitRocks.merge(
    simulation.sample(2500)
      .filter(state => Math.random() < (MAXROCKS-state.rocks.length)/MAXROCKS)
      .map(() => newRock()));
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

function newRock() {
  var pos = {
    x: Math.random() * Point.screenSize.x,
    y: Math.random() * Point.screenSize.y,
  };

  return makeRock(0, pos);

}

function makeRock(rocktype, pos) {
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

function splitRock(rock) {
  var splitTypes = EMPTY_LIST;

  switch(rock.rocktype) {
    case 0:
      splitTypes = [2,1];
    case 1:
      splitTypes = [2,2];
  }

  return _.map(splitTypes, type => makeRock(type, deepCopy(rock.pos)));
}
