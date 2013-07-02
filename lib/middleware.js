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
var PassportLocalStrategy = require('passport-local').Strategy;
var mongodb_manager = require('./mongodb_manager.js');

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

//TODO user registration through email (for passport-local)

function getPassportLocalStrategy() {
  return new PassportLocalStrategy(

  function(username, password, callback) {
    if (!username) return callback('no username');
    if (!password) return callback('no password');

    mongodb_manager.getCollection('user', function(err, collection) {
      if (err) return callback(err);

      collection.findOne({
        'system.username': username,
        'system.password': password
      }, function(err, data) {
        if (err) console.log(err);
        if (data) {
          callback(null, data._id); //returning user_id
        } else {
          callback(null, false);
        }
      });
    });
  });
}

function getPassportLocalRoute(options) {
  var login_local_path = options.login_local_path || '/login/local';
  return function(req, res, next) {
    if (req.method === 'POST' && req.url === login_local_path) {
      passport.authenticate('local', function(err, user) {
        if (err) return next(err);
        if (!user) return res.redirect(req.body.failed_redirect);
        req.logIn(user, function(err) {
          if (err) return next(err);
          res.redirect(req.body.success_redirect);
        });
      })(req, res, next);
    } else {
      next();
    }
  };
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
      stack[index](req, res, function(err) {
        if (err) return next(err);
        handle(index + 1, req, res, next);
      });
    } else {
      next();
    }
  };

  //ensure required middleware is loaded
  use(function(req, res, next) {
    var tmpStack = [];
    if (!req.session) {
      stack.unshift(require('express').session({
        secret: 'not really secret'
      }));
      tmpStack.unshift(require('express').session({
        secret: 'not really secret'
      }));
    }
    if (!req.cookies) {
      stack.unshift(require('express').cookieParser());
      tmpStack.unshift(require('express').cookieParser());
    }
    if (!req.body) {
      stack.unshift(require('express').bodyParser());
      tmpStack.unshift(require('express').bodyParser());
    }
    if (tmpStack.length === 0) {
      next();
    } else {
      //this is a hack. it might not be as expected.
      var tmpHandle = function(index, req, res, next) {
        if (tmpStack[index]) {
          tmpStack[index](req, res, function(err) {
            if (err) return next(err);
            tmpHandle(index + 1, req, res, next);
          });
        } else {
          next();
        }
      };
      tmpHandle(0, req, res, next);
    }
  });

  use(passport.initialize());
  use(passport.session());

  options.passport_strategy = options.passport_strategy || 'local';
  if (options.passport_strategy === 'local') {
    passport.use(getPassportLocalStrategy(options));
    use(getPassportLocalRoute(options));
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
