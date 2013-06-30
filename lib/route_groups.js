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
var mongodb_manager = require('./mongodb_manager.js');
var authorization_manager = require('./authorization_manager.js');

function create(current_user_id, data, callback) {
  if (data._id) return callback('not allowed to specify _id');
  if (data.system) return callback('not allowed to use system area');
  if (data.created_time) return callback('not allowed to specify created_time');
  if (data.owner) return callback('not allowed to specify owner');

  async.every(data.scope || [{
    public: true
  }],

  function(item, cb) {
    var permission_name = 'UNKNOWN';
    var target_id = null;
    if (item.public) {
      permission_name = 'CREATE_GROUP_TO_PUBLIC';
    } else if (item.group_id) {
      permission_name = 'CREATE_GROUP_TO_GROUP';
      target_id = item.group_id;
    } else if (item.user_id) {
      permission_name = 'CREATE_GROUP_TO_USER'; //probably useless
      target_id = item.user_id;
    }
    authorization_manager.hasPermission(current_user_id, permission_name, target_id, function(err, ok) {
      cb(ok);
    });
  }, function(ok) {
    if (!ok) return callback('no permission to create group');

    data.created_time = new Date();
    data.owner = {
      user_id: current_user_id
    };
    mongodb_manager.createPrimaryKey('group', function(err, primary_key) {
      if (err) return callback(err);

      data._id = primary_key;
      mongodb_manager.getCollection('group', function(err, collection) {
        if (err) return callback(err);

        collection.insert(data, {
          w: 1
        }, function(err) {
          if (err) return callback(err);

          callback(null);
        });
      });
    });
  });

  //TODO handle "destination" (for notification)
}

function fetch(current_user_id, group_id, callback) {
  var opts = {
    fields: {
      system: false
    }
  };

  authorization_manager.hasPermission(current_user_id, 'VIEW_GROUP', group_id, function(err, ok) {
    if (!ok) return callback('no VIEW_USER permission');

    mongodb_manager.getCollection('group', function(err, collection) {
      if (err) return callback(err);

      collection.findOne(group_id, opts, function(err, data) {
        if (err) return callback(null, null); //not found

        authorization_manager.checkScope(current_user_id, data.scope, function(err, ok) {
          if (err) return callback(null, null); //not found

          if (ok) {
            callback(null, data);
          } else {
            callback(null, null); //not found
          }
        });
      });
    });
  });
}

function fetchAll(current_user_id, query, sort, skip, limit, callback) {
  query = query || {};
  sort = sort || [
    ['created_at', 'desc']
  ];
  skip = skip || 0;
  limit = limit || 20;
  var opts = {
    sort: sort,
    skip: skip,
    limit: limit,
    fields: {
      system: false
    }
  };

  authorization_manager.hasPermission(current_user_id, 'VIEW_GROUPS', function(err, ok) {
    if (!ok) return callback('no VIEW_GROUPS permission');

    authorization_manager.getScopeCriteria(current_user_id, function(err, criteria) {
      if (err) return callback(err);

      if (query.$or) {
        return callback('$or in query is not supported (yet)');
      } else {
        query.$or = criteria;
      }

      mongodb_manager.getCollection('group', function(err, collection) {
        if (err) return callback(err);

        collection.find(query, opts, function(err, cursor) {
          if (err) return callback(err);

          callback(null, cursor.toArray());
        });
      });
    });
  });
}

function parseJSON(str) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch (e) {
    return null; //it's better to raise an error, though.
  }
}

function handleGet(req, res) {
  var current_user_id = authorization_manager.getCurrentUserId(req);
  var match = req.url.match(/^\/(\w)+$/);
  if (match) {
    var group_id = match[1];
    fetch(current_user_id, group_id, function(err, result) {
      if (err) {
        res.send(500, 'unable to fetch a group: ' + err);
      } else if (result) {
        res.json(result);
      } else {
        res.send(404);
      }
    });
  } else if (req.url === '') {
    fetchAll(current_user_id, parseJSON(req.query.query), parseJSON(req.query.sort), req.query.skip, req.query.limit, function(err, result) {
      if (err) {
        res.send(500, 'unable to list groups: ' + err);
      } else {
        res.json(result);
      }
    });
  } else {
    res.send(404);
  }
}

function handlePost(req, res) {
  var current_user_id = authorization_manager.getCurrentUserId(req);
  if (req.url === '') {
    create(current_user_id, req.body, function(err) {
      if (err) {
        res.send(500, 'unable to create a new group: ' + err);
      } else {
        res.json({
          status: 'ok'
        });
      }
    });
  } else {
    res.send(404);
  }
}

module.exports = function(options) {
  options = options; //TODO
  return function(req, res) {
    if (req.method === 'GET') {
      handleGet(req, res);
    } else if (req.method === 'POST') {
      handlePost(req, res);
    } else if (req.method === 'DELETE') {
      res.send(400); //TODO handleDelete(req, res);
    } else if (req.method === 'PUT') {
      res.send(400); //TODO handlePut(req, res);
    } else {
      res.send(400);
    }
  };
};
