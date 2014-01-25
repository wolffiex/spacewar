var Rx = require('Rx');
var _ = require('underscore');

var Ship = require('./Ship');
var Point = require('./Point');
var Keys = require('./Keys');
var Shots = require('./Shots');
var Simulation = require('./Simulation');
var notEmpty = require('utils').notEmpty;

var xy = Point.xy;

var GameRenderer = null;
var tGameStart = null;

function startGame(t) {
  if (!GameRenderer) throw "Game didn't init"
  tGameStart = Date.now() //t;

  requestAnimationFrame(GameRenderer);
}

var amA = true;

function initGame(canvas){
  var ctx = canvas.getContext('2d');

  var socket = getSocket();

  var keyInput = Keys.getStream(document)
    .map(input => {
      input.t = Date.now() - tGameStart;
      input.k = amA ? 'a' : 'b';
      return input;
    })
    .share();

  keyInput.map(k=>Msg('INPUT', k)).subscribe(socket);

  var inputStream = bufferInput(
    keyInput.merge(
      socket.filter(Msg.filter('INPUT')).map(msg => {
        var d = msg.d;
        if (d.t > Date.now() - tGameStart) throw "Lost sync";
        return d;
      })));
  
  var simulation = new Simulation(inputStream);

  var updateSimulation = function() {
    simulation.update(Date.now() - tGameStart);
  }

  var renderInfo = {
    ships : Simulation.initialShips,
    collisions : [],
  };

  // This is optimized not to create an object
  simulation.subscribe(state => {
    if (state) {
      renderInfo.ships = state.ships;
      renderInfo.collisions = state.collisions;
    }
  });

  GameRenderer = function (time) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, Point.screenSize.x, Point.screenSize.y);

    ctx.fillStyle = '#0FF';
    Ship.draw(ctx, renderInfo.ships.a);
    ctx.fillStyle = '#F0F';
    Ship.draw(ctx, renderInfo.ships.b);

    ctx.fillStyle = '#0FF';
    var shotsA = renderInfo.ships.a.shots;
    if (shotsA.length) Shots.draw(ctx, shotsA);

    var shotsB = renderInfo.ships.b.shots;
    ctx.fillStyle = '#F0F';
    if (shotsB.length) Shots.draw(ctx, shotsB);

    if (renderInfo.collisions.length) {
      Shots.drawCollisions(ctx, renderInfo.collisions);
    }

    requestAnimationFrame(GameRenderer);
    _.defer(updateSimulation);
  };
}

global.initGame = initGame;

var RxWebSocket = require('RxWebSocket');

//var Msg = (key, value) => {key, value};
var Msg = (m, d) => ({m, d});
Msg.filter = (key) => function(msg) {
  return msg.m == key;
};

function getSocket() {
  var socket = RxWebSocket("ws://localhost:3001");

  var start = socket.filter(Msg.filter('START'))
    .delay(100)
    .map( msg => {
      var k = msg.d.k; 
      amA = k == 'a';
      pingTime = Date.now();

      return amA ? Msg('PING', null) : null;
    });

  var pingTime;
  var waitTime = 1000;

  var sync = socket.map(msg => {
    //console.log('RECV', msg.m, msg.d);
    switch (msg.m) {
      case 'PING':
        return Msg('PONG', Date.now());
      case 'PONG':
        var pongTime = Date.now();
        var latency = pongTime - pingTime;
        var otherTime = msg.d;
        startGame(pongTime + waitTime);
        return Msg('GO', Math.round(otherTime + latency + waitTime));
      case 'GO':
        startGame(msg.d);
        break;
    }

    return null;
  })

  start.merge(sync).filter(notEmpty).subscribe(socket);
  return socket;
}

function bufferInput(rawInputStream) {
  var inputBufferList = [{t:0}];
  return rawInputStream.flatMap(input => {
    var list = inputBufferList;
    var ot = _.last(list).t;

    // we need to put this at the last possible spot
    // e.g. list = {t:0}, {t:1}, {t:1}, {t:3}
    // and we receive a new {t:1}, it has to go right before t:3
    var z = list.length;
    var y = z-1;
    list.push(input);

    var needsBuffering = false;
    while(list[y].t > list[z].t) {
      needsBuffering = true;
      var tmp = list[z];
      list[z] = list[y];
      list[y] = tmp;
      y--; z--;
    }

    // TODO: Trim list

    return needsBuffering ?
      Rx.Observable.fromArray(list.slice(y+1)) :
      Rx.Observable.returnValue(input);
  });
}
