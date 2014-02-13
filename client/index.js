var Rx = require('Rx');
var _ = require('underscore');

var RxWebSocket = require('RxWebSocket');
var Renderer = require('./Renderer');
var Keys = require('./Keys');
var Game = require('./Game');
var Rocks = require('./Rocks');
var Msg = require('utils').Msg;

window.init = function (doc, canvas){
  var ctx = canvas.getContext('2d');

  var hostname = doc.location.hostname;
  var socket = RxWebSocket("ws://" + hostname + ":3001");

  // Game start time and player info
  var gameInfo = getGameInfo(socket);

  var timer = new Rx.Subject();
  timer.update = () => {timer.onNext(Date.now())};

  // This is either a stream of rocks if player="a" or empty
  // It's a circular dependency for the game simulation, so we need to use a
  // subject here and wire it up below
  var rockSubject = new Rx.Subject();

  var combineGame = snapshot(gameInfo);

  // Mark input with player and relative game time
  var localInput = combineGame(Keys.getStream(doc).merge(rockSubject),
    (game, input) => {
      var t = Date.now() - game.t;
      input.t = t;
      input.player = game.player;
      return input;
    })
    .filter(input => input.t >= 0)
    .share();

  var inputStream = localInput.merge(Msg.recv(socket)('INPUT'));
  
  var gameTimer = combineGame(timer, (game, update) => update - game.t).share();
  var updater = gameTimer.filter(t => t >= 0 );

  var simulation = Game.simulation(inputStream, updater);

  // Only player "a" makes rocks
  gameInfo.filter(game => game.player == 'a').flatMap(() => {
    return Rocks.getRockStream(simulation);
  }).subscribe(rockSubject);

  var countdown = gameTimer.takeUntil(updater).map(t => t * -1);
  var renderer = new Renderer(ctx, Game.initialShips, simulation, countdown);

  function scheduler() {
    renderer.render();
    _.defer(timer.update);
    requestAnimationFrame(scheduler);
  };

  requestAnimationFrame(scheduler);

  // Send local input to other player
  localInput.map(k => Msg('INPUT', k)).subscribe(socket);
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
  }).share();
}

var EMPTY_SNAPSHOT = {};
function snapshot(snapped) {
  var snap = EMPTY_SNAPSHOT;

  snapped.subscribe(function(value) {
    snap = value;
  });

  return function(stream, f) {
    return stream
      .filter(() => snap != EMPTY_SNAPSHOT)
      .map(value => f(snap, value));
  }
}
