var i2c = require('i2c-bus');

var REGISTER_GPIOA = 0x00,
    REGISTER_GPIOB = 0x01,
    INTEN_ADDR = [0x04, 0x05],
    DEFVAL_ADDR = [0x06, 0x07],
    INTCON_ADDR = [0x08, 0x09],
    INTF_ADDR = [0x0E, 0x0F],
    INTCAP_ADDR = [0x10, 0x11],
    IOCON_ADDR = 0x0A,
    REGISTER_GPIOA_PULLUP = 0x0C,
    REGISTER_GPIOB_PULLUP = 0x0D,
    READ_GPIOA_ADDR = 0x12,
    READ_GPIOB_ADDR = 0x13,
    WRITE_GPIOA_ADDR = 0x14,
    WRITE_GPIOB_ADDR = 0x15;

var MCP23017 = (function() {
  MCP23017.prototype.HIGH = 1;
  MCP23017.prototype.LOW = 0;
  MCP23017.prototype.INPUT_PULLUP = 2;
  MCP23017.prototype.INPUT = 1;
  MCP23017.prototype.OUTPUT = 0;
  MCP23017.prototype.CHANGE = 2;
  MCP23017.prototype.ACTIVE_LOW  = 0x00;
  MCP23017.prototype.ACTIVE_HIGH = 0x02;
  MCP23017.prototype.OPEN_DRAIN  = 0x04;

  MCP23017.prototype.address = 0x20; //if the mcp has all address lines pulled low

  MCP23017.prototype.dirAState = 0xff; //initial state of GPIO A bank
  MCP23017.prototype.dirBState = 0xff; //initial state of GPIO B bank

  MCP23017.prototype.dirAPullUpState = 0x0; //initial state of GPIO A pull up resistor state
  MCP23017.prototype.dirBPullUpState = 0x0; //initial state of GPIO B pull up resistor state

  MCP23017.prototype.gpioAState = 0x0; //initial state of GPIOS A
  MCP23017.prototype.gpioBState = 0x0; //initial state of GPIOS B

  MCP23017.prototype.inten = [0x0, 0x0]; //initial state of interrupt enable
  MCP23017.prototype.defval = [0x0, 0x0]; //initial state of interrupt compare value
  MCP23017.prototype.intcon = [0x0, 0x0]; //initial state of interrupt change/compare value

  function MCP23017 (config) {
    this.address = config.address;
    this.mode = this.INPUT;
    this.debug = config.debug === true ? true : false;
    this.device = config.device !== null ? config.device : 1;
    this.wire = i2c.openSync(this.device);
    this._initGpioA();
    this._initGpioB();
  }

  //inits both registers as an input
  MCP23017.prototype.reset = function () {
    this.dirBState = 0xff;
    this.dirAState = 0xff;
    this.gpioAState = 0x00;
    this.gpioBState = 0x00;
    for (var i = 0; i < 2; i++) {
      this.inten[i] = 0x00;
      this._send(INTEN_ADDR[i], [this.inten[i]]);
      this.defval[i] = 0x00;
      this._send(DEFVAL_ADDR[i], [this.defval[i]]);
      this.intcon[i] = 0x00;
      this._send(INTCON_ADDR[i], [this.intcon[i]]);
    }
    this._send(IOCON_ADDR, [0x00])
    this._initGpioA();
    this._initGpioB();
  };

  /*
    configures an pin interrupt
    mirror: INTA and INTB are connected (1) or triggered separately by their respective ports (0)
  */
  MCP23017.prototype.interruptMode = function (mirror, mode) {
    if (mode !== this.ACTIVE_LOW && mode !== this.ACTIVE_HIGH && mode !== this.OPEN_DRAIN) {
      console.error('invalid value', mode);
      return;
    }
    if (mirror == true) {
      this._send(IOCON_ADDR, [0x40 | mode]);
    } else {
      this._send(IOCON_ADDR, [mode]);
    }
  };

  /*
    configures an pin interrupt
  */
  MCP23017.prototype.attachInterrupt = function (pin, mode) {
    if (mode !== this.CHANGE && mode !== this.LOW && mode !== this.HIGH) {
      console.error('invalid value', mode);
      return;
    }
    if (isNaN(pin)) {
      console.error('pin is not a number:', pin);
      return;
    } else if (pin > 15 || pin < 0) {
      console.error('invalid pin:', pin);
    }

    //delegate to function that handles low level stuff
    this._setInterrupt(pin >= 8 ? pin - 8 : pin, mode, pin >= 8 ? 1 : 0);
  };
  
  MCP23017.prototype._setInterrupt = function (pin, mode, port) {
    var pinHexMask = Math.pow(2, pin);
    
    if (mode === this.CHANGE) {
      if ((this.intcon[port] & pinHexMask) === pinHexMask) {
        this.log('setting pin \'' + pin + '\' for CHANGE interrupt');
        this.intcon[port] ^= pinHexMask;
        this._send(INTCON_ADDR[port], [this.intcon[port]]);
      } else {
        this.log('pin \'' + pin + '\' already CHANGE interrupt');
      }
    } else {
      if ((this.intcon[port] & pinHexMask) !== pinHexMask) {
        this.log('setting pin \'' + pin + '\' for edge detect interrupt');
        this.intcon[port] |= pinHexMask;
        this._send(INTCON_ADDR[port], [this.intcon[port]]);
      } else {
        this.log('pin \'' + pin + '\' already CHANGE interrupt');
      }
      this.intcon[port] |= pinHexMask;
      if (mode === this.HIGH) {
        if ((this.defval[port] & pinHexMask) === pinHexMask) {
          this.defval[port] ^= pinHexMask;
          this.log('setting pin \'' + pin + '\' for RISING interrupt');
          this._send(DEFVAL_ADDR[port], [this.defval[port]]);
        } else {
          this.log('pin \'' + pin + '\' already RISING interrupt');
        }
      } else {
        if ((this.defval[port] & pinHexMask) !== pinHexMask) {
          this.defval[port] |= pinHexMask;
          this.log('setting pin \'' + pin + '\' for FALLING interrupt');
          this._send(DEFVAL_ADDR[port], [this.defval[port]]);
        } else {
          this.log('pin \'' + pin + '\' already FALLING interrupt');
        }
      }
    }
    if ((this.inten[port] & pinHexMask) !== pinHexMask) {
      this.log('enabling pin \'' + pin + '\' interrupt');
      this.inten[port] |= pinHexMask;
      this._send(INTEN_ADDR[port], [this.inten[port]]);
    } else {
      this.log('pin \'' + pin + '\' interrupt already enabled');
    }
  }
  
  MCP23017.prototype.disableInterrupt = function (pin) {
    if (isNaN(pin)) {
      console.error('pin is not a number:', pin);
      return;
    } else if (pin > 15 || pin < 0) {
      console.error('invalid pin:', pin);
    }
    var port = 0;
    if (pin >= 8) {
      pin -= 8;
      port = 1;
    }
    var pinHexMask = Math.pow(2, pin);
    if ((this.inten[port] & pinHexMask) === pinHexMask) {
      this.log('disabling pin \'' + pin + '\' interrupt');
      this.inten[port] ^= pinHexMask;
      this._send(INTEN_ADDR[port], [this.inten[port]]);
    } else {
      this.log('pin \'' + pin + '\' interrupt already disabled');
    }
  }
  
  /*
    get the pin causing the interrupt on specified port
  */
  MCP23017.prototype.getInterruptCause = function (port, callback) {
    let _port = port // make const copy...

    //read one byte from the right register (A or B)
    this._read(INTF_ADDR[port], 1, function (err, registerValue) {
      if (err) {
        console.error(err);
        callback(_port, err, null);
      } else {
        callback(_port, null, registerValue);
      }
    });
  };
  
  /*
    get the captured gpio values at time interrupt
  */
  MCP23017.prototype.getInterruptCapture = function (port, callback) {
    let _port = port // make const copy...

    //read one byte from the right register (A or B)
    this._read(INTCAP_ADDR[port], 1, function (err, registerValue) {
      if (err) {
        console.error(err);
        callback(_port, err, null);
      } else {
        callback(_port, null, registerValue);
      }
    });
  };

  /*
    sets an pin as an INPUT or OUTPUT
  */
  MCP23017.prototype.pinMode = function (pin, dir) {
    if (dir !== this.INPUT && dir !== this.INPUT_PULLUP && dir !== this.OUTPUT) {
      console.error('invalid value', dir);
      return;
    }
    if (isNaN(pin)) {
      console.error('pin is not a number:', pin);
      return;
    } else if (pin > 15 || pin < 0) {
      console.error('invalid pin:', pin);
    }

    //delegate to function that handles low level stuff
    this._setGpioDir(pin >= 8 ? pin - 8 : pin, dir, pin >= 8 ? REGISTER_GPIOB : REGISTER_GPIOA, pin >= 8 ? REGISTER_GPIOB_PULLUP : REGISTER_GPIOA_PULLUP);
  };

  /*
    internally used to set the direction registers
  */
  MCP23017.prototype._setGpioDir = function (pin, dir, registerDirection, registerPullUp) {
    var pinHexMask = Math.pow(2, pin),
        registerDir,
        registerPullUpDir;

    if (registerDirection === REGISTER_GPIOA) {
      registerDir = this.dirAState;
      if (dir === this.OUTPUT) {
        if ((this.dirAState & pinHexMask) === pinHexMask) {
          this.log('setting pin \'' + pin + '\' as an OUTPUT');
          this.dirAState = this.dirAState ^ pinHexMask;
          registerDir = this.dirAState;
        } else {
          this.log('pin \'' + pin + '\' already an OUTPUT');
        }
      } else if (dir === this.INPUT || dir === this.INPUT_PULLUP) {
        if ((this.dirAState & pinHexMask) !== pinHexMask) {
          this.log('setting pin \'' + pin + '\' as an INPUT');
          this.dirAState = this.dirAState ^ pinHexMask;
          registerDir = this.dirAState;
        } else {
          this.log('pin \'' + pin + '\' already an INPUT');
        }
        if (dir === this.INPUT_PULLUP) {
           registerPullUpDir = this.dirAPullUpState;
           if ((this.dirAPullUpState & pinHexMask) !== pinHexMask) {
              this.log('activate INPUT_PULLUP for pin \'' + pin + '\'');
              this.dirAPullUpState = this.dirAPullUpState ^ pinHexMask;
              registerPullUpDir = this.dirAPullUpState;
           } else {
              this.log('pin \'' + pin + '\' already activated INPUT_PULLUP');
           }
        }
      }
    } else if (registerDirection === REGISTER_GPIOB) {
      registerDir = this.dirBState;
      if (dir === this.OUTPUT) {
        if ((this.dirBState & pinHexMask) === pinHexMask) {
          this.log('setting pin \'' + pin + '\' as an OUTPUT');
          this.dirBState = this.dirBState ^ pinHexMask;
          registerDir = this.dirBState;
        } else {
          this.log('pin \'' + pin + '\' already an OUTPUT');
        }
      } else if (dir === this.INPUT || dir === this.INPUT_PULLUP) {
        if ((this.dirBState & pinHexMask) !== pinHexMask) {
          this.log('setting pin \'' + pin + '\' as an INPUT');
          this.dirBState = this.dirBState ^ pinHexMask;
          registerDir = this.dirBState;
        } else {
          this.log('pin \'' + pin + '\' already an INPUT');
        }
        if (dir === this.INPUT_PULLUP) {
           registerPullUpDir = this.dirBPullUpState;
           if ((this.dirBPullUpState & pinHexMask) !== pinHexMask) {
              this.log('activate INPUT_PULLUP for pin \'' + pin + '\'');
              this.dirBPullUpState = this.dirBPullUpState ^ pinHexMask;
              registerPullUpDir = this.dirBPullUpState;
           } else {
              this.log('pin \'' + pin + '\' already activated INPUT_PULLUP');
           }
        }
      }
    }

    this._send(registerDirection, [registerDir]);
    this.log('pin:  ' + pin + ', register: ' + registerDirection + ', value: ' + registerDir);

    if(registerPullUpDir !== undefined){
        this._send(registerPullUp, [registerPullUpDir]);
        this.log('pin:  ' + pin + ', register: ' + registerPullUp + ', pull up value: ' + registerPullUpDir);
    }
  };

  MCP23017.prototype._setGpioAPinValue = function (pin, value) {
    var pinHexMask = Math.pow(2, pin);
    if (value === 0) {
      if ((this.gpioAState & pinHexMask) === pinHexMask) {
        this.gpioAState = this.gpioAState ^ pinHexMask;
        this._send(WRITE_GPIOA_ADDR, [this.gpioAState]);
      }
    }
    if (value === 1) {
      if ((this.gpioAState & pinHexMask) !== pinHexMask) {
        this.gpioAState = this.gpioAState ^ pinHexMask;
        this._send(WRITE_GPIOA_ADDR, [this.gpioAState]);
      }
    }
  };

  MCP23017.prototype._setGpioBPinValue = function (pin, value) {
    var pinHexMask = Math.pow(2, pin);
    if (value === 0) {
      if ((this.gpioBState & pinHexMask) === pinHexMask) {
        this.gpioBState = this.gpioBState ^ pinHexMask;
        this._send(WRITE_GPIOB_ADDR, [this.gpioBState]);
      }
    }
    if (value === 1) {
      if ((this.gpioBState & pinHexMask) !== pinHexMask) {
        this.gpioBState = this.gpioBState ^ pinHexMask;
        this._send(WRITE_GPIOB_ADDR, [this.gpioBState]);
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
  
  MCP23017.prototype.writePort = function (port, value) {
    if (value < 0 || value >= 0xff) {
      console.error('invalid value', value);
      return;
    }

    if (isNaN(port)) {
      console.error('port is not a number:', port);
      return;
    } else if (port > 1 || port < 0) {
      console.error('invalid port:', port);
    } else if (port) {
      //Port B
      this.gpioBState = value
      this._send(WRITE_GPIOB_ADDR, [value]);
    } else {
      //Port A
      this.gpioAState = value
      this._send(WRITE_GPIOA_ADDR, [value]);
    }
  };

  MCP23017.prototype.digitalRead = function (pin, callback) {
    let _pin = pin // make const copy...
    var register = pin >= 8 ? READ_GPIOB_ADDR : READ_GPIOA_ADDR; //get the register to read from
    pin = pin >= 8 ? pin - 8 : pin; //remap the pin to internal value
    var pinHexMask = Math.pow(2, pin); //create a hexMask

    //read one byte from the right register (A or B)
    this._read(register, 1, function (err, registerValue) {
      if (err) {
        console.error(err);
        callback(_pin, err, null);
      } else if ((registerValue & pinHexMask) === pinHexMask) {
        //Check if the requested bit is set in the byte returned from the register
        callback(_pin, null, true);
      } else {
        callback(_pin, null, false);
      }
    });

  };
  
  MCP23017.prototype.readPort = function (port, callback) {
    let _port = port // make const copy...
    var register = port ? READ_GPIOB_ADDR : READ_GPIOA_ADDR; //get the register to read from

    //read one byte from the right register (A or B)
    this._read(register, 1, function (err, registerValue) {
      if (err) {
        console.error(err);
        callback(_port, err, null);
      } else {
        callback(_port, null, registerValue);
      }
    });

  };

  MCP23017.prototype._initGpioA = function () {
    this._send(REGISTER_GPIOA, [this.dirAState]); //Set Direction to Output
    this._send(WRITE_GPIOA_ADDR, [this.gpioAState]); //clear all output states
  };

  MCP23017.prototype._initGpioB = function () {
    this._send(REGISTER_GPIOB, [this.dirBState]); //Set Direction to Output
    this._send(WRITE_GPIOB_ADDR, [this.gpioBState]); //clear all output states
  };

  MCP23017.prototype._send = function (cmd, values) {
    var buff = Buffer.from(values);
    this.wire.writeI2cBlockSync(this.address,cmd,buff.length,buff);
  };

  MCP23017.prototype._read = function (cmd, length, callback) {
    var buff = Buffer.alloc(length);
    this.wire.readI2cBlock(this.address,cmd,length,buff,function (err, bytesRead, buffer) {
        if (err) {
          console.error(err);
          callback(err, null);
        } else {
          callback(null, buffer[0]);
        }
    });
  };

  MCP23017.prototype.log = function (msg) {
    if (this.debug) {
      console.log(msg);
    }
  };

  return MCP23017;

})();

module.exports = MCP23017;
