var MCP23017 = require('node-mcp23017');

var mcp = new MCP23017({
  address: 0x20, //all address pins pulled low
  device: '/dev/i2c-1', // Model B
  debug: false
});

/*
  This function blinks 16 LED, each hooked up to an port of the MCP23017
*/
var pin = 0;
var max = 16;
var state = false;

var blink = function() {
  if (pin >= max) {
    pin = 0; //reset the pin counter if we reach the end
  }

  if (state) {
    mcp.digitalWrite(pin, mcp.LOW); //turn off the current LED
    pin++; //increase counter
  } else {
    mcp.digitalWrite(pin, mcp.HIGH); //turn on the current LED
    console.log('blinking pin', pin);
  }
  state = !state; //invert the state of this LED
};

//define all gpios as outputs
for (var i = 0; i < 16; i++) {
  mcp.pinMode(i, mcp.OUTPUT);
}

setInterval(blink, 100); //blink all LED's with a delay of 100ms