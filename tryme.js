function initGame() {
  var lastTime = Date.now();
  var generator = Rx.Observable.generateWithRelativeTime(
    Date.now(), 
    constF(true),
    function(nowTime) { 
      lastTime = nowTime;
      var nowTime = Date.now();
      return nowTime;
    },
    function(nowTime) {
      var diff = nowTime - lastTime;
      //console.log(diff)
      return diff;
    },
    function() { return 10; }
  );

  var timer = generator.publish();
  var connect = timer.connect();

  timer.take(20).subscribe(function(v) {
    console.log('a', v, Date.now())
  });

  timer.take(20).subscribe(function(v) {
    console.log('b', v, Date.now())
  });
}

var constF = function(val) {
  return function() {return val};
}
