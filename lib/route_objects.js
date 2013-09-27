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

module.exports = function(object_type, options) {
  options = options; //to make jshint happy

  function processDestination(data) {
    if (!data.destination) return;

    authorization_manager.getFollowers(data.destination, function(err, result) {
      if (err) return console.log('error getting followers: ' + err);

      mongodb_manager.getCollection(object_type, function(err, collection) {
        if (err) return console.log('error getting collection: ' + err);

        collection.update({
          _id: data._id
        }, {
          $set: {
            "system.followers": result
          }
        }, {
          w: 1
        }, function(err) {
          if (err) return console.log('error updating system.followers: ' + err);
        });
      });
    });
  }

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
        permission_name = 'CREATE_OBJECT_TO_PUBLIC';
      } else if (item.group_id) {
        permission_name = 'CREATE_OBJECT_TO_GROUP';
        target_id = item.group_id;
      } else if (item.user_id) {
        permission_name = 'CREATE_OBJECT_TO_USER';
        target_id = item.user_id;
      }
      authorization_manager.hasPermission(current_user_id, permission_name, object_type, target_id, function(err, ok) {
        //ignore err
        cb(ok);
      });
    }, function(ok) {
      if (!ok) return callback('no permission to create object');

      data.created_time = new Date();
      data.owner = {
        user_id: current_user_id
      };
      mongodb_manager.createPrimaryKey(object_type, function(err, primary_key) {
        if (err) return callback(err);

        data._id = primary_key;
        mongodb_manager.getCollection(object_type, function(err, collection) {
          if (err) return callback(err);

          collection.insert(data, {
            w: 1
          }, function(err, result) {
            if (err) return callback(err);

            callback(null, result.length ? result[0] : result);
            processDestination(data);
          });
        });
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

  function get(current_user_id, object_id, callback) {
    var opts = {
      fields: {
        system: false
      }
    };
    authorization_manager.hasPermission(current_user_id, 'VIEW_OBJECT', object_type, object_id, function(err, ok) {
      if (!ok) return callback('no VIEW_OBJECT permission');

      mongodb_manager.getCollection(object_type, function(err, collection) {
        if (err) return callback(err);

        collection.findOne({
          _id: parseIntSafely(object_id)
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
    sort = sort || [
      ['created_time', 'desc']
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

    authorization_manager.hasPermission(current_user_id, 'VIEW_OBJECTS', object_type, function(err, ok) {
      if (!ok) return callback('no VIEW_OBJECTS permission');

      authorization_manager.getScopeCriteria(current_user_id, function(err, criteria) {
        if (err) return callback(err);

        mongodb_manager.getCollection(object_type, function(err, collection) {
          if (err) return callback(err);

          var execQuery = function(query, callback) {
            query = query ? {
              $and: [query, {
                $or: criteria
              }]
            } : {
              $or: criteria
            };
            collection.find(query, opts, function(err, cursor) {
              if (err) return callback(err);

              cursor.toArray(callback);
            });
          };

          if (Array.isArray(query)) {
            async.map(query, execQuery, callback);
          } else {
            execQuery(query, callback);
          }

        });
      });
    });
  }

  function count(current_user_id, query, callback) {
    var opts = {
      fields: {
        system: false
      }
    };

    authorization_manager.hasPermission(current_user_id, 'COUNT_OBJECTS', object_type, function(err, ok) {
      if (!ok) return callback('no COUNT_OBJECTS permission');

      authorization_manager.getScopeCriteria(current_user_id, function(err, criteria) {
        if (err) return callback(err);

        mongodb_manager.getCollection(object_type, function(err, collection) {
          if (err) return callback(err);

          var execQuery = function(query, callback) {
            query = query ? {
              $and: [query, {
                $or: criteria
              }]
            } : {
              $or: criteria
            };
            collection.count(query, opts, function(err, result) {
              if (err) return callback(err);

              callback(null, {
                count: result
              });
            });
          };

          if (Array.isArray(query)) {
            async.map(query, execQuery, callback);
          } else {
            execQuery(query, callback);
          }

        });
      });
    });
  }

  function getInbox(current_user_id, skip, limit, callback) {
    skip = skip || 0;
    limit = limit || 20;
    var opts = {
      sort: [
        ['created_time', 'desc']
      ],
      skip: skip,
      limit: limit,
      fields: {
        system: false
      }
    };

    authorization_manager.hasPermission(current_user_id, 'VIEW_OBJECTS', object_type, function(err, ok) {
      if (!ok) return callback('no VIEW_OBJECTS permission');

      authorization_manager.getScopeCriteria(current_user_id, function(err, criteria) {
        if (err) return callback(err);

        var query = {
          "system.followers": current_user_id,
          $or: criteria
        };
        mongodb_manager.getCollection(object_type, function(err, collection) {
          if (err) return callback(err);

          collection.find(query, opts, function(err, cursor) {
            if (err) return callback(err);

            cursor.toArray(callback);
          });
        });
      });
    });
  }

  function remove(current_user_id, object_id, callback) {
    authorization_manager.hasPermission(current_user_id, 'DELETE_OBJECT', object_type, object_id, function(err, ok) {
      if (!ok) return callback('no DELETE_OBJECT permission');

      mongodb_manager.getCollection(object_type, function(err, collection) {
        if (err) return callback(err);

        collection.remove({
          _id: parseIntSafely(object_id)
        }, {
          w: 1
        }, function(err) {
          if (err) return callback(null, null); //not found
          callback(null, true);
        });
      });
    });
  }

  function update(current_user_id, object_id, data, callback) {
    if (data._id) return callback('not allowed to specify _id');
    if (data.system) return callback('not allowed to use system area');
    if (data.created_time) return callback('not allowed to specify created_time');
    if (data.owner) return callback('not allowed to specify owner');

    authorization_manager.hasPermission(current_user_id, 'UPDATE_OBJECT', object_type, object_id, function(err, ok) {
      if (!ok) return callback('no UPDATE_OBJECT permission');

      mongodb_manager.getCollection(object_type, function(err, collection) {
        if (err) return callback(err);

        collection.update({
          _id: parseIntSafely(object_id)
        }, data, {
          w: 1
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

  var rePathCount = new RegExp('^\\/count($|\\?)');
  var rePathInbox = new RegExp('^\\/inbox($|\\?)');
  var rePathMyself = new RegExp('^\\/myself$');
  var rePathId = new RegExp('^\\/(\\w+)$');
  var rePathNone = new RegExp('^\\/?($|\\?)');

  function handleGet(req, res) {
    var current_user_id = authorization_manager.getCurrentUserId(req);
    if (rePathCount.test(req.url)) {
      count(current_user_id, parseJSON(req.query.query), function(err, result) {
        if (err) {
          res.send(500, 'unable to count objects: ' + err);
        } else {
          res.json(result);
        }
      });
    } else if (rePathInbox.test(req.url)) {
      getInbox(current_user_id, req.query.skip, req.query.limit, function(err, result) {
        if (err) {
          res.send(500, 'unable to get inbox ' + err);
        } else {
          res.json(result);
        }
      });
    } else if (rePathMyself.test(req.url)) {
      if (current_user_id) {
        var object_id = current_user_id;
        get(current_user_id, object_id, function(err, result) {
          if (err) {
            res.send(500, 'unable to get an object: ' + err);
          } else if (result) {
            res.json(result);
          } else {
            res.send(404);
          }
        });
      } else {
        res.send(500, 'not logged in');
      }
    } else if (rePathNone.test(req.url)) {
      query(current_user_id, parseJSON(req.query.query), parseJSON(req.query.sort), req.query.skip, req.query.limit, function(err, result) {
        if (err) {
          res.send(500, 'unable to query objects: ' + err);
        } else {
          res.json(result);
        }
      });
    } else {
      var match = rePathId.exec(req.url);
      if (match) {
        var object_id = match[1];
        get(current_user_id, object_id, function(err, result) {
          if (err) {
            res.send(500, 'unable to get an object: ' + err);
          } else if (result) {
            res.json(result);
          } else {
            res.send(404);
          }
        });
      } else {
        res.send(404);
      }
    }
  }

  function handlePost(req, res) {
    var current_user_id = authorization_manager.getCurrentUserId(req);
    if (rePathNone.test(req.url)) {
      save(current_user_id, req.body, function(err, result) {
        if (err) {
          res.send(500, 'unable to create a new object: ' + err);
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
      var object_id = match[1];
      remove(current_user_id, object_id, function(err, result) {
        if (err) {
          res.send(500, 'unable to remove an object: ' + err);
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
      var object_id = match[1];
      update(current_user_id, object_id, req.body, function(err, result) {
        if (err) {
          res.send(500, 'unable to update an object: ' + err);
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
