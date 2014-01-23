var Keys = require('../Keys');
var Pt = require('../Point').Pt;
var _ = require('../../common/underscore');

var t = 0;

var initialKeys = _.reduce(Keys.actions, (o, action) =>{
  o[action] = false;
  return o;
}, {});

var keys = {a: initialKeys, b: initialKeys};
var collisions = [];

var shipA = {
  pos: Pt(100, 100),
  spd: Pt(0, 0),
  rot: Math.PI,
  shots: [],
};

var shipB = {
  pos: Pt(200, 200),
  spd: Pt(0, 0),
  rot: 0,
  shots: [],
};

var ships = {a: shipA, b: shipB}

module.exports = Object.freeze({t, keys, collisions, ships});
