'use strict';

/**
 * Timer controller for capturing and cleaning up setInterval/setTimeout calls.
 * Examples often use setInterval for continuous updates which need cleanup.
 */

class TimerController {
  constructor () {
    this.intervals = [];
    this.timeouts = [];
    this.originalSetInterval = global.setInterval;
    this.originalSetTimeout = global.setTimeout;
    this.originalClearInterval = global.clearInterval;
    this.originalClearTimeout = global.clearTimeout;
  }

  install () {
    const self = this;

    global.setInterval = function (fn, ms, ...args) {
      const id = self.originalSetInterval.call(global, fn, ms, ...args);
      self.intervals.push(id);
      return id;
    };

    global.setTimeout = function (fn, ms, ...args) {
      const id = self.originalSetTimeout.call(global, fn, ms, ...args);
      self.timeouts.push(id);
      return id;
    };

    global.clearInterval = function (id) {
      const idx = self.intervals.indexOf(id);
      if (idx > -1) self.intervals.splice(idx, 1);
      return self.originalClearInterval.call(global, id);
    };

    global.clearTimeout = function (id) {
      const idx = self.timeouts.indexOf(id);
      if (idx > -1) self.timeouts.splice(idx, 1);
      return self.originalClearTimeout.call(global, id);
    };
  }

  cleanup () {
    this.intervals.forEach(id => this.originalClearInterval.call(global, id));
    this.timeouts.forEach(id => this.originalClearTimeout.call(global, id));
    this.intervals = [];
    this.timeouts = [];
  }

  restore () {
    global.setInterval = this.originalSetInterval;
    global.setTimeout = this.originalSetTimeout;
    global.clearInterval = this.originalClearInterval;
    global.clearTimeout = this.originalClearTimeout;
  }
}

module.exports = TimerController;
