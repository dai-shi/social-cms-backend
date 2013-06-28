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

function createFieldFilter(user_id, callback) {
  async.map(['email', 'friends', 'followers'],

  function(item, cb) {
    authorization_manager.hasPrivilege(user_id, 'VIEW_USER_' + item.toUpperCase(), function(err, ok) {
      if (err) return cb(err);

      if (ok) {
        cb(null, null);
      } else {
        cb(null, {
          item: false
        });
      }
    });
  }, function(err, result) {
    if (err) return callback(err);
    callback(null, _.filter(result, function(x) {
      return x;
    }));
  });
}

function fetch(user_id, target_user_id, callback) {
  authorization_manager.hasPrivilege(user_id, 'VIEW_USERS', function(err, ok) {
    if (!ok) return callback('no VIEW_USERS privilege');

    createFieldFilter(user_id, function(err, field_filter) {
      if (err) return callback(err);

      mongodb_manager.getCollection('user', function(err, collection) {
        if (err) return callback(err);

        var opts = {
          fields: field_filter
        };
        collection.findOne(target_user_id, opts, function(err, data) {
          if (err) return callback(null, null); //not found

          return callback(null, data);
        });
      });
    });
  });
}

function fetchAll(user_id, query, sort, skip, limit, callback) {
  query = query || {};
  sort = sort || [
    ['created_at', 'desc']
  ];
  skip = skip || 0;
  limit = limit || 20;

  authorization_manager.hasPrivilege(user_id, 'VIEW_USERS', function(err, ok) {
    if (!ok) return callback('no VIEW_USERS privilege');

    createFieldFilter(user_id, function(err, field_filter) {
      if (err) return callback(err);

      mongodb_manager.getCollection('user', function(err, collection) {
        if (err) return callback(err);

        var opts = {
          fields: field_filter
        };
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
    var post_id = match[1];
    fetch(current_user_id, post_id, function(err, result) {
      if (err) {
        res.send(500, 'unable to fetch a post: ' + err);
      } else if (result) {
        res.json(result);
      } else {
        res.send(404);
      }
    });
  } else if (req.url === '') {
    fetchAll(current_user_id, parseJSON(req.query.query), parseJSON(req.query.sort), req.query.skip, req.query.limit, function(err, result) {
      if (err) {
        res.send(500, 'unable to list posts: ' + err);
      } else {
        res.json(result);
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
    } else if (req.method === 'delete') {
      res.send(400); //TODO handleDelete(req, res);
    } else if (req.method === 'put') {
      res.send(400); //TODO handlePut(req, res);
    } else {
      res.send(400);
    }
  };
};
