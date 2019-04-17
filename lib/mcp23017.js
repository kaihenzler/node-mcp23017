var DIRECTION_GPIOA = 0x00,
    DIRECTION_GPIOB = 0x01,
    FROM_GPIOA = 0x12,
    FROM_GPIOB = 0x13,
    TO_GPIOA = 0x14,
    TO_GPIOB = 0x15,
    os = require('os'),
    i2cBus;

var MCP23017 = (function() {
  MCP23017.prototype.HIGH = 1;
  MCP23017.prototype.LOW = 0;
  MCP23017.prototype.INPUT = 1;
  MCP23017.prototype.OUTPUT = 0;

  MCP23017.prototype.address = 0x20; //if the mcp has all adress lines pulled low

  MCP23017.prototype.oldADir = 0xff; //initial state of GPIO A
  MCP23017.prototype.oldBDir = 0xff; //initial state of GPIO A

  MCP23017.prototype.oldGpioA = 0x0; //initial state of GPIO A
  MCP23017.prototype.oldGpioB = 0x0; //initial state of GPIO B

  function MCP23017 (config) {
    this.address = config.address;
    this.mode = this.INPUT;
    this.debug = config.debug === true ? true : false;
    this.device = config.device !== null ? config.device : 1;

    this.i2c = i2cBus.openSync(config.device);

    this._initGpioA();
    this._initGpioB();
  }

  //inits both registers as an input
  MCP23017.prototype.reset = function () {
    this.oldBDir = 0xff;
    this.oldADir = 0xff;
    this._initGpioA();
    this._initGpioB();
  };

  /*
    sets an pin as an INPUT or OUTPUT
  */
  MCP23017.prototype.pinMode = function (pin, dir) {
    if (dir !== this.INPUT && dir !== this.OUTPUT) {
      console.error('invalid value', dir);
      return;
    }
    if (isNaN(pin)) {
      console.error('pin is not a number:', pin);
      return;
    } else if (pin > 15 || pin < 0) {
      console.error('invalid pin:', pin);
    }

    //delegate to funktion that handles low level stuff
    this._setGpioDir(pin >= 8 ? pin - 8 : pin, dir, pin >= 8 ? DIRECTION_GPIOB : DIRECTION_GPIOA);
  };

  /*
    internally used to set the direction registers
  */
  MCP23017.prototype._setGpioDir = function (pin, dir, register) {
    var pinHexMask = Math.pow(2, pin),
        registerValue;

    if (register === DIRECTION_GPIOA) {
      registerValue = this.oldADir;
      if (dir === this.OUTPUT) {
        if ((this.oldADir & pinHexMask) === pinHexMask) {
          this.log('setting pin \'' + pin + '\' as an OUTPUT');
          this.oldADir = this.oldADir ^ pinHexMask;
          registerValue = this.oldADir;
        } else {
          this.log('pin \'' + pin + '\' already an OUTPUT');
        }
      } else if (dir === this.INPUT) {
        if ((this.oldADir & pinHexMask) !== pinHexMask) {
          this.log('setting pin \'' + pin + '\' as an INPUT');
          this.oldADir = this.oldADir ^ pinHexMask;
          registerValue = this.oldADir;
        } else {
          this.log('pin \'' + pin + '\' already an INPUT');
        }
      }
    } else if (register === DIRECTION_GPIOB) {
      registerValue = this.oldBDir;
      if (dir === this.OUTPUT) {
        if ((this.oldBDir & pinHexMask) === pinHexMask) {
          this.log('setting pin \'' + pin + '\' as an OUTPUT');
          this.oldBDir = this.oldBDir ^ pinHexMask;
          registerValue = this.oldBDir;
        } else {
          this.log('pin \'' + pin + '\' already an OUTPUT');
        }
      } else if (dir === this.INPUT) {
        if ((this.oldBDir & pinHexMask) !== pinHexMask) {
          this.log('setting pin \'' + pin + '\' as an INPUT');
          this.oldBDir = this.oldBDir ^ pinHexMask;
          registerValue = this.oldBDir;
        } else {
          this.log('pin \'' + pin + '\' already an INPUT');
        }
      }
    }
    this._send(register, registerValue);
    this.log('register: ' + register + ', value: ' + registerValue);
  };

  MCP23017.prototype._setGpioAPinValue = function (pin, value) {
    var pinHexMask = Math.pow(2, pin);
    if (value === 0) {
      if ((this.oldGpioA & pinHexMask) === pinHexMask) {
        this.oldGpioA = this.oldGpioA ^ pinHexMask;
        this._send(TO_GPIOA, this.oldGpioA);
      }
    }
    if (value === 1) {
      if ((this.oldGpioA & pinHexMask) !== pinHexMask) {
        this.oldGpioA = this.oldGpioA ^ pinHexMask;
        this._send(TO_GPIOA, this.oldGpioA);
      }
    }
  };

  MCP23017.prototype._setGpioBPinValue = function (pin, value) {
    var pinHexMask = Math.pow(2, pin);
    if (value === 0) {
      if ((this.oldGpioB & pinHexMask) === pinHexMask) {
        this.oldGpioB = this.oldGpioB ^ pinHexMask;
        this._send(TO_GPIOB, this.oldGpioB);
      }
    }
    if (value === 1) {
      if ((this.oldGpioB & pinHexMask) !== pinHexMask) {
        this.oldGpioB = this.oldGpioB ^ pinHexMask;
        this._send(TO_GPIOB, this.oldGpioB);
      }
    }
  };

  var allowedValues = [0, 1, true, false];
  MCP23017.prototype.digitalWrite = function (pin, value) {
    if (allowedValues.indexOf(value) < 0) {
      console.error('invalid value', value);
      return;
    } else if (value === false) {
      value = this.LOW;
    } else if (value === true) {
      value = this.HIGH;
    }

    if (isNaN(pin)) {
      console.error('pin is not a number:', pin);
      return;
    } else if (pin > 15 || pin < 0) {
      console.error('invalid pin:', pin);
    } else if (pin < 8 ) {
      //Port A
      this._setGpioAPinValue(pin, value);
    } else {
      //Port B
      pin -= 8;
      this._setGpioBPinValue(pin, value);
    }
  };

  MCP23017.prototype.digitalRead = function (pin, callback) {
    var register = pin >= 8 ? FROM_GPIOB : FROM_GPIOA; //get the register to read from
    pin = pin >= 8 ? pin - 8 : pin; //remap the pin to internal value
    var pinHexMask = Math.pow(2, pin); //create a hexMask

    //read one byte from the right register (A or B)
    this._read(register, 1, function (err, registerValue) {
      if (err) {
        console.error(err);
        callback(err, null);
      } else if ((registerValue & pinHexMask) === pinHexMask) {
        //Check if the requested bit is set in the byte returned from the register
        callback(null, true);
      } else {
        callback(null, false);
      }
    });

  };

  MCP23017.prototype.digitalReadA = function (callback) {
    this._read(FROM_GPIOA, 1, function (err, registerValue) {
      if (err) {
        console.error(err);
        callback(err, null);
      } else {        
        var b = [];
        for (var i = 0; i < 8; i++)
          b[i] = !!((registerValue >> i) & 1);
        callback(null, b);
      }
    });
  };

  MCP23017.prototype.digitalReadB = function (callback) {
    this._read(FROM_GPIOB, 1, function (err, registerValue) {
      if (err) {
        console.error(err);
        callback(err, null);
      } else {        
        var b = [];
        for (var i = 0; i < 8; i++)
          b[i] = !!((registerValue >> i) & 1);
        callback(null, b);
      }
    });
  };

  MCP23017.prototype.digitalReadAll = function (callback) {
    var self = this;
    self.digitalReadA(function (err, regA) {
      if (err) {
        console.error(err);
        return callback(err, null);
      }
      self.digitalReadB(function (err, regB) {
        if (err) {
          console.error(err);
          return callback(err, null);
        }
        callback(null, regA.concat(regB));
      });
    });
  };

  var pollingInterval;
  MCP23017.prototype.digitalReadAllInterval = function (callback, delay) {
    if (!callback)
      return clearInterval(pollingInterval);
    var self = this;
    self.pollingCallback = callback;
    pollingInterval = setInterval(function(){
      self.digitalReadAll(self.pollingCallback);
    }, delay || 100);
  };

  MCP23017.prototype._initGpioA = function () {
    this._send(DIRECTION_GPIOA, this.oldADir); //Set Direction to Output
    this._send(TO_GPIOA, 0x0); //clear all output states
  };

  MCP23017.prototype._initGpioB = function () {
    this._send(DIRECTION_GPIOB, this.oldBDir); //Set Direction to Output
    this._send(TO_GPIOB, 0x0); //clear all output states
  };

  MCP23017.prototype._send = function (cmd, values) {
    this.i2c.writeByteSync(this.address, cmd, values);
  };

  MCP23017.prototype._read = function (cmd, length, callback) {
    this.i2c.readByte(this.address, cmd, callback);
  };

  MCP23017.prototype.log = function (msg) {
    if (this.debug) {
      console.log(msg);
    }
  };

  return MCP23017;

})();

if (os.arch() == 'arm') {
  i2cBus = require('i2c-bus');
} else {
  console.error('This module does only works on Linux!');
  process.exit(-1);
}

module.exports = MCP23017;
