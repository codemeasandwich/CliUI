import test from 'node:test';
import assert from 'node:assert';

test('ESM imports', async (t) => {
  await t.test('default import works', async () => {
    const galactica = await import('../index.mjs');
    assert.ok(galactica.default, 'default export should exist');
    assert.ok(typeof galactica.default.grid === 'function', 'default.grid should be a function');
  });

  await t.test('named widget imports work', async () => {
    const { grid, line, bar, table, scatter, stackedBar } = await import('../index.mjs');
    assert.ok(typeof grid === 'function', 'grid should be a function');
    assert.ok(typeof line === 'function', 'line should be a function');
    assert.ok(typeof bar === 'function', 'bar should be a function');
    assert.ok(typeof table === 'function', 'table should be a function');
    assert.ok(typeof scatter === 'function', 'scatter should be a function');
    assert.ok(typeof stackedBar === 'function', 'stackedBar should be a function');
  });

  await t.test('named layout imports work', async () => {
    const { carousel } = await import('../index.mjs');
    assert.ok(typeof carousel === 'function', 'carousel should be a function');
  });

  await t.test('additional widgets are exported', async () => {
    const { gauge, gaugeList, lcd, donut, log, picture, sparkline, tree, markdown, map, canvas } = await import('../index.mjs');
    assert.ok(typeof gauge === 'function', 'gauge should be a function');
    assert.ok(typeof gaugeList === 'function', 'gaugeList should be a function');
    assert.ok(typeof lcd === 'function', 'lcd should be a function');
    assert.ok(typeof donut === 'function', 'donut should be a function');
    assert.ok(typeof log === 'function', 'log should be a function');
    assert.ok(typeof picture === 'function', 'picture should be a function');
    assert.ok(typeof sparkline === 'function', 'sparkline should be a function');
    assert.ok(typeof tree === 'function', 'tree should be a function');
    assert.ok(typeof markdown === 'function', 'markdown should be a function');
    assert.ok(typeof map === 'function', 'map should be a function');
    assert.ok(typeof canvas === 'function', 'canvas should be a function');
  });

  await t.test('server utilities are exported', async () => {
    const { OutputBuffer, InputBuffer, createScreen, serverError } = await import('../index.mjs');
    assert.ok(typeof OutputBuffer === 'function', 'OutputBuffer should be a function');
    assert.ok(typeof InputBuffer === 'function', 'InputBuffer should be a function');
    assert.ok(typeof createScreen === 'function', 'createScreen should be a function');
    assert.ok(typeof serverError === 'function', 'serverError should be a function');
  });

  await t.test('blessed core exports are available', async () => {
    const { program, colors, unicode, helpers, widget } = await import('../index.mjs');
    assert.ok(typeof program === 'function', 'program should be a function');
    assert.ok(colors, 'colors should be exported');
    assert.ok(unicode, 'unicode should be exported');
    assert.ok(helpers, 'helpers should be exported');
    assert.ok(widget, 'widget should be exported');
  });

  await t.test('blessed widget factories are available', async () => {
    const { screen, box, text, list, button } = await import('../index.mjs');
    assert.ok(typeof screen === 'function', 'screen should be a function');
    assert.ok(typeof box === 'function', 'box should be a function');
    assert.ok(typeof text === 'function', 'text should be a function');
    assert.ok(typeof list === 'function', 'list should be a function');
    assert.ok(typeof button === 'function', 'button should be a function');
  });

  await t.test('blessed widget classes are available', async () => {
    const { Screen, Box, Element, List } = await import('../index.mjs');
    assert.ok(Screen, 'Screen class should be exported');
    assert.ok(Box, 'Box class should be exported');
    assert.ok(Element, 'Element class should be exported');
    assert.ok(List, 'List class should be exported');
  });
});
