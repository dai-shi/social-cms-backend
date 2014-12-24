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
var PassportFacebookStrategy = require('passport-facebook').Strategy;
var FB = require('fb');
var mongodb_manager = require('../mongodb_manager.js');

/*
 * Facebook Authentication
 */

/* get user_id from facebook login information
    if this is the first login for the user, create a new record. */
function getUserIdForPassportFacebook(options, facebook_user_id, facebook_access_token, callback) {
  mongodb_manager.getBareCollection('user', function(err, collection) {
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

          var data = {
            _id: primary_key,
            owner: {
              user_id: primary_key
            },
            system: {
              facebook_user_id: facebook_user_id,
              facebook_access_token: facebook_access_token
            }
          };
          if (options.expose_facebook_user_id) {
            data.facebook_user_id = facebook_user_id;
          }
          collection.insert(data, {
            w: 1
          }, function(err, result) {
            if (err) return callback(err);
            if (result.length !== 1) return callback(new Error('no result'));
            callback(null, result[0]._id); //returning user_id
          });
        });
      }
    });
  });
}

function setFacebookFullname(options, facebook_access_token, user_id, callback) {
  var args = {
    access_token: facebook_access_token
  };
  if (options.facebook_api_locale) {
    args.locale = options.facebook_api_locale;
  }
  FB.api('/me', args, function(res) {
    if (res && res.name) {
      mongodb_manager.getBareCollection('user', function(err, collection) {
        if (err) return callback(err);

        collection.update({
          _id: user_id
        }, {
          $set: {
            fullname: res.name
          }
        }, {
          w: 1
        }, function(err) {
          if (err) return callback(err);

          callback(null);
        });
      });
    }
  });
}

function middleware(options) {
  if (!options.facebook_app_id || !options.facebook_app_secret) {
    throw new Error('facebook_app_id or facebook_app_secret is not specified.');
  }

  var opts = options.auth_facebook || {
    login_path: options.login_facebook_path,
    login_success_path: options.login_success_facebook_path,
    login_failed_path: options.login_failed_facebook_path
  };
  var login_path = opts.login_path || '/login/facebook';
  var login_success_path = opts.login_success_path;
  var login_failed_path = opts.login_failed_path;

  var facebook_callback_path = options.facebook_callback_path || '/login/facebook/callback';
  var facebook_authenticate_options = options.facebook_authenticate_options;

  passport.use(new PassportFacebookStrategy({
    clientID: options.facebook_app_id,
    clientSecret: options.facebook_app_secret,
    callbackURL: facebook_callback_path
  }, function(access_token, refresh_token, profile, done) {
    getUserIdForPassportFacebook(options, profile.id, access_token, function(err, user_id) {
      if (options.set_facebook_fullname) {
        setFacebookFullname(options, access_token, user_id, function(err) {
          if (err) console.log('set_facebook_fullname failed', err);
          done(err, user_id);
        });
      } else {
        done(err, user_id);
      }
    });
  }));

  return function(req, res, next) {
    if (req.path === login_path) {
      passport.authenticate('facebook', facebook_authenticate_options)(req, res, next);
    } else if (req.path === facebook_callback_path) {
      passport.authenticate('facebook', function(err, user) {
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
    } else {
      next();
    }
  };
}

module.exports = middleware;
