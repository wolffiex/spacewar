var Rx = require('Rx');
var _ = require('underscore');

var Ship = require('./Ship');
var Point = require('./Point');
var Keys = require('./Keys');
var Shots = require('./Shots');
var Simulation = require('./Simulation');
var notEmpty = require('utils').notEmpty;

var xy = Point.xy;

var tGameStart = null;

function initGame(canvas){
  var ctx = canvas.getContext('2d');

  var socket = RxWebSocket("ws://localhost:3001");

  var gameInfo = getGameInfo(socket);

  var keyInput = Keys.getStream(document)
    .combineLatest(gameInfo, (input, game) => {
      var t = Date.now() - tGameStart;
      if (t<0) return null;

      input.t = t;
      input.k = game.k;
      return input;
    })
    .filter(notEmpty)
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
    if (tGameStart == null) return;
    var t = Date.now() - tGameStart;
    if (t >=0) simulation.update(t);
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

  requestAnimationFrame(GameRenderer);
}

global.initGame = initGame;

var RxWebSocket = require('RxWebSocket');

//var Msg = (key, value) => {key, value};
var Msg = (m, d=null) => ({m, d});
Msg.filter = (key) => function(msg) {
  return msg.m == key;
};

var INTRO_TIME = 5000;
function getGameInfo(socket) {
  // INPUT messages are not part of the game setup
  // but this is really just an optimization
  var game = socket.filter(msg => msg.m != 'INPUT');

  var recvMsg = k => game.filter(msg => msg.m == k);

  var player = recvMsg('START').map(msg =>msg.d.k);
  // Player a: Send PING -> Recv PONG -> Send GO
  var sendPing = player.filter(k => k == 'a')
    // Delay allows game time to initialize so timing doesn't get messed up
    .delay(100) 
    .map( () => Msg('PING', Date.now()) ).share();

  // Player b: Recv PING -> SEND PONG -> Recv GO
  var sendPong = recvMsg('PING')
    .map(msg => Msg('PONG', {pong: Date.now(), ping: msg.d}) )
    .share();

  var sendGo = recvMsg('PONG')
    .map(msg => {
      var now = Date.now();
      var latency = now - msg.d.ping;
      var pong = msg.d.pong;

      return Msg('GO', {
        a : now + INTRO_TIME,
        b : Math.round(pong + latency + INTRO_TIME)});
    }).share();

  // Outbound stream to socket
  sendPing.merge(sendPong, sendGo).subscribe(socket);

  // Game info
  var goMsg = sendGo.merge(recvMsg('GO'));
  return player.zip(goMsg, function(k, msg) {
    tGameStart = msg.d[k];
    console.log('start', msg.d, k, tGameStart, Date.now())
    return {
      k : k,
      t : msg.d[k],
    };
  });
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
