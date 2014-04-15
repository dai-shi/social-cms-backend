/*
  Copyright (C) 2013, Daishi Kato <daishi@axlight.com>
  All rights reserved.

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
  "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
  LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
  A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
  HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
  SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
  LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
  DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
  THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
  OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

var http = require('http');
var passport = require('passport');

var socketMap = {};

function pushObject(user_id, object_type, data) {
  var socket = socketMap[user_id];
  if (socket) {
    socket.emit('new-' + object_type, data);
  }
}

/*
 * The socket.io middleware
 */

function socket_io(options) {
  options = options || {};

  //for sub middleware
  var stack = [];

  //emulate app.use
  var use = function(fn) {
    stack.push(fn);
  };

  //emulate app.handle
  var handle = function(index, req, res, next) {
    if (stack[index]) {
      stack[index](req, res, function(err) {
        if (err) return next(err);
        handle(index + 1, req, res, next);
      });
    } else {
      next();
    }
  };

  use(require('cookie-parser')());

  if (!options.session_middleware) {
    throw new Error('options.session_middleware is not set');
  }
  use(options.session_middleware);

  use(passport.initialize());
  use(passport.session());

  return function(socket, next) {
    var req = socket.request;
    var res = new http.ServerResponse(req); //dummy
    req.originalUrl = req.originalUrl || req.url;
    handle(0, req, res, function(err) {
      if (err) return next(err);
      if (!req.user) return next(new Error('no session for socket.io'));

      var user_id = req.user;
      socketMap[user_id] = socket;
      socket.on('disconnect', function() {
        delete socketMap[user_id];
      });

      next();
    });
  };
}

module.exports = socket_io;
module.exports.pushObject = pushObject;
