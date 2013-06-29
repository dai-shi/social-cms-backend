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

var mongodb_manager = require('./mongodb_manager.js');
var authorization_manager = require('./authorization_manager.js');

function fetch(current_user_id, user_id, callback) {
  var opts = {
    fields: {
      system: false
    }
  };

  authorization_manager.hasPermission(current_user_id, 'VIEW_USER', user_id, function(err, ok) {
    if (!ok) return callback('no VIEW_USER permission');

    mongodb_manager.getCollection('user', function(err, collection) {
      if (err) return callback(err);

      collection.findOne(user_id, opts, function(err, data) {
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

  authorization_manager.hasPermission(current_user_id, 'VIEW_USERS', function(err, ok) {
    if (!ok) return callback('no VIEW_USERS permission');

    authorization_manager.getScopeCriteria(current_user_id, function(err, criteria) {
      if (err) return callback(err);

      if (query.$or) {
        return callback('$or in query is not supported (yet)');
      } else {
        query.$or = criteria;
      }

      mongodb_manager.getCollection('user', function(err, collection) {
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
    var user_id = match[1];
    fetch(current_user_id, user_id, function(err, result) {
      if (err) {
        res.send(500, 'unable to fetch a user: ' + err);
      } else if (result) {
        res.json(result);
      } else {
        res.send(404);
      }
    });
  } else if (req.url === '') {
    fetchAll(current_user_id, parseJSON(req.query.query), parseJSON(req.query.sort), req.query.skip, req.query.limit, function(err, result) {
      if (err) {
        res.send(500, 'unable to list users: ' + err);
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
