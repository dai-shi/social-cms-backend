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
var PassportFacebookStrategy = require('passport-facebook').Strategy;
var FB = require('fb');
var mongodb_manager = require('./mongodb_manager.js');
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
 * Local Authentication (not for production purposes)
 */

function createUserForPassportLocal(username, password, callback) {
  if (!username) return callback('no username');
  if (!password) return callback('no password');
  mongodb_manager.getCollection('user', function(err, collection) {
    if (err) return callback(err);

    collection.findOne({
      'system.username': username
    }, function(err, data) {
      if (err) return callback(err);
      if (data) return callback('already exists');

      mongodb_manager.createPrimaryKey('user', function(err, primary_key) {
        if (err) return callback(err);

        collection.insert({
          _id: primary_key,
          owner: {
            user_id: primary_key
          },
          system: {
            username: username,
            password: password
          }
        }, {
          w: 1
        }, function(err, result) {
          if (err) return callback(err);
          if (result.length !== 1) return callback('no result');
          callback(null, result[0]._id); //returning user_id
        });
      });
    });
  });
}

function getUserIdForPassportLocal(username, password, callback) {
  mongodb_manager.getCollection('user', function(err, collection) {
    if (err) return callback(err);

    collection.findOne({
      'system.username': username,
      'system.password': password
    }, function(err, data) {
      if (err) return callback(err);

      if (data) {
        callback(null, data._id); //returning user_id
      } else {
        callback(null, false);
      }
    });
  });
}

function getPassportLocalMiddleware(options) {
  var login_local_path = options.login_local_path || '/login/local';
  var logout_local_path = options.logout_local_path || '/logout/local';
  var login_success_local_path = options.login_success_local_path;
  var login_failed_local_path = options.login_failed_local_path;

  passport.use(new PassportLocalStrategy(

  function(username, password, callback) {
    if (!username) return callback('no username');
    if (!password) return callback('no password');

    getUserIdForPassportLocal(username, password, callback);
  }));

  return function(req, res, next) {
    if (req.url === login_local_path && req.method === 'POST' && req.body && req.body.mode === 'create') {
      createUserForPassportLocal(req.body.username, req.body.password, function(err, id) {
        if (err) return next(err);
        res.json({
          user_id: id
        });
      });
    } else if (req.url === login_local_path) {
      passport.authenticate('local', function(err, user) {
        if (err) return next(err);
        if (user) {
          req.logIn(user, function(err) {
            if (err) return next(err);
            if (login_success_local_path) {
              res.redirect(login_success_local_path);
            } else {
              res.json({
                user_id: user
              });
            }
          });
        } else { // no user
          if (login_failed_local_path) {
            res.redirect(login_failed_local_path);
          } else {
            res.send(500, 'unable to login');
          }
        }
      })(req, res, next);
    } else if (req.url === logout_local_path) {
      req.logOut();
      res.send(200, 'logged out');
    } else {
      next();
    }
  };
}

/*
 * Facebook Authentication
 */

/* get user_id from facebook login information
    if this is the first login for the user, create a new record. */
function getUserIdForPassportFacebook(facebook_user_id, facebook_access_token, callback) {
  mongodb_manager.getCollection('user', function(err, collection) {
    if (err) return callback(err);

    collection.findOne({
      'system.facebook_user_id': facebook_user_id
    }, function(err, data) {
      if (err) return callback(err);

      if (data) {
        //found the existing record
        collection.update({
          _id: data._id
        }, {
          $set: {
            'system.facebook_access_token': facebook_access_token
          }
        }, {
          w: 1
        }, function(err) {
          if (err) return callback(err);

          callback(null, data._id); //returning user_id
        });
      } else {
        //new user record
        mongodb_manager.createPrimaryKey('user', function(err, primary_key) {
          if (err) return callback(err);

          collection.insert({
            _id: primary_key,
            owner: {
              user_id: primary_key
            },
            system: {
              facebook_user_id: facebook_user_id,
              facebook_access_token: facebook_access_token
            }
          }, {
            w: 1
          }, function(err, result) {
            if (err) return callback(err);
            if (result.length !== 1) return callback('no result');
            callback(null, result[0]._id); //returning user_id
          });
        });
      }
    });
  });
}

function setFacebookFullname(facebook_access_token, user_id) {
  FB.api('/me', {
    access_token: facebook_access_token
  }, function(res) {
    if (res && res.name) {
      mongodb_manager.getCollection('user', function(err, collection) {
        if (err) return console.log('unable to get the user collection.', err);

        collection.update({
          _id: user_id
        }, {
          $set: {
            fullname: res.name
          }
        }, {
          w: 1
        }, function(err) {
          if (err) return console.log('failed to set facebook fullname.', err);

          //no callback
        });
      });
    }
  });
}

function getPassportFacebookMiddleware(options) {
  if (!options.facebook_app_id || !options.facebook_app_secret) {
    console.log('FATAL: facebook_app_id or facebook_app_secret is not specified.');
  }

  var login_facebook_path = options.login_facebook_path || '/login/facebook';
  var facebook_callback_path = options.facebook_callback_path || '/login/facebook/callback';
  var login_success_facebook_path = options.login_success_facebook_path;
  var login_failed_facebook_path = options.login_failed_facebook_path;

  passport.use(new PassportFacebookStrategy({
    clientID: options.facebook_app_id,
    clientSecret: options.facebook_app_secret,
    callbackURL: facebook_callback_path
  }, function(access_token, refresh_token, profile, done) {
    getUserIdForPassportFacebook(profile.id, access_token, function(err, user_id) {
      done(err, user_id);
      if (options.set_facebook_fullname) {
        setFacebookFullname(access_token, user_id);
      }
    });
  }));

  return function(req, res, next) {
    if (req.path === login_facebook_path) {
      passport.authenticate('facebook')(req, res, next);
    } else if (req.path === facebook_callback_path) {
      passport.authenticate('facebook', function(err, user) {
        if (err) return next(err);
        if (user) {
          req.logIn(user, function(err) {
            if (err) return next(err);
            if (login_success_facebook_path) {
              res.redirect(login_success_facebook_path);
            } else {
              res.json({
                user_id: user
              });
            }
          });
        } else { // no user
          if (login_failed_facebook_path) {
            res.redirect(login_failed_facebook_path);
          } else {
            res.send(500, 'unable to login');
          }
        }
      })(req, res, next);
    } else {
      next();
    }
  };
}

/*
 * The middleware
 */

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
    use(getPassportLocalMiddleware(options));
  } else if (options.passport_strategy === 'facebook') {
    use(getPassportFacebookMiddleware(options));
  } else {
    //user-specified passport strategy middleware
    use(options.passport_strategy);
  }

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
    var route_func = route_objects(route.object_type);
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
