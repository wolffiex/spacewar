var Rx = require('Rx');
var _ = require('underscore');

var RxWebSocket = require('RxWebSocket');
var Renderer = require('./Renderer');
var Point = require('./Point');
var Keys = require('./Keys');
var Shapes = require('./Shapes');
var Rocks = require('./Rocks');
var Game = require('./Game');
var notEmpty = require('utils').notEmpty;
var Msg = require('utils').Msg;

global.init = function (doc, canvas){
  var ctx = canvas.getContext('2d');

  var hostname = doc.location.hostname;
  var socket = RxWebSocket("ws://" + hostname + ":3001");

  // Game start time and player info
  var gameInfo = getGameInfo(socket);

  var timer = new Rx.Subject();
  var updateTimer = () => {timer.onNext(Date.now())};

  var renderer = new Renderer(ctx, Game.initialShips);
  function scheduler() {
    renderer.render();
    _.defer(updateTimer);
    requestAnimationFrame(scheduler);
  };

  requestAnimationFrame(scheduler);

  // Once the preamble is done, setup the game. This could be part of the
  // reactive pipeline, but the code is a little simpler if it's just written in
  // a closure. In this case, we use the output of the pipeline for the stream of
  // messages bound for the other client
  gameInfo.flatMap(function(game) {
    // This is either a stream of rocks if player="a" or empty
    // It's a circular dependency for the game simulation, so we need to use a
    // subject here and wire it up below
    var rockSubject = new Rx.Subject();

    // Mark input with player and relative game time
    var localInput = tagPlayerAndTime(game, 
      Keys.getStream(doc).merge(rockSubject));

    var inputStream = localInput.merge(Msg.recv(socket, 'INPUT'));
    
    var gameTimer = timer.map(update => update - game.t).share();
    var updater = gameTimer.filter(t => t >= 0 );

    renderer.setCountdown(gameTimer.takeUntil(updater).map(t => t * -1));

    var simulation = Game.simulation(inputStream, updater);

    if (game.player == 'a') {
      Rocks.getRockStream(simulation).subscribe(rockSubject);
    }

    renderer.setSimulation(simulation);

    // Send local input to other player
    return localInput.map(k => Msg('INPUT', k));
  }).subscribe(socket);
}

// This corresponds to setup portion of server logic
function getGameInfo(socket) {
  var recv = Msg.recv(socket);

  // At the very start, give the client some time to settle in
  var helo = recv('HELO').delay(100).map(value => Msg('HELO', value));
  var sync = recv('SYNC').map(value => Msg('SYNC', value));

  helo.merge(sync).subscribe(socket);

  return recv('START').map(function(start) {
    // record received from server = {t: <MS to wait before start>, player}
    start.t += Date.now();
    return start;
  });
}

function tagPlayerAndTime(game, inputStream) {
  return inputStream.map((input) => {
      var t = Date.now() - game.t;
      input.t = t;
      input.player = game.player;
      return input;
    })
    .filter( input => input.t >= 0)
    .share();
}
