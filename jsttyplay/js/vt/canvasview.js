var VTCanvasView = (function(){
    var lowColors = ['0,0,0', '192,0,0', '0,192,0', '192,192,0', '0,0,192', '192,0,192', '0,192,192', '192,192,192'];
    var hiColors  = ['0,0,0', '255,0,0', '0,255,0', '255,255,0', '0,0,255', '255,0,255', '0,255,255', '255,255,255'];

    var cloneArray = function (arr) {
        var out = [];
        for (var i in arr)
            out.push(arr[i]);
        return out;
    };

    return function (cv, opts) {
        var s = this;

        if ( !(cv instanceof HTMLCanvasElement) )
            throw "First argument to VTCanvasView constructor must be an HTMLCanvasElement (was "+cv+")";

        s.lowColors  = cloneArray(lowColors);
        s.hiColors   = cloneArray(hiColors);
        s.fontName   = 'qemu-vgafont';
        s.onReady    = [];
        s.autoResize = true;

        s.cv = cv;

        if ( opts.fontName   ) s.fontName   = opts.fontName;
        if ( opts.autoResize ) s.autoResize = opts.autoResize;
        if ( opts.onReady    ) s.onReady.push(opts.onReady);
        
        s.cursor = {
                cur:   { x: 0, y: 0 },
                drawn: { x: 0, y: 0 }
            };

        s.emu = new VTEmulator({
                change: function (y, minx, maxx) {
                        s.makeSpanDirty(y, minx, maxx);
                    },
                cursor: function (x, y) {
                        if ( x >= s.emu.width ) x = s.emu.width - 1;
                        s.cursor.cur.x = x;
                        s.cursor.cur.y = y;
                    },
                special: function (obj) {
                        if ( obj.thaw ) {
                            for (var y = 0; y < s.emu.height; y++)
                                s.makeSpanDirty(y, 0, s.emu.width-1);
                            s.cursor.cur.x = s.emu.cursor.x;
                            s.cursor.cur.y = s.emu.cursor.y;
                        }
                    },
            });

        s.parser = new VTParser(function () {
                s.emu.handleEvent(Array.prototype.slice.call(arguments));
            });

        s.dirtySpans = [];
        for (var y = 0; y < s.emu.height; y++)
            s.dirtySpans[y] = { min: 0, max: s.emu.width-1 };

        // this callback may be called immediately, so we must make sure
        // everything is set up for it beforehand
        VTFont.open(s.fontName, function (f) {
                s.font = f;
                s.readyCheck();
            });
    };
})();

VTCanvasView.prototype.freeze = function () {
    return {
        emulator: this.emu.freeze(),
        parser: this.parser.freeze()
    };
};

VTCanvasView.prototype.thaw = function (obj) {
    this.emu.thaw(obj.emulator);
    this.parser.thaw(obj.parser);
};

VTCanvasView.prototype.parseData = function (data) {
    this.parser.parse(data);
};

VTCanvasView.prototype.makeSpanDirty = function (y, minx, maxx) {
    if ( y >= this.emu.height || minx < 0 || maxx >= this.emu.width )
        throw "argh";
    var s = this.dirtySpans[y];
    if ( s.min > minx ) s.min = minx;
    if ( s.max < maxx ) s.max = maxx;
}

VTCanvasView.prototype.dirtyMovedCursor = function () {
    var c = this.cursor;
    if ( c.cur.x != c.drawn.x || c.cur.y != c.drawn.y ) {
        this.makeSpanDirty(c.cur.y,   c.cur.x,   c.cur.x);
        this.makeSpanDirty(c.drawn.y, c.drawn.x, c.drawn.x);
        c.drawn.x = c.cur.x;
        c.drawn.y = c.cur.y;
    }
};

VTCanvasView.prototype.draw = function () {
    this.dirtyMovedCursor();

    var ctx = this.cv.getContext('2d');
                
    var cw = this.font.charWidth;
    var ch = this.font.charHeight;

    for (var y = 0; y < this.emu.height; y++) {
        var span = this.dirtySpans[y];
        for (var x = span.min; x <= span.max; x++) {
            var idx = y*this.emu.width+x;

            var bg = this.lowColors[this.emu.scr.c.bcolor[idx]];
            var fg = (this.emu.scr.c.lowintensity[idx] ? this.lowColors : this.hiColors)[this.emu.scr.c.fcolor[idx]];
            var c = this.emu.scr.c.text[idx];

            if ( this.cursor.cur.x == x && this.cursor.cur.y == y ) {
                var nbg = fg;
                var nfg = bg;
                fg = nfg;
                bg = nbg;
            }

            this.font.drawChar(ctx, c, x*cw, y*ch, fg, bg);
        }
        span.min = this.emu.width-1;
        span.max = 0;
    }
}

VTCanvasView.prototype.readyCheck = function () {
    if ( this.font )
        this.ready();
};

VTCanvasView.prototype.ready = function () {
    if ( this.autoResize ) {
        this.cv.setAttribute('width',  this.emu.width  * this.font.charWidth);
        this.cv.setAttribute('height', this.emu.height * this.font.charHeight);
    }
    this.onReady.forEach(function (fn) {
            fn();
        });
    this.draw();
};

