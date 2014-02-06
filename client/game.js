var Rx = require('Rx');
var _ = require('underscore');

var RxWebSocket = require('RxWebSocket');
var Draw = require('./Draw');
var Point = require('./Point');
var Keys = require('./Keys');
var Shapes = require('./Shapes');
var Simulation = require('./Simulation');
var notEmpty = require('utils').notEmpty;
var Msg = require('utils').Msg;

var xy = Point.xy;

function combineKeysAndGame(keysInfo, gameInfo) {
  return keysInfo
    .combineLatest(gameInfo, (input, game) => {
      var t = Date.now() - game.t;
      if (t<0) return null;

      input.t = t;
      input.player = game.player;
      return input;
    })
    .filter(notEmpty)
    .share();
}

function initGame(doc, canvas){
  var ctx = canvas.getContext('2d');

  var hostname = doc.location.hostname;
  var socket = RxWebSocket("ws://" + hostname + ":3001");

  // Game start and player info
  // TODO: Maybe this should be "game" and be a closure
  var gameInfo = getGameInfo(socket);

  // Mark key input with player and relative game time
  var keyInput = combineKeysAndGame(Keys.getStream(doc), gameInfo);

  // Send local input to other player
  keyInput.map(k=>Msg('INPUT', k)).subscribe(socket);

  
  var rockSubject = new Rx.Subject();

  var inputStream = keyInput
    .merge(socket.filter(Msg.filter('INPUT')).map(Msg.value))
    .merge(rockSubject);
  
  var timer = new Rx.Subject();

  function updateTimer() {
    timer.onNext(Date.now());
  }

  var gameTime = timer.combineLatest(gameInfo, 
    (update, game) => update - game.t);

  var updater = gameTime.filter(t => t >= 0 );

  var countdown = gameTime.takeUntil(updater).map(t => t * -1);

  var simulation = Simulation(inputStream, updater);

  getRockStream(gameInfo, simulation, socket).subscribe(rockSubject);

  var renderInfo = {
    ships : Simulation.initialShips,
    collisions : [],
    countdown: null,
    rocks: [],
  };

  simulation.subscribe(state => {
    renderInfo.ships = state.ships;
    renderInfo.collisions = state.collisions;
    renderInfo.rocks = state.rocks;
  });

  countdown.subscribe(
    t => { renderInfo.countdown = t},
    () => { console.error('Countdown error')},
    () => { renderInfo.countdown = null},
  );

  function render() {
    draw(ctx, renderInfo);
    requestAnimationFrame(render);
    _.defer(updateTimer);
  };

  requestAnimationFrame(render);
}

function draw(ctx, renderInfo) {
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, Point.screenSize.x, Point.screenSize.y);

  ctx.fillStyle = '#FFF';
  if (renderInfo.rocks.length) Draw.rocks(ctx, renderInfo.rocks);

  ctx.fillStyle = '#0FF';
  Draw.ship(ctx, renderInfo.ships.a);
  ctx.fillStyle = '#F0F';
  Draw.ship(ctx, renderInfo.ships.b);

  ctx.fillStyle = '#0FF';
  var shotsA = renderInfo.ships.a.shots;
  if (shotsA.length) Draw.shots(ctx, shotsA);

  var shotsB = renderInfo.ships.b.shots;
  ctx.fillStyle = '#F0F';
  if (shotsB.length) Draw.shots(ctx, shotsB);


  if (renderInfo.collisions.length) {
    Draw.collisions(ctx, renderInfo.collisions);
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

function getRockStream(gameInfo, simulation, socket) {
  return gameInfo.flatMap(function (game) {
    if (game.player == 'a') {
      // Player a makes rocks
      var stream = Rx.Observable.fromArray([{
        type: 'ROCK',
        pos: xy(300, 300),
        rot: 1,
        rotspd: .001,
        spd: xy(.02, .01),
        t: 0,
        shape: Shapes.makeRock(8, 20),
      }]);

      return stream

    } else {
      // Player b receives rocks
      return Rx.Observable.empty();
    }
  });
}

global.initGame = initGame;


var INTRO_TIME = 300;
// This tries to synchronize time between the players
function getGameInfo(socket) {
  // INPUT messages are not part of the game setup
  // but this is really just an optimization
  var game = socket.filter(msg => msg.key != 'INPUT').share();

  var recvMsg = k => game.filter(Msg.filter(k));

  var player = recvMsg('START').map(msg =>msg.value.player);
  // Player a: Send PING -> Recv PONG -> Send GO
  var sendPing = player.filter(p => p == 'a')
    // Delay allows game time to initialize so timing doesn't get messed up
    .delay(100) 
    .map( () => Msg('PING', Date.now()) ).share();

  // Player b: Recv PING -> SEND PONG -> Recv GO
  var sendPong = recvMsg('PING')
    .map(msg => Msg('PONG', {pong: Date.now(), ping: msg.value}) )
    .share();

  var sendGo = recvMsg('PONG')
    .map(msg => {
      var now = Date.now();
      var latency = now - msg.value.ping;
      var pong = msg.value.pong;

      return Msg('GO', {
        a : now + INTRO_TIME,
        b : Math.round(pong + INTRO_TIME - latency)});
    }).share();

  // Outbound stream to socket
  sendPing.merge(sendPong).merge(sendGo).subscribe(socket);

  // Game info
  var goMsg = sendGo.merge(recvMsg('GO'));

  return player.zip(goMsg, function(p, msg) {
    return {
      player : p,
      t : msg.value[p],
    };
  }).share();
}
