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

var _ = require('underscore');
//var mongodb_manager = require('./mongodb_manager.js');

function initialize(options) {
  options = options; //XXX
  //TODO initialize
}

function getCurrentUserId(req) {
  return req.user;
}

function hasPermission(user_id, permission, target, callback) {
  if (typeof target === 'function') {
    callback = target;
    target = null;
  }
  //TODO hasPermission
  callback(null, false);
}

function getJoinedGroups(user_id, callback) {
  //TODO getJoinedGroups
  callback(null, []);
}

function checkScope(user_id, scope, callback) {
  if (!scope) return callback(null, true); //public scope

  if (_.contains(scope, {
    user_id: user_id
  })) return callback(null, true); //user scope

  getJoinedGroups(user_id, function(err, joined_groups) {
    if (err) return callback(err);

    if (_.some(joined_groups, function(group_id) {
      return _.contains(scope, {
        group_id: group_id
      });
    })) {
      callback(null, true); //group scope
    } else {
      callback(null, false); //no scope
    }
  });
}

function getScopeCriteria(user_id, callback) {
  getJoinedGroups(user_id, function(err, joined_groups) {
    if (err) return callback(err);

    var criteria = [{
      'scope': {
        $exists: false
      }
    }, {
      'scope.user_id': user_id
    }];
    joined_groups.forEach(function(group_id) {
      criteria.push({
        'scope.group_id': group_id
      });
    });
    callback(null, criteria);
  });
}

exports.initialize = initialize;
exports.getCurrentUserId = getCurrentUserId;
exports.hasPermission = hasPermission;
exports.checkScope = checkScope;
exports.getScopeCriteria = getScopeCriteria;
