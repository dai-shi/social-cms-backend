var ttyrec     = require("./ttyrec").TTYRecParse,
    VTParser   = require("./vt/parse").VTParser,
    VTEmulator = require("./vt/emulate").VTEmulator,
    fs         = require('fs');

var filename = process.argv[2];

var emu = new VTEmulator({});
var parser = VTParser(emu.handleEventDirect.bind(emu));

console.log("\033[2J\033[H");

fs.readFile(filename, function (err, data) {
        if ( err ) throw err;
        data = ttyrec(data);
        var timer = setInterval(function () {
            if ( !data.length ) {
                clearInterval(timer);
                return;
            }

            var record = data.shift();

            console.log("\033[Hat " + record.time);

            parser(record.data);

            var str = '';
            for (var i = 0; i < emu.height; i++) {
                str += emu.scr.c.text.slice(i*emu.width, (i+1)*emu.width).join('');
                str += "|\n";
            }
            console.log(str);

            //console.log("for handling " + JSON.stringify(record.data.toString()));
        }, 50);
    });

