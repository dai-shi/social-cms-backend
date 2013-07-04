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

function save(current_user_id, data, callback) {
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
      permission_name = 'CREATE_POST_TO_PUBLIC';
    } else if (item.group_id) {
      permission_name = 'CREATE_POST_TO_GROUP';
      target_id = item.group_id;
    } else if (item.user_id) {
      permission_name = 'CREATE_POST_TO_USER';
      target_id = item.user_id;
    }
    authorization_manager.hasPermission(current_user_id, permission_name, target_id, function(err, ok) {
      //ignore err
      cb(ok);
    });
  }, function(ok) {
    if (!ok) return callback('no permission to create post');

    data.created_time = new Date();
    data.owner = {
      user_id: current_user_id
    };
    mongodb_manager.createPrimaryKey('post', function(err, primary_key) {
      if (err) return callback(err);

      data._id = primary_key;
      mongodb_manager.getCollection('post', function(err, collection) {
        if (err) return callback(err);

        collection.insert(data, {
          w: 1
        }, function(err, result) {
          if (err) return callback(err);

          callback(null, result.length ? result[0] : result);
        });
      });
    });
  });

  //TODO handle "destination" (for notification)
}

var reInteger = new RegExp('[1-9][0-9]*');

function parseIntSafely(str) {
  if (reInteger.exec(str)) {
    return parseInt(str, 10);
  } else {
    return str;
  }
}

function get(current_user_id, post_id, callback) {
  var opts = {
    fields: {
      system: false
    }
  };
  authorization_manager.hasPermission(current_user_id, 'VIEW_POST', post_id, function(err, ok) {
    if (!ok) return callback('no VIEW_POST permission');

    mongodb_manager.getCollection('post', function(err, collection) {
      if (err) return callback(err);

      collection.findOne({
        _id: parseIntSafely(post_id)
      }, opts, function(err, data) {
        //ignore err
        if (!data) return callback(null, null); //not found

        authorization_manager.checkScope(current_user_id, data.scope, function(err, ok) {
          //ignore err

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

function query(current_user_id, query, sort, skip, limit, callback) {
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

  authorization_manager.hasPermission(current_user_id, 'VIEW_POSTS', function(err, ok) {
    if (!ok) return callback('no VIEW_POSTS permission');

    authorization_manager.getScopeCriteria(current_user_id, function(err, criteria) {
      if (err) return callback(err);

      if (query.$or) {
        return callback('$or in query is not supported (yet)');
      } else {
        query.$or = criteria;
      }

      mongodb_manager.getCollection('post', function(err, collection) {
        if (err) return callback(err);

        collection.find(query, opts, function(err, cursor) {
          if (err) return callback(err);

          cursor.toArray(callback);
        });
      });
    });
  });
}

function remove(current_user_id, post_id, callback) {
  authorization_manager.hasPermission(current_user_id, 'DELETE_POST', post_id, function(err, ok) {
    if (!ok) return callback('no DELETE_POST permission');

    mongodb_manager.getCollection('post', function(err, collection) {
      if (err) return callback(err);

      collection.remove({
        _id: parseIntSafely(post_id)
      }, {
        w: 1
      }, function(err) {
        if (err) return callback(null, null); //not found
        callback(null, true);
      });
    });
  });
}

function update(current_user_id, post_id, data, callback) {
  authorization_manager.hasPermission(current_user_id, 'UPDATE_POST', post_id, function(err, ok) {
    if (!ok) return callback('no UPDATE_POST permission');

    mongodb_manager.getCollection('post', function(err, collection) {
      if (err) return callback(err);

      collection.update({
        _id: parseIntSafely(post_id)
      }, data, {
        w: 1,
        upsert: true
      }, function(err) {
        if (err) return callback(null, null); //not found
        callback(null, true);
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

var rePathId = new RegExp('^\\/(\\w)+$');
var rePathNone = new RegExp('^^\\/?($|\\?)');

function handleGet(req, res) {
  var current_user_id = authorization_manager.getCurrentUserId(req);
  var match = rePathId.exec(req.url);
  if (match) {
    var post_id = match[1];
    get(current_user_id, post_id, function(err, result) {
      if (err) {
        res.send(500, 'unable to get a post: ' + err);
      } else if (result) {
        res.json(result);
      } else {
        res.send(404);
      }
    });
  } else if (rePathNone.test(req.url)) {
    query(current_user_id, parseJSON(req.query.query), parseJSON(req.query.sort), req.query.skip, req.query.limit, function(err, result) {
      if (err) {
        res.send(500, 'unable to query posts: ' + err);
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
  if (rePathNone.test(req.url)) {
    save(current_user_id, req.body, function(err, result) {
      if (err) {
        res.send(500, 'unable to create a new post: ' + err);
      } else {
        res.json(result);
      }
    });
  } else {
    res.send(404);
  }
}

function handleDelete(req, res) {
  var current_user_id = authorization_manager.getCurrentUserId(req);
  var match = rePathId.exec(req.url);
  if (match) {
    var post_id = match[1];
    remove(current_user_id, post_id, function(err, result) {
      if (err) {
        res.send(500, 'unable to remove a post: ' + err);
      } else if (result) {
        res.json({
          status: 'ok'
        });
      } else {
        res.send(404);
      }
    });
  } else {
    res.send(404);
  }
}

function handlePut(req, res) {
  var current_user_id = authorization_manager.getCurrentUserId(req);
  var match = rePathId.exec(req.url);
  if (match) {
    var post_id = match[1];
    update(current_user_id, post_id, req.body, function(err, result) {
      if (err) {
        res.send(500, 'unable to update a post: ' + err);
      } else if (result) {
        res.json({
          status: 'ok'
        });
      } else {
        res.send(404);
      }
    });
  } else {
    res.send(404);
  }
}


module.exports = function( /* options */ ) {
  return function(req, res) {
    if (req.method === 'GET') {
      handleGet(req, res);
    } else if (req.method === 'POST') {
      handlePost(req, res);
    } else if (req.method === 'DELETE') {
      handleDelete(req, res);
    } else if (req.method === 'PUT') {
      handlePut(req, res);
    } else {
      res.send(400);
    }
  };
};
