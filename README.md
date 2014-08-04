node-mcp23017
=============

Node.js library for the I2C I/O Expander MCP23017 on a Raspberry Pi

It currently only supports reading from and writing to the chip

The module tries to mimic the Arduino-Syntax

##Installation

install via npm. just type the following in the terminal/console

````bash
npm install node-mcp23017 --save
```

## Raspberry Pi Setup

In order to use this module with the Raspberry Pi running Raspbian you have to enable to stuff


````bash
$ sudo vi /etc/modules
````

Add these two lines

````bash
i2c-bcm2708
i2c-dev
````

````bash
$ sudo vi /etc/modprobe.d/raspi-blacklist.conf
````

Comment out blacklist i2c-bcm2708

````
#blacklist i2c-bcm2708
````

Load kernel module

````bash
$ sudo modprobe i2c-bcm2708
````

Make device writable

````bash
sudo chmod o+rw /dev/i2c*
````

## Usage

```javascript
var MCP23017 = require('mcp23017');

var mcp = new MCP23017({
  address: 0x20, //default: 0x20
  device: '/dev/i2c-1', // '/dev/i2c-1' on model B | '/dev/i2c-0' on model A
  mode: MCP23017.OUTPUT, //configure all pins as output (default is MCP23017.INPUT)
  debug: true //default: false
});

/*
  By default all GPIOs are defined as INPUTS.
  You can set them all the be an OUTPUT by adding '{mode: MCP23017.OUTPUT}' to the config,
  like I did in the instantiation above.
  You can also disable the debug option by simply not passing it to the constructor or by setting it to false
*/

//set all GPIOS to be OUTPUTS
for (var i = 0; i < 16; i++) {
  mcp.pinMode(i, mcp.OUTPUT);
  //mcp.pinMode(i, mcp.INPUT); //if you want them to be inputs
}

mcp.digitalWrite(0, mcp.HIGH); //set GPIO A Pin 0 to state HIGH
mcp.digitalWrite(0, mcp.LOW); //set GPIO A Pin 0 to state LOW

/*
  to read an input use the following code-block.
  This reads pin Nr. 0 (GPIO A Pin 0)
  value is either false or true
*/
mcp.digitalRead(0, function (err, value) {
  console.log('Pin 0', value);
});

````

## Example (Blink 16 LEDs)

```javascript
var MCP23017 = require('mcp23017');

var mcp = new MCP23017({
  address: 0x20, //all address pins pullew low
  device: '/dev/i2c-1', // Model B
  mode: MCP23017.OUTPUT //configure all pins as output
});


/*
  This function blinks 16 LED, each hooked up to an port of the MCP23017
*/
var lastPin = 0;
var max = 16;
var state = false;

var blink = function() {
  if (lastPin >= max) {
    lastPin = 0; //reset the pin counter if we reach the end
  }

  if (state) {
    mcp.digitalWrite(lastPin, mcp.LOW); //turn off the current LED
    lastPin++; //increase counter
  } else {
    mcp.digitalWrite(lastPin, mcp.HIGH); //turn on the current LED
  }
  state = !state; //invert the state of this LED
};

setInterval(blink, 100); //blink all LED's with a delay of 100ms
````



## TODO

- implement built-in pullup resistors
- implement interrupt handling