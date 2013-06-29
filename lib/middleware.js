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

var passport = require('passport');

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

function getPassportLocalStrategy() {
  //TODO
}

function getPassportLocalRoute() {
  //TODO
}

function middleware(options) {
  options = options || {};

  require('./mongodb_manager.js').initialize(options);
  require('./authorization_manager.js').initialize(options);

  //for sub middleware
  var stack = [];

  //emulate app.use
  var use = function(fn) {
    stack.push(fn);
  };

  //emulate app.handle
  var handle = function(index, req, res, next) {
    if (stack[index]) {
      stack[index](req, res, function() {
        handle(index + 1, req, res, next);
      });
    } else {
      next();
    }
  };

  //ensure required middleware is loaded
  use(function(req, res, next) {
    var ok = true;
    if (!req.session) {
      stack.unshift(require('express').session());
      ok = false;
    }
    if (!req.cookies) {
      stack.unshift(require('express').cookieParser());
      ok = false;
    }
    if (!req.body) {
      stack.unshift(require('express').bodyParser());
      ok = false;
    }
    if (ok) {
      next();
    } else {
      //let browser reload. not very nice.
      res.redirect(req.originalUrl);
    }
  });

  use(passport.initialize());
  use(passport.session());

  options.passport_strategy = options.passport_strategy || 'local';
  if (options.passport_strategy === 'local') {
    passport.use(getPassportLocalStrategy());
    use(getPassportLocalRoute());
  } else if (options.passport_strategy === 'facebook') {
    //TODO facebook strategy
  } else {
    //user-specified strategy
    passport.use(options.passport_strategy);
  }

  var posts_prefix = options.posts_prefix || '/posts';
  var route_posts = require('./route_posts.js')(options);

  var users_prefix = options.users_prefix || '/users';
  var route_users = require('./route_users.js')(options);

  var groups_prefix = options.groups_prefix || '/groups';
  var route_groups = require('./route_groups.js')(options);

  use(function(req, res, next) {
    if (req.url.lastIndexOf(posts_prefix, 0) === 0) {
      req.url = req.url.substring(posts_prefix.length);
      route_posts(req, res);
    } else if (req.url.lastIndexOf(users_prefix, 0) === 0) {
      req.url = req.url.substring(users_prefix.length);
      route_users(req, res);
    } else if (req.url.lastIndexOf(groups_prefix, 0) === 0) {
      req.url = req.url.substring(groups_prefix.length);
      route_groups(req, res);
    } else {
      next();
    }
  });

  return function(req, res, next) {
    handle(0, req, res, next);
  };
}

module.exports = middleware;
