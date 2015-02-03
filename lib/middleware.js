/*
  Copyright (C) 2013-2015, Daishi Kato <daishi@axlight.com>
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

/* jshint undef: true, unused: true, latedef: true */
/* jshint quotmark: single, eqeqeq: true */
/* jshint node: true */

var passport = require('passport');
var route_objects = require('./route_objects.js');

/*
 * Common Passport Setup
 */

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

/*
 * convert CamelCase options
 */

function convertCamelCaseOptions(options) {
  if (!options) return;
  if (typeof options !== 'object') return;
  Object.keys(options).forEach(function(key) {
    var newKey = key.replace(/([A-Z])/g, function(match, group1) {
      return '_' + group1.toLowerCase();
    });
    options[newKey] = options[key];
    convertCamelCaseOptions(options[key]);
  });
}

/*
 * The Express middleware
 */

function middleware(options) {
  options = options || {};
  convertCamelCaseOptions(options);

  require('./mongodb_manager.js').initialize(options);
  require('./authorization_manager.js').initialize(options);
  require('./notification_manager.js').initialize(options);

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

  //ensure required middleware is loaded
  use(require('cookie-parser')());
  use(require('body-parser')());

  use(options.session_middleware || require('express-session')({
    secret: options.session_secret || 'this is a fallback session middlware secret'
  }));

  use(passport.initialize());
  use(passport.session());

  options.passport_strategy = options.passport_strategy || 'local';
  if (options.passport_strategy === 'local') {
    use(require('./authentication/auth_local.js')(options));
  } else if (options.passport_strategy === 'facebook') {
    use(require('./authentication/auth_facebook.js')(options));
  } else if (options.passport_strategy === 'digest') {
    use(require('./authentication/auth_digest.js')(options));
  } else {
    //user-specified passport strategy middleware
    use(options.passport_strategy);
  }

  use(function(req, res, next) {
    req.emit('authenticated');
    if (!req.notAuthenticated && !res.headersSent) {
      next();
    }
  });

  options.routes = options.routes || [{
    object_type: 'post',
    object_prefix: '/posts'
  }, {
    object_type: 'user',
    object_prefix: '/users'
  }, {
    object_type: 'group',
    object_prefix: '/groups'
  }, {
    object_type: 'like',
    object_prefix: '/likes'
  }];

  options.routes.forEach(function(route) {
    var route_func = route_objects(route.object_type, options);
    use(function(req, res, next) {
      if (req.url.lastIndexOf(route.object_prefix, 0) === 0) {
        req.url = req.url.substring(route.object_prefix.length);
        route_func(req, res);
      } else {
        next();
      }
    });
  });

  return function(req, res, next) {
    handle(0, req, res, next);
  };
}

module.exports = middleware;
