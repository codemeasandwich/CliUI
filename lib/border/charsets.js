'use strict';

var CHARSETS = {
  light: {
    topLeft:     '\u250C', // ┌
    topRight:    '\u2510', // ┐
    bottomLeft:  '\u2514', // └
    bottomRight: '\u2518', // ┘
    horizontal:  '\u2500', // ─
    vertical:    '\u2502'  // │
  },
  heavy: {
    topLeft:     '\u250F', // ┏
    topRight:    '\u2513', // ┓
    bottomLeft:  '\u2517', // ┗
    bottomRight: '\u251B', // ┛
    horizontal:  '\u2501', // ━
    vertical:    '\u2503'  // ┃
  },
  double: {
    topLeft:     '\u2554', // ╔
    topRight:    '\u2557', // ╗
    bottomLeft:  '\u255A', // ╚
    bottomRight: '\u255D', // ╝
    horizontal:  '\u2550', // ═
    vertical:    '\u2551'  // ║
  },
  rounded: {
    topLeft:     '\u256D', // ╭
    topRight:    '\u256E', // ╮
    bottomLeft:  '\u2570', // ╰
    bottomRight: '\u256F', // ╯
    horizontal:  '\u2500', // ─
    vertical:    '\u2502'  // │
  }
};

function resolveCharset(border) {
  var cs = border && border.charset;
  if (!cs || cs === 'light') return CHARSETS.light;
  if (typeof cs === 'string') return CHARSETS[cs] || CHARSETS.light;
  if (typeof cs === 'object') return cs;
  return CHARSETS.light;
}

exports.CHARSETS = CHARSETS;
exports.resolveCharset = resolveCharset;
