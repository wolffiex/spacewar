var Rx = require('Rx');
var _ = require('underscore');

var Ship = require('./Ship');
var Point = require('./Point');
var Keys = require('./Keys');
var Shots = require('./Shots');
var Simulation = require('./Simulation');

var xy = Point.xy;

var GameRenderer = null;
global.tGameStart = null;

function startGame(t) {
  if (!GameRenderer) throw "Game didn't init"
  tGameStart = t;

  requestAnimationFrame(GameRenderer);
  return KeyInput;
}

var KeyInput = null;
var OtherInput = new Rx.Subject();
var amA = true;

function initGame(canvas){
  var ctx = canvas.getContext('2d');

  KeyInput = Keys.getStream(document).map(input => {
    input.t = Date.now() - tGameStart;
    input.k = amA ? 'a' : 'b';
    return input;
  }).share();

  OtherInput = new Rx.Subject();

  // This must syncrhonize the input stream
  var inputStreamRaw = KeyInput.merge(OtherInput);

  var inputBufferList = [{t:0}];

  var inputStream = inputStreamRaw.flatMap(input => {
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

var socket = new WebSocket("ws://localhost:3001");
socket.onopen = function (event) {
  console.log('socket is open')
};

function send(message, data) {
  socket.send(JSON.stringify({m: message, d:data}));
}

var RxWebSocket = require('RxWS').RxWebSocket;

var sock = RxWebSocket(socket);
sock.subscribe(x=>console.log('sock', x));

var pingTime;
var waitTime = 1000;
socket.onmessage = function (event) {
  var o = JSON.parse(event.data);
  //console.log('RECV', o.m, o.d);
  switch (o.m) {
    case 'START':
      var k = o.d.k; 
      amA = k == 'a';
      if (amA) _.delay(() =>{
        pingTime = Date.now();
        send('PING', null);
      }, 100);
      break;
    case 'PING':
      send('PONG', Date.now());
      break;
    case 'PONG':
      var pongTime = Date.now();
      var latency = pongTime - pingTime;
      var otherTime = o.d;
      send('GO', Math.round(otherTime + latency + waitTime));
      go(pongTime + waitTime);
      break;
    case 'GO':
      go(o.d);
      break;
    case 'INPUT':
      var d = o.d;
      if (d.t > Date.now() - tGameStart) throw "Lost sync";
      OtherInput.onNext(d);
      break;
  }
}

function go(startTime) {
  var input = startGame(Date.now());
  input.subscribe(k => send('INPUT', k));
}


