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
var PassportDigestStrategy = require('passport-http').DigestStrategy;
var mongodb_manager = require('../mongodb_manager.js');

/*
 * HTTP Digest Authentication with RememberMe cookie
 */

function createUser(username, passhash, initdata, callback) {
  if (!username) return callback(new Error('no username'));
  if (!passhash) return callback(new Error('no passhash'));
  initdata = initdata || {};
  if (initdata._id) return callback(new Error('not allowed to specify _id'));
  if (initdata.system) return callback(new Error('not allowed to use system area'));
  if (initdata.created_time) return callback(new Error('not allowed to specify created_time'));
  if (initdata.owner) return callback(new Error('not allowed to specify owner'));
  if (initdata.meta) return callback(new Error('not allowed to specify meta'));
  mongodb_manager.getBareCollection('user', function(err, collection) {
    if (err) return callback(err);

    collection.findOne({
      'system.username': username
    }, function(err, data) {
      if (err) return callback(err);
      if (data) return callback(new Error('already exists'));

      mongodb_manager.createPrimaryKey('user', function(err, primary_key) {
        if (err) return callback(err);

        initdata._id = primary_key;
        initdata.owner = {
          user_id: primary_key
        };
        initdata.system = {
          username: username,
          passhash: passhash,
          remember_me: null
        };
        collection.insert(initdata, {
          w: 1
        }, function(err, result) {
          if (err) return callback(err);
          if (result.length !== 1) return callback(new Error('no result'));
          callback(null, result[0]._id); //returning user_id
        });
      });
    });
  });
}

function updateUser(current_user_id, is_moduser_allowed, username, passhash, callback) {
  if (!username) return callback(new Error('no username'));
  if (!passhash) return callback(new Error('no passhash'));
  mongodb_manager.getBareCollection('user', function(err, collection) {
    if (err) return callback(err);

    collection.findOne({
      'system.username': username
    }, function(err, data) {
      if (err) return callback(err);
      if (!data) return callback(new Error('no such user'));
      if (!is_moduser_allowed(current_user_id, data)) return callback(new Error('not allowed to moduser'));

      collection.update({
        _id: data._id
      }, {
        $set: {
          'system.passhash': passhash
        }
      }, {
        w: 1
      }, function(err) {
        if (err) return callback(err);
        callback(null, data._id); //returning user_id
      });
    });
  });
}

function getUserIdAndPasshash(username, callback) {
  mongodb_manager.getBareCollection('user', function(err, collection) {
    if (err) return callback(err);

    collection.findOne({
      'system.username': username
    }, function(err, data) {
      if (err) return callback(err);

      if (data) {
        callback(null, data._id, data.system.passhash);
      } else {
        callback(null, false);
      }
    });
  });
}

function createToken(len) {
  var buf = [];
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (var i = 0; i < len; i++) {
    buf.push(chars[Math.floor(Math.random() * chars.length)]);
  }
  return buf.join('');
}

function createRememberMeToken(user_id, callback) {
  mongodb_manager.getBareCollection('user', function(err, collection) {
    if (err) return callback(err);

    var token = createToken(32);
    collection.update({
      _id: user_id
    }, {
      $set: {
        'system.remember_me': token
      }
    }, {
      w: 1
    }, function(err) {
      if (err) return callback(err);

      callback(null, token);
    });
  });
}

function consumeRememberMeToken(token, callback) {
  if (!token) return callback();
  mongodb_manager.getBareCollection('user', function(err, collection) {
    if (err) return callback(err);

    collection.findOne({
      'system.remember_me': token
    }, function(err, data) {
      if (err) return callback(err);

      if (data) {
        createRememberMeToken(data._id, function(err, newToken) {
          if (err) return callback(err);
          callback(null, data._id, newToken);
        });
      } else {
        callback();
      }
    });
  });
}

function middleware(options) {
  var opts = options.auth_digest || {};
  var login_path = opts.login_path || '/login/digest';
  var logout_path = opts.logout_path || '/logout/digest';
  var adduser_path = opts.adduser_path || '/adduser/digest';
  var moduser_path = opts.moduser_path || '/moduser/digest';
  var login_success_path = opts.login_success_path;
  var realm = opts.realm || 'Users';
  var remember_me = opts.remember_me === false ? false : opts.remember_me || 'remember_me';
  var remember_me_options = opts.remember_me_options || {
    path: '/',
    httpOnly: true,
    maxAge: 365 * 24 * 60 * 60 * 1000
  };
  var is_moduser_allowed = opts.is_moduser_allowed || function(user_id, data) {
      return user_id === data.owner.user_id;
    };

  passport.use(new PassportDigestStrategy({
    realm: realm,
    algorithm: 'MD5',
    qop: 'auth'
  }, function(username, done) {
    getUserIdAndPasshash(username, function(err, user_id, passhash) {
      if (err) return done(err);
      done(null, user_id, {
        ha1: passhash
      });
    });
  }));

  function checkRememberMe(req, res, next) {
    if (remember_me && !req.isAuthenticated()) {
      var token = req.cookies[remember_me];
      consumeRememberMeToken(token, function(err, user, newToken) {
        if (err) return next(err);
        if (newToken) {
          res.cookie(remember_me, newToken, remember_me_options);
        }
        if (user) {
          req.logIn(user, function(err) {
            if (err) return next(err);
            next();
          });
        } else {
          next();
        }
      });
    } else {
      next();
    }
  }

  return function(req, res, next) {
    checkRememberMe(req, res, function(err) {
      if (err) return next(err);
      if (req.path === login_path) {
        passport.authenticate('digest', function(err, user, challenge) {
          if (err) return next(err);
          if (challenge) {
            res.statusCode = 401;
            res.setHeader('WWW-Authenticate', challenge);
            res.end('Unauthorized');
          } else if (user) {
            req.logIn(user, function(err) {
              if (err) return next(err);
              var cont = function(err) {
                if (err) return next(err);
                if (login_success_path) {
                  res.redirect(login_success_path);
                } else {
                  res.json({
                    user_id: user
                  });
                }
              };
              if (remember_me) {
                createRememberMeToken(user, function(err, newToken) {
                  if (err) return cont(err);
                  if (newToken) {
                    res.cookie(remember_me, newToken, remember_me_options);
                  }
                  cont();
                });
              } else {
                cont();
              }
            });
          } else { // no user
            // never reach here, but just in case
            res.status(403).send('unable to login');
          }
        })(req, res, next);
      } else if (req.url === logout_path) {
        req.logOut();
        res.send('logged out');
      } else if (req.url === adduser_path) {
        if (!req.body) return next(new Error('no body'));
        createUser(req.body.username, req.body.passhash, req.body.initdata && JSON.parse(req.body.initdata), function(err, id) {
          if (err) return next(err);
          res.json({
            user_id: id
          });
        });
      } else if (req.url === moduser_path) {
        if (!req.body) return next(new Error('no body'));
        updateUser(req.user, is_moduser_allowed, req.body.username, req.body.passhash, function(err, id) {
          if (err) return next(err);
          res.json({
            user_id: id
          });
        });
      } else {
        next();
      }
    });
  };
}

module.exports = middleware;
