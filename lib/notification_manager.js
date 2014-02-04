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

/* jshint indent: false */

var _ = require('underscore');
var FB = require('fb');
var mongodb_manager = require('./mongodb_manager.js');

var notification_mode;
var facebook_app_id;
var facebook_app_secret;

function initialize(options) {
  notification_mode = options.notification_mode || 'standard';
  facebook_app_id = options.facebook_app_id;
  facebook_app_secret = options.facebook_app_secret;
}

function sendFacebookAppNotification(facebook_user_id, href, template) {
  if (!facebook_app_id || !facebook_app_secret) return;
  FB.api(facebook_user_id + '/notifications', 'post', {
    href: href,
    template: template
  }, function(res) {
    if (res && res.error && res.error.type === 'OAuthException') {
      FB.setAccessToken(null);
      FB.api('oauth/access_token', {
        client_id: facebook_app_id,
        client_secret: facebook_app_secret,
        grant_type: 'client_credentials'
      }, function(res) {
        if (!res || res.error) {
          console.log('error occurred when getting facebook app access token:', res && res.error);
          return;
        }
        FB.setAccessToken(res.access_token);
        FB.api(facebook_user_id + '/notifications', 'post', {
          href: href,
          template: template
        }, function(res) {
          if (!res || res.error) {
            console.log('error occurred:', res && res.error);
          } else {
            //no callback
          }
        });
      });
    } else {
      //no callback
    }
  });
}

function sendNotificationStandard(user_id, object_type, data) {
  mongodb_manager.getBareCollection('user', function(err, collection) {
    if (err) return console.log('unable to get user collection');

    var destination = (Array.isArray(data.destination) ? data.destination : [data.destination]);
    if (_.find(destination, function(x) {
      return x && x.user_id === user_id;
    })) {
      collection.findOne({
        _id: user_id
      }, function(err, result) {
        if (err) return console.log('unable to get user data');

        if (result.system.facebook_user_id) {
          var template = (typeof data.message === 'string' ? data.message.substring(0, 180) : 'You got a new data: ' + object_type);
          sendFacebookAppNotification(result.system.facebook_user_id, '?ref=appnotification', template);
        }
      });
    }
  });
}

function sendNotification(user_id, object_type, data) {
  if (typeof notification_mode === 'function') return notification_mode(user_id, object_type, data);
  switch (notification_mode) {
    case 'standard':
      sendNotificationStandard(user_id, object_type, data);
      break;
    default:
      //do nothing
  }
}

exports.initialize = initialize;
exports.sendNotificationStandard = sendNotificationStandard;
exports.sendNotification = sendNotification;
