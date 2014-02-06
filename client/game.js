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

function combineKeysAndGame(keysInfo, game) {
  return keysInfo.map((input) => {
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
  var gameInfo = getGameInfo(socket);

  var timer = new Rx.Subject();
  var updateTimer = () => {timer.onNext(Date.now())};

  var renderInfo = {
    ships : Simulation.initialShips,
    collisions : [],
    countdown: null,
    rocks: [],
  };

  function render() {
    draw(ctx, renderInfo);
    requestAnimationFrame(render);
    _.defer(updateTimer);
  };

  requestAnimationFrame(render);

  // Once the preamble is done, setup the game. This could be part of the
  // reactive pipeline, but the code is a little simpler if it's just written in
  // a closure. In this case, we use the output of the pipeline for the steam of
  // messages bound for the other client
  gameInfo.flatMap(function(game) {
    // This is either a stream of rocks if player="a" or empty
    // It's a circular dependency for the game, so we need to
    // use a subject here and wire it up below
    var rockSubject = new Rx.Subject();

    // Mark key input with player and relative game time
    var keyInput = combineKeysAndGame(
      Keys.getStream(doc).merge(rockSubject), game);

    var inputStream = keyInput
      .merge(socket.filter(Msg.filter('INPUT')).map(Msg.value));
    
    var gameTimer = timer.map(update => update - game.t);

    var updater = gameTimer.filter(t => t >= 0 );

    var countdown = gameTimer.takeUntil(updater).map(t => t * -1);

    var simulation = Simulation(inputStream, updater);

    if (game.player == 'a') {
      getRockStream(simulation).subscribe(rockSubject);
    }

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


    // Send local input to other player
    return keyInput.map(k=>Msg('INPUT', k));
  }).subscribe(socket);


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

function getRockStream(simulation) {
  return simulation.sample(2500)
    .filter(state => Math.random() < (10-state.rocks.length)/10)
    .map(state => {
    return {
      type: 'ROCK',
      pos: xy(300, 300),
      rot: 1,
      rotspd: .001,
      spd: xy(.02, .01),
      shape: Shapes.makeRock(8, 20),
    }});
}

global.initGame = initGame;


var INTRO_TIME = 600;
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
