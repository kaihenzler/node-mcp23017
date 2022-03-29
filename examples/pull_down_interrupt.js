var MCP23017 = require('node-mcp23017');
var gpio = require('onoff').Gpio, // May need to install onoff
    intAB = new gpio(17, 'in', 'rising');

var mcp = new MCP23017({
  address: 0x20, //all address pins pulled low
  device: 1, // Model 1B or 2 and newer
  debug: false
});

mcp.pinMode(0, mcp.INPUT_PULLUP);
mcp.pinMode(1, mcp.INPUT_PULLUP);
mcp.pinMode(2, mcp.INPUT_PULLUP);
mcp.pinMode(3, mcp.INPUT_PULLUP);
mcp.pinMode(4, mcp.INPUT_PULLUP);
mcp.pinMode(5, mcp.INPUT_PULLUP);
mcp.pinMode(6, mcp.INPUT_PULLUP);
mcp.pinMode(7, mcp.INPUT_PULLUP);
mcp.pinMode(8, mcp.INPUT_PULLUP);
mcp.pinMode(9, mcp.INPUT_PULLUP);
mcp.pinMode(10, mcp.INPUT_PULLUP);
mcp.pinMode(11, mcp.INPUT_PULLUP);
mcp.pinMode(12, mcp.INPUT_PULLUP);
mcp.pinMode(13, mcp.INPUT_PULLUP);
mcp.pinMode(14, mcp.INPUT_PULLUP);
mcp.pinMode(15, mcp.INPUT); // this one should float from time to time

for (int i = 0; i < 16; i++) {
    mcp.attachInterrupt(i, mcp.FALLING);
}
mcp.interruptMode(true, mcp.ACTIVE_HIGH); //Configure A and B to trigger the INT output together
// ACTIVE_HIGH/LOW removes the need to configure a Pull-Up as overlay in config.txt
// OPEN_DRAIN however would require this.

intAB.watch((err, value) => {
    if (err) {
        throw err;
    }
    // Read both interrupt registers to clear the interrupt and check which pin caused the interrupt.
    // This will only give you the int value, so 8 equals pin 4 (0b00001000).
    // In rare cases you might encounter multiple pins triggering, like "5" => pin 1 and 3
    mcp.getInterruptCause(0, function (err, value) {
        if (value != 0) {
            console.log("Pull down on A: bits " + value);
        }
    });
    mcp.getInterruptCause(1, function (err, value) {
        if (value != 0) {
            console.log("Pull down on B: bits " + value);
        }
    });
});
