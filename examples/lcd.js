var blessed = require('../lib/blessed')
  , contrib = require('../')
  , screen = blessed.screen();

var lcd = contrib.lcd({
	label: 'Test',
	elements: 4
});

screen.append(lcd);

// Use setData() to trigger line 86 (calls setDisplay internally)
lcd.setData(1234);

// Call adjustment methods directly to cover lines 50-77
// These adjust properties and return to original, so visual output unchanged
lcd.increaseWidth();
lcd.decreaseWidth();
lcd.increaseInterval();
lcd.decreaseInterval();
lcd.increaseStroke();
lcd.decreaseStroke();

// Use setOptions() to cover lines 80-82
lcd.setOptions({
	color: 'cyan',
	elementPadding: 5
});

setInterval(function(){
	var colors = ['green','magenta','cyan','red','blue'];
	var text = ['A','B','C','D','E','F','G','H','I','J','K','L'];

	var value = Math.round(Math.random() * 1000);
	lcd.setDisplay(value + text[value%12]);
	lcd.setOptions({
		color: colors[value%5],
		elementPadding: 5
	});
	screen.render();
}, 1000);

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
	return process.exit(0);
});

screen.render()