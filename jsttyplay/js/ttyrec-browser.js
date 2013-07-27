function fixHighCharCodes(data) {
    var ch = [];
    for (var i = 0; i < data.length; i++)
        ch.push( String.fromCharCode( data.charCodeAt(i) & 0xff ) );
    return ch.join('');
}

// contents is a string
TTYRecParse = function (contents) {
    var out = [];

    var pos = 0;
    while ( pos < contents.length ) {
        var  sec = r_uint32le(contents, pos); pos += 4;
        var usec = r_uint32le(contents, pos); pos += 4;
        var  len = r_uint32le(contents, pos); pos += 4;

        var data = contents.substr(pos, len); pos += len;
        for (var i = 0; i < len; i++)
            if ( data.charCodeAt(i) > 255 ) {
                data = fixHighCharCodes(data);
                break;
            }

        out.push({ time: sec + usec/1000000, data: data });
    }

    return out;
};

