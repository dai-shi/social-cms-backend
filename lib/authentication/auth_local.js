/*
  Copyright (C) 2013-2014, Daishi Kato <daishi@axlight.com>
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
var PassportLocalStrategy = require('passport-local').Strategy;
var mongodb_manager = require('../mongodb_manager.js');

/*
 * Local Authentication (not for production purposes)
 */

function createUserForPassportLocal(username, password, callback) {
  if (!username) return callback(new Error('no username'));
  if (!password) return callback(new Error('no password'));
  mongodb_manager.getBareCollection('user', function(err, collection) {
    if (err) return callback(err);

    collection.findOne({
      'system.username': username
    }, function(err, data) {
      if (err) return callback(err);
      if (data) return callback(new Error('already exists'));

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
          if (result.length !== 1) return callback(new Error('no result'));
          callback(null, result[0]._id); //returning user_id
        });
      });
    });
  });
}

function getUserIdForPassportLocal(username, password, callback) {
  mongodb_manager.getBareCollection('user', function(err, collection) {
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

function middleware(options) {
  var opts = options.auth_local || {
    login_path: options.login_local_path,
    logout_path: options.logout_local_path,
    login_success_path: options.login_success_local_path,
    login_failed_path: options.login_failed_local_path
  };
  var login_path = opts.login_path || '/login/local';
  var logout_path = opts.logout_path || '/logout/local';
  var adduser_path = opts.logout_path || '/adduser/local';
  var login_success_path = opts.login_success_path;
  var login_failed_path = opts.login_failed_path;

  passport.use(new PassportLocalStrategy(

  function(username, password, callback) {
    if (!username) return callback(new Error('no username'));
    if (!password) return callback(new Error('no password'));

    getUserIdForPassportLocal(username, password, callback);
  }));

  return function(req, res, next) {
    if (req.url === login_path) {
      passport.authenticate('local', function(err, user) {
        if (err) return next(err);
        if (user) {
          req.logIn(user, function(err) {
            if (err) return next(err);
            if (login_success_path) {
              res.redirect(login_success_path);
            } else {
              res.json({
                user_id: user
              });
            }
          });
        } else { // no user
          if (login_failed_path) {
            res.redirect(login_failed_path);
          } else {
            res.status(500).send('unable to login');
          }
        }
      })(req, res, next);
    } else if (req.url === logout_path) {
      req.logOut();
      res.send('logged out');
    } else if (req.url === adduser_path) {
      if (!req.body) return next(new Error('no body'));
      createUserForPassportLocal(req.body.username, req.body.password, function(err, id) {
        if (err) return next(err);
        res.json({
          user_id: id
        });
      });
    } else {
      next();
    }
  };
}

module.exports = middleware;
