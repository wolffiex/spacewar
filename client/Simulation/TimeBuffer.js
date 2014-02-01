var deepCopy = require('utils').deepCopy;
var _ = require('underscore');

class TimeBuffer {

  constructor (initial) {
    this._buffer = [Object.freeze(initial)];
    this._last = deepCopy(initial);
  }

  isLast(t) {
    return t >= this._last.t;
  }

  getBefore(t) {
    if (!this.isLast(t)) {
      // At the very least, this._last is out of date, so we will
      // take the last state from the stateBuffer. It's possible
      // that the last entry on the stateBuffer is good, though

      var sbl = this._buffer.length;
      var idx = sbl-1;
      while(this._buffer[idx].t > t) {
        if (idx ==0) throw "Fell too far behind";
        idx--;
      }

      if (idx < sbl-1) {
        // Out of order input, need to fix up this._buffer
        this._buffer = this._buffer.slice(0, idx+1);
      }

      this._last = deepCopy(_.last(this._buffer));
    }

    return this._last;
  }

  save(o, preserve) {
    this._last = o;

    // TODO: We should also probably save state if a lot of time has passed
    // beteween state and last(stateBuffer) since it could be costly to rebuild
    // state if we get an out of order update, but for now we only preserver
    // states the caller explicitly flags
    if (preserve) {
      // save a copy of state in case we need to rewind
      this._buffer.push(Object.freeze(deepCopy(o)));
      if (this._buffer.length > 30) {
        this._buffer = this._buffer.slice(15);
      }
    }

    return o;
  }
}

module.exports = TimeBuffer;
