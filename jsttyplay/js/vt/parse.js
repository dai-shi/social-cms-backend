// todo:
// vt102 printing (vt102 user guide, chapter 5, "printing")
var VTParser = (function(){
    var warnDefault = function (msg) {
        console.log(msg);
    };

    return function (term_cb, warn) {
        if ( !warn ) warn = warnDefault;

        this.cb = term_cb;
        this.warn = warn;
        this.buffer = '';
    };
})();

VTParser.prototype = {
    parse: function (str) {
        this.buffer += str;
        while ( this.handleBuffer() ) ;
        if ( this.buffer.length > 1024 )
            throw "Appear to be stuck at: " + JSON.stringify(this.buffer.toString());
    },

    freeze: function () {
        return { buffer: this.buffer };
    },

    thaw: function (obj) {
        this.buffer = obj.buffer;
    },

    handleBuffer: function () {
        var fn;
        var match;
        var re;

        var me = this;

        this.handlables.forEach(function (s) {
                var m = s[0].exec(me.buffer);
                if ( m && m[0].length > 0 ) {
                    if ( !match || m[0].length < match[0].length ) {
                        match = m;
                        fn = s[1];
                        re = s[0];
                    }
                }
            });

        if ( !match ) return false;

        //console.log("matched /" + re.source + "/" + " for nibbling of " + JSON.stringify(match[0]));

        var nibble_len = match[0].length;
        fn.call(this, match);
        this.buffer = this.buffer.substr(nibble_len);

        return true;
    },

    handlables: [
        ////////////////////////////////////////////////////////////////////////////////
        // control characters
        [/^\007/, function (m) {
            this.cb('specialChar', 'bell');
        }],
        [/^\010/, function (m) {
            this.cb('specialChar', 'backspace');
        }],
        [/^\011/, function (m) {
            this.cb('specialChar', 'horizontalTab');
        }],
        [/^\012/, function (m) {
            this.cb('specialChar', 'lineFeed');
        }],
        [/^\013/, function (m) {
            this.cb('specialChar', 'verticalTab');
        }],
        [/^\014/, function (m) {
            this.cb('specialChar', 'formFeed');
        }],
        [/^\015/, function (m) {
            this.cb('specialChar', 'carriageReturn');
        }],
        [/^\016/, function (m) {
            this.cb('charset', 'switch', 'g1');
        }],
        [/^\017/, function (m) {
            this.cb('charset', 'switch', 'g0');
        }],

        ////////////////////////////////////////////////////////////////////////////////
        // normal characters

        // ascii
        [/^[^\033\007\010\011\012\013\014\015\016\017\x80-\xFF]+/, function (m) {
            if ( /[\x80-\xFF]/.exec(m) )
                console.log("low byte regex matched high bytes");
            this.cb('normalString', m[0]);
        }],

        // utf-8
        [/^[\xC2\xDF][\x80-\xBF]/, function (m) {
            var p1 = m[0].charCodeAt(0)-192;
            var p2 = m[0].charCodeAt(1)-128;
            var code = p1*64 + p2;
            //console.log("utf-8 2 byte sequence for " + code);
            this.cb('normalString', String.fromCharCode(code));
        }],
        [/^(\xE0[\xA0-\xBF]|[\xE1-\xEC][\x80-\xBF]|\xED[\x80-\x9F]|[\xEE-\xEF][\x80-\xBF])[\x80-\xBF]/, function (m) {
            var p1 = m[0].charCodeAt(0)-224;
            var p2 = m[0].charCodeAt(1)-128;
            var p3 = m[0].charCodeAt(2)-128;
            var code = (p1*64 + p2)*64 + p3;
            //console.log("utf-8 3 byte sequence for " + code);
            this.cb('normalString', String.fromCharCode(code));
        }],
        [/^(\xF0[\x90-\xBF]|[\xF1-\xF3][\x80-\xBF]|\xF4[\x80-\x8F])[\x80-\xBF][\x80-\xBF]/, function (m) {
            var p1 = m[0].charCodeAt(0)-240;
            var p2 = m[0].charCodeAt(1)-128;
            var p3 = m[0].charCodeAt(2)-128;
            var p4 = m[0].charCodeAt(3)-128;
            var code = ((p1*64 + p2)*64 + p3)*64 + p4
            //console.log("utf-8 4 byte sequence for " + code);
            this.cb('normalString', String.fromCharCode(code)); // TODO: verify that fromCharCode can handle this
        }],

        // TODO: eat malformed utf-8

        ////////////////////////////////////////////////////////////////////////////////
        // control sequences

        // arrow keys
        [/^\033\[([0-9]*)A/, function (m) {
            this.cb('arrow', 'up', parseInt(m[1] || '1', 10));
        }],
        [/^\033\[([0-9]*)B/, function (m) {
            this.cb('arrow', 'down', parseInt(m[1] || '1', 10));
        }],
        [/^\033\[([0-9]*)C/, function (m) {
            this.cb('arrow', 'right', parseInt(m[1] || '1', 10));
        }],
        [/^\033\[([0-9]*)D/, function (m) {
            this.cb('arrow', 'left', parseInt(m[1] || '1', 10));
        }],

        // cursor set position
        [/^\033\[([0-9]*);([0-9]*)[Hf]/, function (m) {
            this.cb('goto', [parseInt(m[2] || '1', 10), parseInt(m[1] || '1', 10)]);
        }],
        [/^\033\[[Hf]/, function (m) {
            this.cb('goto', 'home');
        }],

        // index and friends
        [/^\033D/, function (m) {
            this.cb('index', 'down');
        }],
        [/^\033M/, function (m) {
            this.cb('index', 'up');
        }],
        [/^\033E/, function (m) {
            this.cb('index', 'nextLine');
        }],

        // cursor save/restore
        [/^\033[7]/, function (m) {
            this.cb('cursorStack', 'push');
        }],
        [/^\033[8]/, function (m) {
            this.cb('cursorStack', 'pop');
        }],

        // keypad
        [/^\033=/, function (m) {
            this.cb('mode', 'keypad', 'cursor');
        }],
        [/^\033>/, function (m) {
            this.cb('mode', 'keypad', 'numeric');
        }],

        // character set selection
        [/^\033\(A/, function (m) {
            this.cb('charset', 'set', 'g0', 'uk');
        }],
        [/^\033\(B/, function (m) {
            this.cb('charset', 'set', 'g0', 'us');
        }],
        [/^\033\(0/, function (m) {
            this.cb('charset', 'set', 'g0', 'line');
        }],
        [/^\033\(1/, function (m) {
            this.cb('charset', 'set', 'g0', 'rom');
        }],
        [/^\033\(2/, function (m) {
            this.cb('charset', 'set', 'g0', 'romSpecial');
        }],
        [/^\033\)A/, function (m) {
            this.cb('charset', 'set', 'g1', 'uk');
        }],
        [/^\033\)B/, function (m) {
            this.cb('charset', 'set', 'g1', 'us');
        }],
        [/^\033\)0/, function (m) {
            this.cb('charset', 'set', 'g1', 'line');
        }],
        [/^\033\)1/, function (m) {
            this.cb('charset', 'set', 'g1', 'rom');
        }],
        [/^\033\)2/, function (m) {
            this.cb('charset', 'set', 'g1', 'romSpecial');
        }],

        // temporary character set
        [/^\033N(a|[^a])/, function (m) {
            this.cb('g2char', m[1]);
        }],
        [/^\033O(a|[^a])/, function (m) {
            this.cb('g3char', m[1]);
        }],

        // mode set/reset
        [/^\033\[(\??)([^\033]*?)h/, function (m) {
            var me = this;
            m[2].split(';').forEach(function (sub) {
                    me.setMode(m[1] + sub);
                });
        }],
        [/^\033\[(\??)([^\033]*?)l/, function (m) {
            var me = this;
            m[2].split(';').forEach(function (sub) {
                    me.resetMode(m[1] + sub);
                });
        }],

        // horizontal tab stops
        [/^\033H/, function (m) {
            this.cb('tabStop', 'add');
        }],
        [/^\033\[0?g/, function (m) {
            this.cb('tabStop', 'remove');
        }],
        [/^\033\[3g/, function (m) {
            this.cb('tabStop', 'clear');
        }],

        // line attributes
        [/^\033#3/, function (m) {
            this.cb('lineAttr', 'dwdhTopHalf');
        }],
        [/^\033#4/, function (m) {
            this.cb('lineAttr', 'dwdhBottomHalf');
        }],
        [/^\033#5/, function (m) {
            this.cb('lineAttr', 'swsh');
        }],
        [/^\033#6/, function (m) {
            this.cb('lineAttr', 'dwsh');
        }],

        // erase in line
        [/^\033\[0?K/, function (m) {
            this.cb('eraseInLine', 'toEnd');
        }],
        [/^\033\[1K/, function (m) {
            this.cb('eraseInLine', 'toStart');
        }],
        [/^\033\[2K/, function (m) {
            this.cb('eraseInLine', 'whole');
        }],

        // erase in display
        [/^\033\[0?J/, function (m) {
            this.cb('eraseInDisplay', 'toEnd');
        }],
        [/^\033\[1J/, function (m) {
            this.cb('eraseInDisplay', 'toStart');
        }],
        [/^\033\[2J/, function (m) {
            this.cb('eraseInDisplay', 'whole');
        }],

        // insertion and deletion
        [/^\033\[([0-9]*)P/, function (m) {
            this.cb('deleteChars', parseInt(m[1].length ? m[1] : '1', 10));
        }],
        [/^\033\[([0-9]*)L/, function (m) {
            this.cb('insertLines', parseInt(m[1].length ? m[1] : '1', 10));
        }],
        [/^\033\[([0-9]*)M/, function (m) {
            this.cb('deleteLines', parseInt(m[1].length ? m[1] : '1', 10));
        }],

        // reports
        [/^\033([0-9;?]*)n/, function (m) {
            var me = this;
            m[1].split(';').forEach(function (r) {
                    me.handleReportRequest(r);
                });
        }],
        [/^\033(\[0?c|Z)/, function (m) {
            this.cb('report', 'deviceAttributes');
        }],
        [/^\033\[>c/, function (m) {
            this.cb('report', 'versionString');
        }],

        // LEDs
        [/^\033\[([0-9;]*)q/, function (m) {
            var me = this;
            (m[1].length ? m[1] : '0').split(';').forEach(function (l) {
                    me.handleLED(l);
                });
        }],

        // xterm-style titles
        [/^\033\]2;([^\033\007]*)\007/, function (m) {
            this.cb('setWindowTitle', m[1]);
        }],
        [/^\033\]1;([^\033\007]*)\007/, function (m) {
            this.cb('setIconTitle', m[1]);
        }],
        [/^\033\]0;([^\033\007]*)\007/, function (m) {
            this.cb('setWindowIconTitle', m[1]);
        }],

        // margins
        [/^\033\[([0-9]+);([0-9]+)r/, function (m) {
            this.cb('setMargins', parseInt(m[1], 10), parseInt(m[2], 10));
        }],
        [/^\033\[r/, function (m) {
            this.cb('resetMargins');
        }],

        // reset
        [/^\033\[!p/, function (m) {
            this.cb('softReset');
        }],
        [/^\033c/, function (m) {
            this.cb('reset');
        }],

        // one-off sequences
        [/^\033\[([0-9;]*)m/, function (m) {
            var me = this;
            (m[1].length ? m[1] : "0").split(';').forEach(function (attr) {
                    me.cb('setAttribute', parseInt(attr, 10));
                });
        }],
        [/^\033\[([0-9;]*)y/, function (m) {
            this.cb('hardware', 'selfTestRaw', m[1]);
        }],
        [/^\033#8/, function (m) {
            this.cb('hardware', 'screenAlignment');
        }],
    ],

    setMode: function (mode) {
        switch (mode) {
            case '?1':
                this.cb('mode', 'cursorKeyANSI', false);
                break;

            case '?3':
                this.cb('mode', 'width', 132);
                break;

            case '?4':
                this.cb('mode', 'scroll', 'smooth');
                break;

            case '?5':
                this.cb('mode', 'reverseScreen', true);
                break;

            case '?6':
                this.cb('originMode', 'margin');
                break;

            case '?7':
                this.cb('mode', 'autoWrap', true);
                break;

            case '?8':
                this.cb('mode', 'autoRepeat', true);
                break;

            case '?9':
                this.cb('mode', 'mouseTrackingDown', true);
                break;

            case '?47':
                this.cb('mode', 'currentScreen', 0);
                break;

            case '?1000':
                this.cb('mode', 'mouseTrackingUp', true);
                break;

            case '2':
                this.cb('mode', 'keyboardLocked', true);
                break;

            case '4':
                this.cb('mode', 'insert', true);
                break;

            case '12':
                this.cb('mode', 'localEcho', false);
                break;

            case '20':
                this.cb('mode', 'newLineMode', 'crlf');
                break;

            default:
                this.warn('Unhandled set mode: "' + mode + '"');
        }
    },

    resetMode: function (mode) {
        switch (mode) {
            case '?1':
                this.cb('mode', 'cursorKeyANSI', true);
                break;

            case '?2':
                this.cb('mode', 'vt52', true);
                break;

            case '?3':
                this.cb('mode', 'width', 80);
                break;

            case '?4':
                this.cb('mode', 'scroll', 'jump');
                break;

            case '?5':
                this.cb('mode', 'reverseScreen', false);
                break;

            case '?6':
                this.cb('originMode', 'screen');
                break;

            case '?7':
                this.cb('mode', 'autoWrap', false);
                break;

            case '?8':
                this.cb('mode', 'autoRepeat', false);
                break;

            case '?9':
                this.cb('mode', 'mouseTrackingDown', false);
                break;

            case '?47':
                this.cb('mode', 'currentScreen', 1);
                break;

            case '?1000':
                this.cb('mode', 'mouseTrackingUp', false);
                break;

            case '2':
                this.cb('mode', 'keyboardLocked', false);
                break;

            case '4':
                this.cb('mode', 'insert', false);
                break;

            case '12':
                this.cb('mode', 'localEcho', true);
                break;

            case '20':
                this.cb('mode', 'newLineMode', 'cr');
                break;

            default:
                this.warn('Unhandled reset mode: "' + mode + '"');
        }
    },

    handleReportRequest: function (req) {
        switch (req) {
            case '5':
                this.cb('report', 'status');
                break;

            case '?15':
                this.cb('report', 'printer');
                break;

            case '6':
                this.cb('report', 'cursorPosition');
                break;

            default:
                this.warn('Unhandled report request: "' + req + '"');
        }
    },

    handleLED: function (led) {
        led = parseInt(led, 10);
        if ( led == 0 ) {
            this.cb('led', 'off', 'all');
        } else {
            this.cb('led', 'on', led);
        }
    },
};

if ( typeof(exports) != 'undefined' )
    exports.VTParser = VTParser;

