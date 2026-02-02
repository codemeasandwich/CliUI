/**
 * textarea.js - textarea element for blessed
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

/**
 * Modules
 */

var unicode = require('../unicode');

var nextTick = global.setImmediate || process.nextTick.bind(process);

var Node = require('./node');
var Input = require('./input');

/**
 * Textarea
 */

function Textarea(options) {
  var self = this;

  if (!(this instanceof Node)) {
    return new Textarea(options);
  }

  options = options || {};

  options.scrollable = options.scrollable !== false;

  Input.call(this, options);

  this.screen._listenKeys(this);

  this.value = options.value || '';
  this.hint = options.hint;

  // Cursor navigation support
  this.editorMargin = {left: 0, top: 0};
  this._resetCursor();

  this.__updateCursor = this._updateCursor.bind(this);
  this.on('resize', this.__updateCursor);
  this.on('move', this.__updateCursor);

  if (options.inputOnFocus) {
    this.on('focus', this.readInput.bind(this, null));
  }

  if (!options.inputOnFocus && options.keys) {
    this.on('keypress', function(ch, key) {
      if (self._reading) return;
      if (key.name === 'enter' || (options.vi && key.name === 'i')) {
        return self.readInput();
      }
      if (key.name === 'e') {
        return self.readEditor();
      }
    });
  }

  if (options.mouse) {
    this.on('click', function(data) {
      if (self._reading) return;
      if (data.button !== 'right') return;
      self.readEditor();
    });
  }
}

Textarea.prototype.__proto__ = Input.prototype;

Textarea.prototype.type = 'textarea';

/**
 * Cursor Navigation Methods
 */

Textarea.prototype._getLineContent = function(line) {
  var lineContent = this._clines[line];

  if (lineContent === undefined) {
    lineContent = this._clines[this._clines.length - 1];
  }

  return lineContent;
};

Textarea.prototype._hasReturn = function(line) {
  if (line === undefined) {
    var lpos = this._getCoords();
    line = this.cursor.y - lpos.yi + this.itop;
  }

  return this._clines.rtof[line] !== this._clines.rtof[line + 1];
};

Textarea.prototype._cursorMaxRight = function(line, lpos) {
  lpos = lpos ? lpos : this._getCoords();

  var lineContent = this._getLineContent(line)
    , cursorMax = lpos.xi + this.ileft + this.strWidth(lineContent);

  return this._hasReturn(line) || lineContent === '' ? cursorMax : cursorMax - 1;
};

Textarea.prototype._cursorMaxBottom = function(lpos) {
  lpos = lpos ? lpos : this._getCoords();

  return lpos.yi + this.itop + this._getMaxLine(lpos);
};

Textarea.prototype._getMaxLine = function(lpos) {
  lpos = lpos ? lpos : this._getCoords();

  var line = Math.min(
    this._clines.length - 1 - (this.childBase || 0),
    (lpos.yl - lpos.yi) - this.iheight - 1);

  // When calling clearValue() on a full textarea with a border, the first
  // argument in the above Math.min call ends up being -2. Make sure we stay
  // positive.
  return Math.max(0, line);
};

Textarea.prototype._setCursor = function(y, x) {
  if (y !== null && y !== undefined) {
    this.cursor.y = y;
    this.editorCursor.y = y - this.editorMargin.top;
  }

  if (x !== null && x !== undefined) {
    this.cursor.x = x;
    this.editorCursor.x = x - this.editorMargin.left;
  }
};

Textarea.prototype._applyCursor = function(lpos) {
  lpos = lpos ? lpos : this._getCoords();

  // Fix: use lpos.yl directly instead of lpos.yl - lpos.yi + this.iheight
  // This prevents cursor positioning issues when widget uses bottom: 0
  var cyMax = lpos.yl;

  if (this.cursor.y > cyMax) {
    this._setCursorY(cyMax);
  }

  this.screen.program.cup(this.cursor.y, this.cursor.x);
};

Textarea.prototype._setCursorY = function(val) {
  this._setCursor(val, null);
};

Textarea.prototype._setCursorX = function(val) {
  this._setCursor(null, val);
};

Textarea.prototype._resetCursor = function() {
  this.cursor = {x: undefined, y: undefined};
  this.editorCursor = {x: 0, y: 0};
};

Textarea.prototype._indexOfContentOnCursor = function() {
  var idx = 0;

  // NOTE: This has a performance cost for very large text.
  // For editing large text, consider using the external editor (e key).
  for (var y = 0; y < this.childBase + this.editorCursor.y; y++) {
    idx = idx
      + this._clines[y].replace(/\u0003/g, '').length
      + (y > 0 && this._hasReturn(y - 1) ? 1 : 0);
  }

  if (this._clines[y] !== undefined) {
    idx = idx + 1
      + this._clines[y].slice(0, this.editorCursor.x).replace(/\u0003/g, '').length
      + (y > 0 && this._hasReturn(y - 1) ? 1 : 0);
  }

  return idx;
};

/**
 * Cursor Movement Methods
 */

Textarea.prototype.moveCursorHorizontal = function(count, input) {
  this.cursor.x = this.cursor.x + count;
  this._updateCursor(null, input);
};

Textarea.prototype.moveCursorVertical = function(count, input) {
  this.cursor.y = this.cursor.y + count;
  this._updateCursor(null, input);
};

Textarea.prototype.moveCursorHorizontalByCharacter = function(direction, input) {
  var cursorMove;

  direction = direction === 'left' ? -1 : 1;

  if (!this.screen.fullUnicode) {
    cursorMove = direction;
  } else {
    if (this._clines[this.editorCursor.y][this.editorCursor.x + direction] === '\u0003') {
      cursorMove = direction * 2;
    } else {
      cursorMove = direction;
    }
  }

  this.moveCursorHorizontal(cursorMove, input);
};

Textarea.prototype.moveCursorToLineStart = function() {
  var lpos = this._getCoords();
  if (!lpos) return;
  this._setCursorX(this.editorMargin.left);
  this._applyCursor(lpos);
};

Textarea.prototype.moveCursorToLineEnd = function() {
  var lpos = this._getCoords();
  if (!lpos) return;
  var currentLine = this.childBase + this.editorCursor.y;
  var cxMax = this._cursorMaxRight(currentLine, lpos);
  this._setCursorX(cxMax);
  this._applyCursor(lpos);
};

Textarea.prototype._updateCursor = function(get, input) {
  if (this.screen.focused !== this) {
    return;
  }

  var lpos = get ? this.lpos : this._getCoords();
  if (!lpos) return;

  this.editorMargin.top = lpos.yi + this.itop;
  this.editorMargin.left = lpos.xi + this.ileft;

  var currentLine = this.childBase + this.cursor.y - this.editorMargin.top
    , program = this.screen.program
    , cx
    , cy;

  var cyMax = this._cursorMaxBottom(lpos)
    , cxMax = this._cursorMaxRight(currentLine, lpos)
    , lineMax = this._clines.width + this.editorMargin.left;

  if (this.cursor.x === undefined || this.cursor.y === undefined) {
    this.cursor.y = cyMax;
    this.cursor.x = cxMax;
  } else {
    cy = this.cursor.y;
    cx = this.cursor.x;
  }

  // XXX Not sure, but this may still sometimes
  // cause problems when leaving editor.
  if (cy === program.y && cx === program.x) {
    return;
  }

  if (cy === program.y) {
    if (cx > program.x) {
      if (cx <= cxMax) {
        this._setCursorX(cx);
      } else if (input && cx < lineMax) {
        this._setCursorX(cxMax + 1);
      } else if (cy < cyMax || cx === lineMax) {
        // Go down and the start of below line
        this._setCursor(this.cursor.y + 1, this.editorMargin.left);
      } else {
        this._setCursorX(cxMax);
      }
    } else if (cx < program.x) {
      if (cx >= this.editorMargin.left) {
        this._setCursorX(cx);
      } else if (cy > this.editorMargin.top) {
        // Go up and the end of upper line
        this.cursor.x = this.editorMargin.left + this.strWidth(this._clines[currentLine - 1]);

        if (!this._hasReturn(currentLine - 1)) {
          this.cursor.x = this.cursor.x - 1;
        }

        this._setCursor(this.cursor.y - 1, this.cursor.x);
      } else {
        this._setCursorX(this.editorMargin.left);
      }
    }
  } else {
    if (cy > program.y) {
      if (input) {
        this._setCursor(cy, this.editorMargin.left);
      } else if (cy <= cyMax) {
        var nextCxMax = this._cursorMaxRight(currentLine, lpos);
        this._setCursor(cy, nextCxMax < cx ? nextCxMax : this.cursor.x);
      } else {
        this.scroll(1);
        this._setCursorY(cyMax);
      }
    } else if (cy < program.y) {
      if (cy >= this.editorMargin.top) {
        var prevCxMax = this._cursorMaxRight(currentLine, lpos);
        this._setCursor(cy, prevCxMax < cx ? prevCxMax : this.cursor.x);
      } else {
        this.scroll(-1);
        this._setCursorY(this.editorMargin.top);
      }
    } else {
      this._setCursor(cy, cx);
    }
  }

  this._applyCursor(lpos);
};

Textarea.prototype.input =
Textarea.prototype.setInput =
Textarea.prototype.readInput = function(callback) {
  var self = this
    , focused = this.screen.focused === this;

  if (this._reading) return;
  this._reading = true;

  this._callback = callback;

  if (!focused) {
    this.screen.saveFocus();
    this.focus();
  }

  this.screen.grabKeys = true;

  this._updateCursor();
  this.screen.program.showCursor();
  //this.screen.program.sgr('normal');

  this._done = function fn(err, value) {
    if (!self._reading) return;

    if (fn.done) return;
    fn.done = true;

    self._reading = false;

    delete self._callback;
    delete self._done;

    // Remove keypress listener in nextTick to match when it was added.
    // This prevents duplicate listeners when rapidly switching between textboxes.
    // See: https://github.com/chjj/blessed/issues/109
    if (self.__listener) {
      var listener = self.__listener;
      delete self.__listener;
      nextTick(function() {
        self.removeListener('keypress', listener);
      });
    }

    self.removeListener('blur', self.__done);
    delete self.__done;

    self.screen.program.hideCursor();
    self.screen.grabKeys = false;

    if (!focused) {
      self.screen.restoreFocus();
    }


    // Ugly
    if (err === 'stop') return;

    if (err) {
      self.emit('error', err);
    } else if (value != null) {
      self.emit('submit', value);
    } else {
      self.emit('cancel', value);
    }
    self.emit('action', value);

    if (!callback) return;

    return err
      ? callback(err)
      : callback(null, value);
  };

  // Put this in a nextTick so the current
  // key event doesn't trigger any keys input.
  nextTick(function() {
    self.__listener = self._listener.bind(self);
    self.on('keypress', self.__listener);
  });

  this.__done = this._done.bind(this, null, null);
  this.on('blur', this.__done);
};

Textarea.prototype._listener = function(ch, key) {
  var done = this._done
    , value = this.value
    , charIdx;

  if (key.name === 'return') return;
  if (key.name === 'enter') {
    ch = '\n';
  }

  if (this.options.keys && key.ctrl && key.name === 'e') {
    return this.readEditor();
  }

  // TODO: Optimize typing by writing directly
  // to the screen and screen buffer here.
  if (key.name === 'escape') {
    done(null, null);
  } else if (key.name === 'left') {
    this.moveCursorHorizontalByCharacter(key.name);
  } else if (key.name === 'right') {
    this.moveCursorHorizontalByCharacter(key.name);
  } else if (key.name === 'up') {
    this.moveCursorVertical(-1);
  } else if (key.name === 'down') {
    this.moveCursorVertical(1);
  } else if (key.name === 'home') {
    this.moveCursorToLineStart();
  } else if (key.name === 'end') {
    this.moveCursorToLineEnd();
  } else if (key.name === 'delete') {
    // Delete character at cursor (forward delete)
    if (this.value.length) {
      charIdx = this._indexOfContentOnCursor();
      if (charIdx <= this.value.length) {
        if (this.screen.fullUnicode) {
          if (unicode.isSurrogate(this.value, charIdx)) {
            this.value = this.value.slice(0, charIdx) + this.value.slice(charIdx + 2);
          } else {
            this.value = this.value.slice(0, charIdx) + this.value.slice(charIdx + 1);
          }
        } else {
          this.value = this.value.slice(0, charIdx) + this.value.slice(charIdx + 1);
        }
      }
    }
  } else if (key.name === 'backspace') {
    if (this.value.length) {
      this.moveCursorHorizontalByCharacter('left', true);
      charIdx = this._indexOfContentOnCursor();
      this.value = this.value.slice(0, charIdx - 1) + this.value.slice(charIdx);
    }
  } else if (ch) {
    if (!/^[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]$/.test(ch)) {
      charIdx = this._indexOfContentOnCursor();
      this.value = this.value.slice(0, charIdx - 1) + ch + this.value.slice(charIdx - 1);

      if (ch === '\n') {
        this.moveCursorVertical(1, true);
      } else {
        // TODO: don't move when user changes input method for CJK.
        this.moveCursorHorizontal(unicode.charWidth(ch), true);
      }
    }
  }

  if (this.value !== value) {
    this.screen.render();
  }
};

Textarea.prototype._typeScroll = function() {
  // XXX Workaround
  var height = this.height - this.iheight;
  if (this._clines.length - this.childBase > height) {
    this.scroll(this._clines.length);
  }
};

Textarea.prototype.getValue = function() {
  return this.value;
};

Textarea.prototype.setValue = function(value) {
  if (value == null) {
    value = this.value;
  }
  if (this._value !== value) {
    this.value = value;
    this._value = value;
    if (this.value === '' && this.hint) {
      // Show hint text when value is empty
      this.setContent('{gray-fg}' + this.hint + '{/gray-fg}');
    } else {
      this.setContent(this.value);
    }
    if (this.cursor.y && this.cursor.y >= this.height + this.iheight) {
      this._typeScroll();
    }
    this._updateCursor();
  }
};

Textarea.prototype.clearInput =
Textarea.prototype.clearValue = function() {
  this._resetCursor();
  return this.setValue('');
};

Textarea.prototype.submit = function() {
  if (!this._done) return;
  return this._done(null, this.value);
};

Textarea.prototype.cancel = function() {
  if (!this._done) return;
  return this._done(null, null);
};

Textarea.prototype.render = function() {
  this.setValue();
  return this._render();
};

Textarea.prototype.editor =
Textarea.prototype.setEditor =
Textarea.prototype.readEditor = function(callback) {
  var self = this;

  if (this._reading) {
    var _cb = this._callback
      , cb = callback;

    this._done('stop');

    callback = function(err, value) {
      if (_cb) _cb(err, value);
      if (cb) cb(err, value);
    };
  }

  if (!callback) {
    callback = function() {};
  }

  return this.screen.readEditor({ value: this.value }, function(err, value) {
    if (err) {
      if (err.message === 'Unsuccessful.') {
        self.screen.render();
        return self.readInput(callback);
      }
      self.screen.render();
      self.readInput(callback);
      return callback(err);
    }
    self.setValue(value);
    self.screen.render();
    return self.readInput(callback);
  });
};

/**
 * Expose
 */

module.exports = Textarea;
