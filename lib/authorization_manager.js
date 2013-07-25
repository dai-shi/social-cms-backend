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

var async = require('async');
var _ = require('underscore');
var mongodb_manager = require('./mongodb_manager.js');

var authorization_mode;

function initialize(options) {
  authorization_mode = options.authorization_mode || 'standard';
}

function getCurrentUserId(req) {
  return req.user;
}

function getJoinedGroups(user_id, callback) {
  var opts = {
    fields: {
      _id: true
    }
  };

  mongodb_manager.getCollection('group', function(err, collection) {
    if (err) return callback(err);

    var groups = [];
    collection.find({
      'members.user_id': user_id
    }, opts, function(err, cursor) {
      if (err) return callback(err);

      var findParentGroups = function(seedGroups, cb) {
        collection.find({
          'members.group_id': {
            $in: seedGroups
          }
        }, opts, function(err, cursor) {
          if (err) return cb(err);

          var newGroups = [];
          cursor.each(function(err, item) {
            //ignore error
            if (item) {
              if (groups.indexOf(item._id) === -1) {
                groups.push(item._id);
                newGroups.push(item._id);
              }
            } else {
              //end of cursor
              if (newGroups.length) {
                findParentGroups(newGroups, cb);
              } else {
                cb();
              }
            }
          });
        });
      };

      cursor.each(function(err, item) {
        //ignore error
        if (item) {
          groups.push(item._id);
        } else {
          //end of cursor
          findParentGroups(groups, function(err) {
            if (err) return callback(err);
            callback(null, groups);
          });
        }
      });

    });
  });
}

function isFriendEachOther(user_id, target_user_id, callback) {
  var opts = {
    fields: {
      _id: true
    }
  };

  mongodb_manager.getCollection('user', function(err, collection) {
    if (err) return callback(err);

    async.parallel([

    function(cb) {
      collection.findOne({
        _id: user_id,
        'friends.user_id': target_user_id
      }, opts, cb);
    },

    function(cb) {
      collection.findOne({
        _id: target_user_id,
        'friends.user_id': user_id
      }, opts, cb);
    }],

    function(err, result) {
      if (err) return callback(err);
      callback(null, !! (result[0] && result[1]));
    });
  });
}

var reInteger = new RegExp('[1-9][0-9]*');

function parseIntSafely(str) {
  if (reInteger.exec(str)) {
    return parseInt(str, 10);
  } else {
    return str;
  }
}

function getOwner(object_type, data_id, callback) {
  var opts = {
    fields: {
      owner: true
    }
  };

  mongodb_manager.getCollection(object_type, function(err, collection) {
    if (err) return callback(err);

    collection.findOne({
      _id: parseIntSafely(data_id)
    }, opts, function(err, data) {
      //ignore error
      callback(null, data && data.owner);
    });
  });
}


function hasPermissionStandard(user_id, permission, object_type, target, callback) {
  if (!user_id) return callback(null, false); //not logged in

  switch (permission) {
    case 'CREATE_OBJECT_TO_PUBLIC':
      callback(null, true);
      break;
    case 'CREATE_OBJECT_TO_GROUP':
      if (!target) return callback(null, false);
      getJoinedGroups(user_id, function(err, joined_groups) {
        if (err) return callback(err);
        callback(null, joined_groups.indexOf(target) >= 0);
      });
      break;
    case 'CREATE_OBJECT_TO_USER':
      if (!target) return callback(null, false);
      if (user_id === target) return callback(null, true);
      isFriendEachOther(user_id, target, callback);
      break;
      break;
    case 'DELETE_OBJECT':
    case 'UPDATE_OBJECT':
      if (!target) return callback(null, false);
      getOwner(object_type, target, function(err, owner) {
        if (err) return callback(err);
        callback(null, owner && user_id === owner.user_id);
      });
      break;
    case 'VIEW_OBJECT':
    case 'VIEW_OBJECTS':
    case 'COUNT_OBJECTS':
      callback(null, true);
      break;
    default:
      callback(null, false); //no permission
  }
}

function hasPermission(user_id, permission, object_type, target, callback) {
  if (typeof target === 'function') {
    callback = target;
    target = null;
  }

  if (typeof authorization_mode === 'function') return authorization_mode(user_id, permission, target, callback);
  switch (authorization_mode) {
    case 'standard':
      hasPermissionStandard(user_id, permission, object_type, target, callback);
      break;
    default:
      callback(null, false); //no permission at all
  }
}

function checkScope(user_id, scope, callback) {
  if (!scope) return callback(null, true); //public scope

  if (_.find(scope, function(x) {
    return x && x.user_id === user_id;
  })) return callback(null, true); //user scope

  getJoinedGroups(user_id, function(err, joined_groups) {
    if (err) return callback(err);

    if (_.some(joined_groups, function(group_id) {
      return _.find(scope, function(x) {
        return x && x.group_id === group_id;
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

function getFollowers(target_list, callback) {
  var followerMap = {};
  var opts = {
    fields: {
      _id: true
    }
  };
  async.each(target_list, function(target, cb) {
    mongodb_manager.getCollection('user', function(err, collection) {
      if (err) return callback(err);

      var query = _.object(_.map(_.pairs(target), function(x) {
        return ['following.' + x[0], x[1]];
      }));
      collection.findOne(
      query, opts, function(err, cursor) {
        if (err) return cb(err);

        cursor.each(function(err, item) {
          //ignore error
          if (item) {
            followerMap[item._id] = true;
          } else {
            //end of cursor
            cb();
          }
        });
      });
    });
  },

  function(err) {
    if (err) return callback(err);

    callback(null, _.keys(followerMap));
  });
}

exports.initialize = initialize;
exports.getCurrentUserId = getCurrentUserId;
exports.hasPermission = hasPermission;
exports.checkScope = checkScope;
exports.getScopeCriteria = getScopeCriteria;
exports.getFollowers = getFollowers;
