var Keys = require('../Keys');
var xy = require('../Point').xy;
var _ = require('underscore');

var t = 0;

var initialKeys = _.reduce(Keys.actions, (o, action) =>{
  o[action] = false;
  return o;
}, {});

var keys = {a: initialKeys, b: initialKeys};
var collisions = [];

var shipA = {
  pos: xy(100, 100),
  spd: xy(0, 0),
  rot: Math.PI,
  shots: [],
};

var shipB = {
  pos: xy(200, 200),
  spd: xy(0, 0),
  rot: 0,
  shots: [],
};

var ships = {a: shipA, b: shipB}

module.exports = Object.freeze({t, keys, collisions, ships});
