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
var authorization_manager = require('./authorization_manager.js');

function create(current_user_id, data, callback) {
  if (data._id) return callback('not allowed to specify _id');
  if (data.created_time) return callback('not allowed to specify created_time');
  if (data.owner) return callback('not allowed to specify owner');

  authorization_manager.hasPrivilege(current_user_id, 'CREATE_GROUP', function(err, ok) {
    if (!ok) return callback('no CREATE_GROUP privilege');

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

function createFieldFilter(current_user_id, group_id, callback) {
  async.filter(['admin', 'members'],

  function(item, cb) {
    authorization_manager.hasPrivilege(current_user_id, 'VIEW_GROUP_' + item.toUpperCase(), group_id, function(err, ok) {
      cb(!ok);
    });
  }, function(err, result) {
    if (err) return callback(err);
    callback(null, _.object(_.map(result, function(x) {
      return [x, false];
    })));
  });
}

function fetch(current_user_id, group_id, callback) {
  authorization_manager.hasPrivilege(current_user_id, 'VIEW_GROUP', group_id, function(err, ok) {
    if (!ok) return callback('no VIEW_USER privilege');

    createFieldFilter(current_user_id, group_id, function(err, field_filter) {
      if (err) return callback(err);

      mongodb_manager.getCollection('group', function(err, collection) {
        if (err) return callback(err);

        var opts = {
          fields: field_filter
        };
        collection.findOne(group_id, opts, function(err, data) {
          if (err) return callback(null, null); //not found

          return callback(null, data);
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
    limit: limit
  };

  authorization_manager.hasPrivilege(current_user_id, 'VIEW_GROUPS', function(err, ok) {
    if (!ok) return callback('no VIEW_GROUPS privilege');

    createFieldFilter(current_user_id, null, function(err, field_filter) {
      if (err) return callback(err);

      mongodb_manager.getCollection('group', function(err, collection) {
        if (err) return callback(err);

        opts.fields = field_filter;
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
    if (req.method === 'get') {
      handleGet(req, res);
    } else if (req.method === 'post') {
      handlePost(req, res);
    } else if (req.method === 'delete') {
      res.send(400); //TODO handleDelete(req, res);
    } else if (req.method === 'put') {
      res.send(400); //TODO handlePut(req, res);
    } else {
      res.send(400);
    }
  };
};
