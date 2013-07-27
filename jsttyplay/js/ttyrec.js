function getLE32(buf, pos) {
    return ((buf[pos+3]*256 + buf[pos+2])*256 + buf[pos+1])*256 + buf[pos];
};

// contents is a Buffer
exports.TTYRecParse = function (contents) {
    var out = [];

    var pos = 0;
    while ( pos < contents.length ) {
        var  sec = getLE32(contents, pos); pos += 4;
        var usec = getLE32(contents, pos); pos += 4;
        var  len = getLE32(contents, pos); pos += 4;

        var data = new Buffer(len);
        contents.copy(data, 0, pos, pos+len);
        pos += len;

        out.push({ time: sec + usec/1000000, data: data });
    }

    return out;
};

