/*
  Copyright (C) 2015, Naoto Satoh
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
var PassportTwitterStrategy = require('passport-twitter').Strategy;
var mongodb_manager = require('../mongodb_manager.js');

/*
 * Twitter Authentication
 */
/* get user_id from twitter login information
 if this is the first login for the user, create a new record. */
function getUserIdForPassportTwitter(options, profile, twitter_access_token, callback) {
  mongodb_manager.getBareCollection('user', function(err, collection) {
    if (err) return callback(err);

    var twitter_user_id = profile.id;

    collection.findOne({
      'system.twitter_user_id': twitter_user_id
    }, function(err, data) {
      if (err) return callback(err);

      if (data) {
        //found the existing record
        collection.update({
          _id: data._id
        }, {
          $set: {
            'system.twitter_access_token': twitter_access_token
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
              twitter_user_id: twitter_user_id,
              twitter_access_token: twitter_access_token
            }
          };
          if (options.exposeTwitterUserid) {
            data.twitterUserId = twitter_user_id;
          } else if (options.expose_twitter_user_id) {
            data.twitter_user_id = twitter_user_id;
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

function setTwitterUsername(options, user_id, profile, callback) {
  var user_name = profile.displayName;
  var screen_name = profile.username;

  mongodb_manager.getBareCollection('user', function(err, collection) {
    if (err) return callback(err);

    collection.update({
      _id: user_id
    }, {
      $set: {
        fullname: user_name,
        screen_name: screen_name
      }
    }, {
      w: 1
    }, function(err) {
      if (err) return callback(err);

      callback(null);
    });
  });
}

function middleware(options) {
  if (!options.twitter_consumer_key || !options.twitter_consumer_secret) {
    throw new Error('twitter_consumer_key or twitter_consumer_secret is not specified.');
  }

  var opts = options.auth_twitter || {
    login_path: options.login_twitter_path,
    login_success_path: options.login_success_twitter_path,
    login_failed_path: options.login_failed_twitter_path
  };
  var login_path = opts.login_path || '/login/twitter';
  var login_success_path = opts.login_success_path;
  var login_failed_path = opts.login_failed_path;

  var twitter_callback_path = options.twitter_callback_path || '/login/twitter/callback';

  passport.use(new PassportTwitterStrategy({
    consumerKey: options.twitter_consumer_key,
    consumerSecret: options.twitter_consumer_secret,
    callbackURL: twitter_callback_path
  }, function(access_token, secret_token, profile, done) {
    getUserIdForPassportTwitter(options, profile, access_token, function(err, user_id) {
      if (options.set_twitter_username) {
        setTwitterUsername(options, user_id, profile, function(err) {
          if (err) console.log('set_twitter_fullname failed', err);
          done(err, user_id);
        });
      } else {
        done(err, user_id);
      }
    });
  }));

  return function(req, res, next) {
    if (req.path === login_path) {
      passport.authenticate('twitter')(req, res, next);
    } else if (req.path === twitter_callback_path) {
      passport.authenticate('twitter', function(err, user) {
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
            res.status(403).send('unable to login');
          }
        }
      })(req, res, next);
    } else {
      next();
    }
  };
}

module.exports = middleware;
