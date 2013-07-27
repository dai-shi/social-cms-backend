var VTEmulator = (function(){
// somewhat vt102, somewhat xterm

function boolToChar(b) {
    return b ? "T" : "F";
}

function unpack_unicode(hex) {
    return String.fromCharCode(parseInt(hex, 16));
}

function cloneObject(input, out) {
    for (var k in out)
        delete out[k];
    for (var k in input)
        out[k] = input[k];
}

function cloneArray(input, out) {
    out.splice(0, out.length);
    for (var i in input)
        out.push(input[i]);
}

function cloneArrayOfObjects(input, out) {
    out.splice(0, out.length);
    for (var i in input) {
        out[i] = { };
        for (var k in input[i])
            out[i][k] = input[i][k];
    }
}

var emu = function (opts) {
    if ( opts.change )
        this.changeCallback = opts.change;

    if ( opts.special )
        this.specialCallback = opts.special;

    if ( opts.output )
        this.outputCallback = opts.output;

    if ( opts.cursor )
        this.cursorCallback = opts.cursor;

    this.width  = opts.width  || 80;
    this.height = opts.height || 24;

    this.initialize();
};

emu.prototype = {
    initialize: function () {
        this.scr = {};
        this.scralt = {};

        // line-wide
        this.scr.lineAttr = [];
        this.scralt.lineAttr = [];

        for (var i = 0; i < this.height; i++) {
            this.scr.lineAttr.push({ width: 'normal', height: 'normal' });
            this.scralt.lineAttr.push({ width: 'normal', height: 'normal' });
        }

        // character-wide
        this.scr.c = {};
        this.scr.c.text = [];
        this.scr.c.bold = [];
        this.scr.c.underline = [];
        this.scr.c.lowintensity = [];
        this.scr.c.blink = [];
        this.scr.c.fcolor = [];
        this.scr.c.bcolor = [];

        this.scralt.c = {};
        this.scralt.c.text = [];
        this.scralt.c.bold = [];
        this.scralt.c.underline = [];
        this.scralt.c.lowintensity = [];
        this.scralt.c.blink = [];
        this.scralt.c.fcolor = [];
        this.scralt.c.bcolor = [];

        for (var i = 0; i < this.width*this.height; i++) {
            this.scr.c.text.push(' ');
            this.scr.c.bold.push(false);
            this.scr.c.underline.push(false);
            this.scr.c.lowintensity.push(true);
            this.scr.c.blink.push(false);
            this.scr.c.fcolor.push(7);
            this.scr.c.bcolor.push(0);

            this.scralt.c.text.push(' ');
            this.scralt.c.bold.push(false);
            this.scralt.c.underline.push(false);
            this.scralt.c.lowintensity.push(true);
            this.scralt.c.blink.push(false);
            this.scralt.c.fcolor.push(7);
            this.scralt.c.bcolor.push(0);
        }

        this.mode = {};
        this.mode.cursorKeyANSI = true;
        this.mode.scroll = 'jump'; // | smooth
        this.mode.reverseScreen = false;
        this.mode.originMode = 'screen'; // | marginHome
        this.mode.autoWrap = true;
        this.mode.autoRepeat = true;
        this.mode.mouseTrackingDown = false;
        this.mode.mouseTrackingUp = false;
        this.mode.currentScreen = 1;
        this.mode.keyboardLocked = false;
        this.mode.insert = false;
        this.mode.localEcho = true;
        this.mode.newLineMode = 'cr'; // | crlf

        this.cursor = {};
        this.cursor.x = 0;
        this.cursor.y = 0;
        this.cursor.bold = false;
        this.cursor.underline = false;
        this.cursor.lowintensity = true;
        this.cursor.blink = false;
        this.cursor.reversed = false; // state, fcolor and bcolor are flipped when this is
        this.cursor.invisible = false; // TODO: implement
        this.cursor.fcolor = 7;
        this.cursor.bcolor = 0;

        this.cursorStack = [];

        this.margins = {};
        this.margins.top = 0;
        this.margins.bottom = this.height-1;

        this.tabs = {};
        for (var t = 0; t < this.width; t++)
            this.tabs[t] = t % 8 == 0;

        this.windowTitle = '';
        this.iconTitle = '';

        this.charsets = {};
        this.charsets.g0 = 'us';
        this.charsets.g1 = 'line';
        this.charsets.active = 'g0';
    },

    freeze: function () {
        var ret = { scr: { lineAttr: [] }, scralt: { lineAttr: [] } };
        cloneArrayOfObjects(this.scr.lineAttr, ret.scr.lineAttr);
        cloneArrayOfObjects(this.scralt.lineAttr, ret.scralt.lineAttr);

        ret.scr.c = { text: [], bold: [], underline: [], lowintensity: [], blink: [], fcolor: [], bcolor: [] };
        cloneArray(this.scr.c.text, ret.scr.c.text);
        cloneArray(this.scr.c.bold, ret.scr.c.bold);
        cloneArray(this.scr.c.underline, ret.scr.c.underline);
        cloneArray(this.scr.c.lowintensity, ret.scr.c.lowintensity);
        cloneArray(this.scr.c.blink, ret.scr.c.blink);
        cloneArray(this.scr.c.fcolor, ret.scr.c.fcolor);
        cloneArray(this.scr.c.bcolor, ret.scr.c.bcolor);

        ret.scralt.c = { text: [], bold: [], underline: [], lowintensity: [], blink: [], fcolor: [], bcolor: [] };
        cloneArray(this.scralt.c.text, ret.scralt.c.text);
        cloneArray(this.scralt.c.bold, ret.scralt.c.bold);
        cloneArray(this.scralt.c.underline, ret.scralt.c.underline);
        cloneArray(this.scralt.c.lowintensity, ret.scralt.c.lowintensity);
        cloneArray(this.scralt.c.blink, ret.scralt.c.blink);
        cloneArray(this.scralt.c.fcolor, ret.scralt.c.fcolor);
        cloneArray(this.scralt.c.bcolor, ret.scralt.c.bcolor);

        ret.mode = { };
        cloneObject(this.mode, ret.mode);

        ret.cursor = { };
        cloneObject(this.cursor, ret.cursor);

        ret.cursorStack = [];
        cloneArrayOfObjects(this.cursorStack, ret.cursorStack);

        ret.margins = { };
        cloneObject(this.margins, ret.margins);

        ret.tabs = { };
        cloneObject(this.tabs, ret.tabs);

        ret.windowTitle = this.windowTitle;
        ret.iconTitle = this.iconTitle;

        ret.charsets = { };
        cloneObject(this.charsets, ret.charsets);

        return ret;
    },

    thaw: function (obj) {
        cloneArrayOfObjects(obj.scr.lineAttr, this.scr.lineAttr);
        cloneArrayOfObjects(obj.scralt.lineAttr, this.scralt.lineAttr);

        cloneArray(obj.scr.c.text, this.scr.c.text);
        cloneArray(obj.scr.c.bold, this.scr.c.bold);
        cloneArray(obj.scr.c.underline, this.scr.c.underline);
        cloneArray(obj.scr.c.lowintensity, this.scr.c.lowintensity);
        cloneArray(obj.scr.c.blink, this.scr.c.blink);
        cloneArray(obj.scr.c.fcolor, this.scr.c.fcolor);
        cloneArray(obj.scr.c.bcolor, this.scr.c.bcolor);

        cloneArray(obj.scralt.c.text, this.scralt.c.text);
        cloneArray(obj.scralt.c.bold, this.scralt.c.bold);
        cloneArray(obj.scralt.c.underline, this.scralt.c.underline);
        cloneArray(obj.scralt.c.lowintensity, this.scralt.c.lowintensity);
        cloneArray(obj.scralt.c.blink, this.scralt.c.blink);
        cloneArray(obj.scralt.c.fcolor, this.scralt.c.fcolor);
        cloneArray(obj.scralt.c.bcolor, this.scralt.c.bcolor);

        cloneObject(obj.mode, this.mode);

        cloneObject(obj.cursor, this.cursor);

        cloneArrayOfObjects(obj.cursorStack, this.cursorStack);

        cloneObject(obj.margins, this.margins);

        cloneObject(obj.tabs, this.tabs);

        this.windowTitle = obj.windowTitle;
        this.iconTitle   = obj.iconTitle;

        cloneObject(obj.charsets, this.charsets);

        this.postSpecial({ 'thaw': 'thaw' });
    },

    charmap: {
        us: { }, // not existing implies consistent with unicode
        uk: {
            '#': unpack_unicode("A3"), // pound symbol
        },
        line: {
            '_': ' ',
            '`': unpack_unicode("2666"), // diamond
            'a': unpack_unicode("2591"), // checkerboard
            'b': unpack_unicode("2409"), // HT
            'c': unpack_unicode("240C"), // FF
            'd': unpack_unicode("240D"), // CR
            'e': unpack_unicode("240A"), // LF
            'f': unpack_unicode("B0"),   // degree symbol
            'g': unpack_unicode("B1"),   // plusminus
            'h': unpack_unicode("2424"), // NL
            'i': unpack_unicode("240B"), // VT
            'j': unpack_unicode("2518"), // corner lr
            'k': unpack_unicode("2510"), // corner ur
            'l': unpack_unicode("250C"), // corner ul
            'm': unpack_unicode("2514"), // corner ll
            'n': unpack_unicode("253C"), // meeting +
            //'o': unpack_unicode(""),   // scan 1 horizontal
            //'p': unpack_unicode(""),   // scan 3 horizontal
            'q': unpack_unicode("2500"), // scan 5 horizontal
            //'r': unpack_unicode(""),   // scan 7 horizontal
            //'s': unpack_unicode(""),   // scan 9 horizontal
            't': unpack_unicode("2524"), // vertical meet right
            'u': unpack_unicode("251C"), // vertical meet left
            'v': unpack_unicode("2534"), // horizontal meet top
            'w': unpack_unicode("252C"), // horizontal meet bottom
            'x': unpack_unicode("2502"), // vertical bar
            'y': unpack_unicode("2264"), // less than or equal to
            'z': unpack_unicode("2265"), // greater than or equal to
            '{': unpack_unicode("3C0"),  // pi
            '|': unpack_unicode("2260"), // not equal to
            '}': unpack_unicode("A3"),   // pound symbol
            '~': unpack_unicode("B7"),   // center dot
        },
    },

    postChange: function (y, minx, maxx) {
        if ( this.changeCallback )
            this.changeCallback(y, minx, maxx);
    },

    postSpecial: function (obj) {
        if ( this.specialCallback )
            this.specialCallback(obj);
    },

    postCursor: function () {
        if ( this.cursorCallback )
            this.cursorCallback(this.cursor.x, this.cursor.y);
    },

    ev_setWindowTitle: function (title) {
        this.windowTitle = title;
        this.postSpecial({ title: title });
    },

    ev_setIconTitle: function (title) {
        this.iconTitle = title;
        this.postSpecial({ title: title });
    },

    ev_setWindowIconTitle: function (title) {
        this.ev_setWindowTitle(title);
        this.ev_setIconTitle(title);
    },

    ev_resetMargins: function () {
        this.ev_setMargins(1,this.height);
    },

    ev_setMargins: function (top, bottom) {
        top -= 1;
        bottom -= 1;

        if ( top+1 >= bottom ) top = bottom-1;

        if ( top < 0 ) top = 0;
        if ( top > this.height-2 ) top = this.height-2;
        if ( bottom < 1 ) bottom = 1;
        if ( bottom > this.height-1 ) bottom = this.height-1;

        if ( top+1 >= bottom )
            throw "numbers do not obey the laws of arithmetic in setMargins";

        this.margins.top = top;
        this.margins.bottom = bottom;

        this.ev_goto('home');
    },

    ev_cursorStack: function (action) {
        if ( action == 'push' ) {
            this.cursorStack.push({
                    x: this.cursor.x,
                    y: this.cursor.y,
                    bold: this.cursor.bold,
                    underline: this.cursor.underline,
                    lowintensity: this.cursor.lowintensity,
                    blink: this.cursor.blink,
                    reversed: this.cursor.reversed,
                    invisible: this.cursor.invisible,
                    fcolor: this.cursor.fcolor,
                    bcolor: this.cursor.bcolor
                });

        } else if ( action == 'pop' ) {
            if ( this.cursorStack.length > 0 )
                this.cursor = this.cursorStack.pop();
            this.postCursor();

        } else {
            throw "Can't do cursorStack action "+action;
        }
    },

    ev_setAttribute: function (attr) {
        if ( attr == 0 ) {
            this.cursor.bold = false;
            this.cursor.underline = false;
            this.cursor.lowintensity = true;
            this.cursor.blink = false;
            this.cursor.reversed = false;
            this.cursor.invisible = false;
            this.cursor.fcolor = 7;
            this.cursor.bcolor = 0;
        } else if ( attr == 1 || attr == 21 ) {
            this.cursor.bold = attr == 1;
        } else if ( attr == 2 || attr == 22 ) {
            this.cursor.lowintensity = attr == 2;
        } else if ( attr == 4 || attr == 24 ) {
            this.cursor.underline = attr == 4;
        } else if ( attr == 5 || attr == 25 ) {
            this.cursor.blink = attr == 5;
        } else if ( attr == 7 || attr == 27 ) {
            if ( (this.cursor.reversed && attr == 7) || (!this.cursor.reversed && attr == 27) ) {
                // do nothing
            } else {
                var b = this.cursor.fcolor;
                var f = this.cursor.bcolor;
                this.cursor.fcolor = f;
                this.cursor.bcolor = b;
                this.cursor.reversed = attr == 7;
            }
        } else if ( attr == 8 || attr == 28 ) {
            this.cursor.invisible = attr == 8;
        } else if ( attr >= 30 && attr < 40 ) {
            this.cursor.fcolor = attr-30;
        } else if ( attr >= 40 && attr <= 49 ) {
            this.cursor.bcolor = attr-40;
        } else {
            console.log("Warning: ignoring setAttribute(" + attr + ")");
        }
    },

    ev_normalString: function (str) {
        for (var i = 0; i < str.length; i++)
            this.ev_normalChar(str[i]);
    },

    ev_normalChar: function (ch) {
        // charmapping
        if ( this.charsets.active &&
                this.charsets[this.charsets.active] &&
                this.charmap[this.charsets[this.charsets.active]] &&
                this.charmap[this.charsets[this.charsets.active]][ch] )
            ch = this.charmap[this.charsets[this.charsets.active]][ch];

        // wrapping
        if ( this.cursor.x == this.width ) {
            // cursor is on the margin, we can't put a character there
            if ( this.mode.autoWrap ) {
                var b = this.mode.originMode == 'screen' ? this.height : this.margins.bottom+1;
                this.cursor.x = 0;
                this.cursor.y++;
                if ( this.cursor.y >= b ) {
                    this.scroll(1);
                    this.cursor.y = b-1;
                }
            } else {
                // temporarily
                this.cursor.x--;
            }
        }

        // put on screen
        if ( this.mode.insert ) {
            // this.scr.c.*;
            var idx = this.cursor.x + this.cursor.y * this.width;
            var rmidx = (this.cursor.y+1) * this.width;
            this.scr.c.text.splice(idx, 0, ch);
            this.scr.c.text.splice(rmidx, 1);
            this.scr.c.bold.splice(idx, 0, this.cursor.bold);
            this.scr.c.bold.splice(rmidx, 1);
            this.scr.c.underline.splice(idx, 0, this.cursor.underline);
            this.scr.c.underline.splice(rmidx, 1);
            this.scr.c.lowintensity.splice(idx, 0, this.cursor.lowintensity);
            this.scr.c.lowintensity.splice(rmidx, 1);
            this.scr.c.blink.splice(idx, 0, this.cursor.blink);
            this.scr.c.blink.splice(rmidx, 1);
            this.scr.c.fcolor.splice(idx, 0, this.cursor.fcolor);
            this.scr.c.fcolor.splice(rmidx, 1);
            this.scr.c.bcolor.splice(idx, 0, this.cursor.bcolor);
            this.scr.c.bcolor.splice(rmidx, 1);
            
            this.postChange(this.cursor.y, this.cursor.x, this.width-1);
        } else {
            // not this.mode.insert -> replace

            this.putChar('set', this.cursor.x, this.cursor.y,
                    ch,
                    this.cursor.bold,
                    this.cursor.underline,
                    this.cursor.lowintensity,
                    this.cursor.blink,
                    this.cursor.fcolor,
                    this.cursor.bcolor);

            this.postChange(this.cursor.y, this.cursor.x, this.cursor.x);
        }

        // stepping
        this.cursor.x++;
        this.postCursor();
    },
    
    ev_specialChar: function (key) {
        switch (key) {
            case 'carriageReturn':
                this.cursor.x = 0;
                this.postCursor();
                break;

            case 'backspace':
                this.cursor.x--;
                if ( this.cursor.x < 0 )
                    this.cursor.x = 0;
                this.postCursor();
                break;

            case 'lineFeed':
            case 'formFeed':
            case 'verticalTab':
                this.cursor.y++;
                if ( this.cursor.y == this.margins.bottom+1 ) {
                    this.scroll(1);
                    this.cursor.y = this.margins.bottom;
                }
                if ( this.cursor.y >= this.height ) {
                    this.cursor.y = this.height-1;
                }
                if ( this.mode.newLineMode == 'crlf' )
                    this.cursor.x = 0;
                this.postCursor();
                break;

            case 'horizontalTab':
                do {
                    this.cursor.x++;
                } while ( this.cursor.x < this.width && !this.tabs[this.cursor.x] );
                this.postCursor();
                break;

            case 'bell':
                this.postSpecial({ 'bell': 'bell' });
                break;

            default:
                console.log("Warning: skipping specialChar event for key "+key);
        }
    },

    ev_arrow: function (dir, count) {
        var t = this.mode.originMode == 'screen' ? 0 : this.margins.top;
        var b = this.mode.originMode == 'screen' ? this.height : this.margins.bottom+1;
        switch ( dir ) {
            case 'up':
                this.cursor.y -= count;
                if ( this.cursor.y < t )
                    this.cursor.y = t;
                this.postCursor();
                break;

            case 'down':
                this.cursor.y += count;
                if ( this.cursor.y >= b )
                    this.cursor.y = b-1;
                this.postCursor();
                break;

            case 'left':
                this.cursor.x -= count;
                if ( this.cursor.x < 0 )
                    this.cursor.x = 0;
                this.postCursor();
                break;

            case 'right':
                this.cursor.x += count;
                if ( this.cursor.x >= this.width )
                    this.cursor.x = this.width-1;
                this.postCursor();
                break;

            default:
                throw "Can't handle arrow event with direction "+dir;
        }
    },

    ev_deleteChars: function (count) {
        var rmidx = this.cursor.x + this.cursor.y * this.width;
        var insidx = (this.cursor.y + 1) * this.width - 2;
        for (var i = 0; i < count; i++) {
            this.scr.c.text.splice(rmidx, 1);
            this.scr.c.text.splice(insidx, 0, ' ');
            this.scr.c.bold.splice(rmidx, 1);
            this.scr.c.bold.splice(insidx, 0, false);
            this.scr.c.underline.splice(rmidx, 1);
            this.scr.c.underline.splice(insidx, 0, false);
            this.scr.c.lowintensity.splice(rmidx, 1);
            this.scr.c.lowintensity.splice(insidx, 0, false);
            this.scr.c.blink.splice(rmidx, 1);
            this.scr.c.blink.splice(insidx, 0, false);
            this.scr.c.fcolor.splice(rmidx, 1);
            this.scr.c.fcolor.splice(insidx, 0, 7);
            this.scr.c.bcolor.splice(rmidx, 1);
            this.scr.c.bcolor.splice(insidx, 0, 0);
        }
        this.postChange(this.cursor.y, this.cursor.x, this.width-1);
    },

    ev_deleteLines: function (count) {
        if ( this.cursor.y > this.margins.bottom ) return;
        if ( this.cursor.y < this.margins.top ) return;

        for (var i = 0; i < count; i++) {
            for (var y = this.cursor.y; y < this.margins.bottom; y++)
                for (var x = 0; x < this.width; x++) {
                    var fromIdx = x + (y+1)*this.width;
                    this.putChar('set', x, y,
                            this.scr.c.text[fromIdx],
                            this.scr.c.bold[fromIdx],
                            this.scr.c.underline[fromIdx],
                            this.scr.c.lowintensity[fromIdx],
                            this.scr.c.blink[fromIdx],
                            this.scr.c.fcolor[fromIdx],
                            this.scr.c.bcolor[fromIdx]
                       );
                }

            for (var x = 0; x < this.width; x++)
                this.scr.c.text[this.margins.bottom*this.width + x] = ' ';

            this.scr.lineAttr.splice(this.margins.bottom, 0, {
                    width: this.scr.lineAttr[this.margins.bottom-1].width,
                    height: this.scr.lineAttr[this.margins.bottom-1].height
                });
            this.scr.lineAttr.splice(this.cursor.y, 1);
        }

        for (var y = this.cursor.y; y <= this.margins.bottom; y++)
            this.postChange(y, 0, this.width-1);
    },

    ev_insertLines: function (count) {
        if ( this.cursor.y > this.margins.bottom ) return;
        if ( this.cursor.y < this.margins.top ) return;

        for (var i = 0; i < count; i++) {
            for (var y = this.margins.bottom; y > this.cursor.y; y--)
                for (var x = 0; x < this.width; x++) {
                    var fromIdx = x + (y-1)*this.width;
                    this.putChar('set', x, y,
                            this.scr.c.text[fromIdx],
                            this.scr.c.bold[fromIdx],
                            this.scr.c.underline[fromIdx],
                            this.scr.c.lowintensity[fromIdx],
                            this.scr.c.blink[fromIdx],
                            this.scr.c.fcolor[fromIdx],
                            this.scr.c.bcolor[fromIdx]
                       );
                }

            for (var x = 0; x < this.width; x++)
                this.putChar('set', x, this.cursor.y, ' ', false, false, true, false, 7, 0);

            this.scr.lineAttr.splice(this.margins.bottom, 1);
            this.scr.lineAttr.splice(this.cursor.y, 0, { width: 'normal', height: 'normal' });
        }

        for (var y = this.cursor.y; y <= this.margins.bottom; y++)
            this.postChange(y, 0, this.width-1);
    },

    ev_index: function (how) {
        switch (how) {
            case 'down':
                if ( this.cursor.y == this.margins.bottom ) {
                    this.scroll(1);
                } else {
                    this.cursor.y++;
                    this.postCursor();
                }
                break;

            case 'up':
                if ( this.cursor.y == this.margins.top ) {
                    this.scroll(-1);
                } else {
                    this.cursor.y--;
                    this.postCursor();
                }
                break;

            case 'nextLine':
                this.ev_index('down');
                this.cursor.x = 0;
                this.postCursor();
                break;

            default:
                throw "Can't index with method "+how;
        }
    },

    ev_originMode: function (mode) {
        this.mode.originMode = mode;
        this.ev_goto('home');
    },

    ev_mode: function (key, value) {
        switch ( key ) {
            case 'insert':
            case 'cursorKeyANSI':
            case 'keypad':
            case 'mouseTrackingUp':
            case 'mouseTrackingDown':
            case 'autoWrap':
            case 'scroll':
                this.mode[key] = value;
                var modeset = {};
                modeset[key] = value;
                this.postSpecial({ 'mode': modeset });
                break;

            case 'currentScreen':
                var old = this.mode.currentScreen;
                if ( old != value ) {
                    var newscr = this.scralt;
                    var newscralt = this.scr;
                    this.scr = newscr;
                    this.newscralt = newscralt;
                    this.mode.currentScreen = value;
                }
                for (var y = 0; y < this.height; y++)
                    this.postChange(y, 0, this.width-1);
                break;

            default:
                console.log("Warning: can't handle mode change '"+key+"' to '"+value+"'");
        }
    },

    ev_eraseInLine: function (how) {
        switch (how) {
            case 'toEnd':
                for (var x = this.cursor.x; x < this.width; x++)
                    this.putChar('set', x, this.cursor.y, ' ', false, false, true, false, 7, 0);
                this.postChange(this.cursor.y, this.cursor.x, this.width-1);
                break;

            case 'toStart':
                for (var x = this.cursor.x; x >= 0; x--)
                    this.putChar('set', x, this.cursor.y, ' ', false, false, true, false, 7, 0);
                this.postChange(this.cursor.y, 0, this.cursor.x);
                break;

            case 'whole':
                for (var x = 0; x < this.width; x++)
                    this.putChar('set', x, this.cursor.y, ' ', false, false, true, false, 7, 0);
                this.postChange(this.cursor.y, 0, this.width-1);
                break;

            default:
                throw "Can't eraseInLine with method '" + how + "'";
        }
    },

    ev_eraseInDisplay: function (how) {
        switch (how) {
            case 'toEnd':
                this.ev_eraseInLine('toEnd');
                for (var y = this.cursor.y+1; y < this.height; y++) {
                    for (var x = 0; x < this.width; x++)
                        this.putChar('set', x, y, ' ', false, false, true, false, 7, 0);
                    this.scr.lineAttr.splice(y, 1, { width: 'normal', height: 'normal' });
                }
                for (var y = this.cursor.y+1; y < this.height; y++)
                    this.postChange(y, 0, this.width-1);
                break;

            case 'toStart':
                this.ev_eraseInLine('toStart');
                for (var y = this.cursor.y-1; y >= 0; y--) {
                    for (var x = 0; x < this.width; x++)
                        this.putChar('set', x, y, ' ', false, false, true, false, 7, 0);
                    this.scr.lineAttr.splice(y, 1, { width: 'normal', height: 'normal' });
                }
                for (var y = this.cursor.y-1; y >= 0; y--)
                    this.postChange(y, 0, this.width-1);
                break;

            case 'whole':
                for (var y = 0; y < this.height; y++) {
                    for (var x = 0; x < this.width; x++)
                        this.putChar('set', x, y, ' ', false, false, true, false, 7, 0);
                    this.scr.lineAttr.splice(y, 1, { width: 'normal', height: 'normal' });
                }
                for (var y = 0; y < this.height; y++)
                    this.postChange(y, 0, this.width-1);
                break;

            default:
                throw "Can't eraseInDisplay with method '" + how + "'";
        }
    },

    ev_goto: function (to) {
        var x,y;
        if ( to == 'home' ) {
            x = y = 0;
        } else {
            x = to[0]-1;
            y = to[1]-1;
        }

        if ( x < 0 ) x = 0;
        if ( x > this.width ) x = this.width;

        if ( this.mode.originMode == 'screen' ) {
            if ( y < 0 ) y = 0;
            if ( y >= this.height ) y = this.height-1;

        } else { // originMode margin
            if ( y < 0 ) y = 0;
            y += this.margins.top;
            if ( y > this.margins.bottom ) y = this.margins.bottom;
        }

        this.cursor.x = x;
        this.cursor.y = y;

        this.postCursor();
    },

    ev_report: function (type) {
        switch (type) {
            case 'status':
            case 'printer':
            case 'cursorPosition':
            case 'deviceAttributes':
            case 'versionString':
                // TODO
                break;

            default:
                throw "Can't handle report type "+type;
        }
    },

    ev_charset: function (action, which, target) {
        if ( action == 'switch' ) {
            this.charsets.active = which;
        } else if ( action == 'set' ) {
            this.charsets[which] = target;
        } else {
            throw "Can't handle charset action " + action;
        }
    },

    putChar: function (how, x, y, text, bold, underline, lowintensity, blink, fcolor, bcolor) {
        var idx = x + y * this.width;

        if ( how == 'set' ) {
            this.scr.c.text.splice(idx, 1, text);
            this.scr.c.bold.splice(idx, 1, bold);
            this.scr.c.underline.splice(idx, 1, underline);
            this.scr.c.lowintensity.splice(idx, 1, lowintensity);
            this.scr.c.blink.splice(idx, 1, blink);
            this.scr.c.fcolor.splice(idx, 1, fcolor);
            this.scr.c.bcolor.splice(idx, 1, bcolor);
        } else {
            throw "Can't putChar with method " + how;
        }
    },

    scroll: function (lines) {
        var rmidxline, insidxline;

        if ( lines > 0 ) {
            rmidxline = this.margins.top;
            insidxline = this.margins.bottom;
        } else if ( lines < 0 ) {
            rmidxline = this.margins.bottom;
            insidxline = this.margins.top;
        } else {
            return; // lines == 0 or NaN
        }

        var rmidx = this.width * rmidxline;
        var insidx = this.width * insidxline;

        for (var i = 0; i < Math.abs(lines); i++) {
            var obj = {};
            obj.text         = this.scr.c.text.splice(rmidx, this.width).join('');
            obj.bold         = this.scr.c.bold.splice(rmidx, this.width).map(boolToChar).join('');
            obj.underline    = this.scr.c.underline.splice(rmidx, this.width).map(boolToChar).join('');
            obj.lowintensity = this.scr.c.lowintensity.splice(rmidx, this.width).map(boolToChar).join('');
            obj.blink        = this.scr.c.blink.splice(rmidx, this.width).map(boolToChar).join('');
            obj.fcolor       = this.scr.c.fcolor.splice(rmidx, this.width).join('');
            obj.bcolor       = this.scr.c.bcolor.splice(rmidx, this.width).join('');
            obj.lineAttr     = this.scr.lineAttr.splice(rmidxline, 1);
            this.postSpecial({ 'scrollLine': obj, direction: lines/Math.abs(lines) });

            for (var j = 0; j < this.width; j++) {
                this.scr.c.text.splice(insidx, 0, ' ');
                this.scr.c.bold.splice(insidx, 0, false);
                this.scr.c.underline.splice(insidx, 0, false);
                this.scr.c.lowintensity.splice(insidx, 0, true);
                this.scr.c.blink.splice(insidx, 0, false);
                this.scr.c.fcolor.splice(insidx, 0, 7);
                this.scr.c.bcolor.splice(insidx, 0, 0);
            }
            this.scr.lineAttr.splice(insidxline, 0, { width: 'normal', height: 'normal' });
        }

        for (var y = this.margins.top; y <= this.margins.bottom; y++)
            this.postChange(y, 0, this.width-1);
    },

    handleEventDirect: function () {
        this.handleEvent(Array.prototype.slice.call(arguments));
    },

    handleEvent: function (evt) {
        var fn = this["ev_" + evt[0]];
        if ( !fn ) {
            console.log("Warning: can't handle event type " + evt[0]);
        } else {
            fn.apply(this, evt.slice(1));
        }
    },
};

return emu;
})();

if ( typeof(exports) != 'undefined' )
    exports.VTEmulator = VTEmulator;

