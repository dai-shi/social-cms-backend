function get_binary_data_sync(url) {
    var r = new XMLHttpRequest();
    r.open("GET", url, false);
    r.overrideMimeType("text/plain; charset=x-user-defined"); // thx Marcus Granado, 2006 @ mgran.blogspot.com
    r.send(null);

    if ( r.status != 200 ) {
        alert("couldn't fetch binary data from " + url + ", code " + r.status);
        return '';
    }

    return r.responseText;
}

function get_binary_data_async(url, cb) {
    var r = new XMLHttpRequest();
    r.open("GET", url, true);
    r.overrideMimeType("text/plain; charset=x-user-defined"); // thx Marcus Granado, 2006 @ mgran.blogspot.com
    r.onreadystatechange = function () {
            if ( r.readyState == 4 ) {
                if ( r.status != 200 ) {
                    cb(null, r.statusText);
                } else {
                    cb(r.responseText, null);
                }
            }
        };
    r.send(null);
}

function r_uint8(data, offset) {
    return data.charCodeAt(offset) & 0xff;
}

function r_uint16be(data, offset) {
    var h = data.charCodeAt(offset  ) & 0xff;
    var l = data.charCodeAt(offset+1) & 0xff;
    return h*256 + l;
}

function r_uint16le(data, offset) {
    var h = data.charCodeAt(offset+1) & 0xff;
    var l = data.charCodeAt(offset  ) & 0xff;
    return h*256 + l;
}

function r_uint32be(data, offset) {
    var hh = data.charCodeAt(offset  ) & 0xff;
    var hl = data.charCodeAt(offset+1) & 0xff;
    var lh = data.charCodeAt(offset+2) & 0xff;
    var ll = data.charCodeAt(offset+3) & 0xff;
    return (hh*256 + hl) * 65536 + (lh*256 + ll);
}

function r_uint32le(data, offset) {
    var hh = data.charCodeAt(offset+3) & 0xff;
    var hl = data.charCodeAt(offset+2) & 0xff;
    var lh = data.charCodeAt(offset+1) & 0xff;
    var ll = data.charCodeAt(offset  ) & 0xff;
    return (hh*256 + hl) * 65536 + (lh*256 + ll);
}

function r_uint64be(data, offset) {
    return r_uint32be(data, offset)*65536*65536 + r_uint32be(data, offset+4);
}

function r_uint64le(data, offset) {
    return r_uint32le(data, offset+4)*65536*65536 + r_uint32le(data, offset);
}

