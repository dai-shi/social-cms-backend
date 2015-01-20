/*
  Copyright (C) 2013-2015, Daishi Kato <daishi@axlight.com>
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

/* jshint undef: true, unused: true, latedef: true */
/* jshint quotmark: single, eqeqeq: true */
/* jshint node: true */

var _ = require('underscore');
var async = require('async');
var MongoClient = require('mongodb').MongoClient;
var authorization_manager = require('./authorization_manager.js');
var notification_manager = require('./notification_manager.js');
var socket_io = require('./socket_io.js');

var mongodb_db = null;

function getBareCollection(collection_name, callback) {
  if (!mongodb_db) return callback(new Error('no mongodb connection'));

  mongodb_db.collection(collection_name, function(err, collection) {
    if (err) return callback(err);
    callback(null, collection);
  });
}

function processDestination(current_user_id, object_type, data) {
  if (!data.destination) return;

  authorization_manager.getFollowers(data.destination, function(err, result) {
    if (err) return console.log('error getting followers: ' + err);

    getBareCollection(object_type, function(err, collection) {
      if (err) return console.log('error getting collection: ' + err);

      collection.update({
        _id: data._id
      }, {
        $set: {
          'system.followers': result
        }
      }, {
        w: 1
      }, function(err) {
        if (err) return console.log('error updating system.followers: ' + err);
        result.forEach(function(user_id) {
          socket_io.pushObject(user_id, object_type, data);
        });
      });
    });
  });

  notification_manager.sendNotification(current_user_id, object_type, data);
}

var primary_key_map = {};

function createPrimaryKey(collection_name, callback) {
  if (primary_key_map[collection_name]) return callback(null, ++primary_key_map[collection_name]);

  getBareCollection(collection_name, function(err, collection) {
    if (err) return callback(err);

    collection.find({}, {
      fields: {
        _id: 1
      }
    }, function(err, cursor) {
      if (err) return callback(err);

      var max_id = 0;
      cursor.each(function(err, item) {
        //ignore err
        if (item) {
          if (typeof item._id === 'number' && item._id > max_id) {
            max_id = item._id;
          }
        } else {
          //end of cursor
          if (primary_key_map[collection_name]) return callback(null, ++primary_key_map[collection_name]); //in case it's already created by other calls.
          primary_key_map[collection_name] = max_id + 1;
          callback(null, max_id + 1);
        }
      });
    });
  });
}


function getWrappedCollection(current_user_id, object_type, collection) {
  function modifyFields(fields) {
    // remove 'system' field
    if (Array.isArray(fields)) {
      while (true) {
        var index = fields.indexOf('system');
        if (index >= 0) {
          fields.splice(index, 1);
        } else {
          break;
        }
      }
    } else if (fields === Object(fields)) {
      var inclusiveMode = false;
      var keys = Object.keys(fields);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i]) {
          inclusiveMode = true;
          break;
        }
      }
      if (inclusiveMode) {
        delete fields.system;
      } else {
        fields.system = false;
      }
    }
  }

  return {
    insert: function(data, options, callback) {
      if (data._id) return callback(new Error('not allowed to specify _id'));
      if (data.system) return callback(new Error('not allowed to use system area'));
      if (data.created_time) return callback(new Error('not allowed to specify created_time'));
      if (data.owner) return callback(new Error('not allowed to specify owner'));
      if (data.meta) return callback(new Error('not allowed to specify meta'));

      async.every(data.scope || [{
        public: true
      }],

      function(item, cb) {
        var permission_name = 'UNKNOWN';
        if (item.public) {
          permission_name = 'CREATE_OBJECT_TO_PUBLIC';
        } else if (item.group_id) {
          permission_name = 'CREATE_OBJECT_TO_GROUP:' + item.group_id;
        } else if (item.user_id) {
          permission_name = 'CREATE_OBJECT_TO_USER:' + item.user_id;
        }
        authorization_manager.hasPermission(current_user_id, permission_name, object_type, data, function(err, ok) {
          //ignore err
          cb(ok);
        });
      }, function(ok) {
        if (!ok) return callback(new Error('no permission to create object'));

        data.created_time = new Date();
        data.owner = {
          user_id: current_user_id
        };
        createPrimaryKey(object_type, function(err, primary_key) {
          if (err) return callback(err);

          data._id = primary_key;

          collection.insert(data, options, function(err, result) {
            if (err) return callback(err);

            callback(null, result);
            processDestination(current_user_id, object_type, data);
          });
        });
      });
      return null;
    },

    update: function(query, data, options, callback) {
      var numKeys = 0;
      for (var key in data) {
        numKeys++;
        if (key.lastIndexOf('$', 0) !== 0) {
          // not update operator, forcing '$set'
          data = {
            $set: data
          };
          break;
        }
      }
      if (numKeys === 0) return callback(new Error('data is empty'));

      for (var op in data) {
        for (var field in data[op]) {
          field = field.split('.')[0];
          if (field === '_id') {
            return callback(new Error('not allowed to specify _id'));
          } else if (field === 'system') {
            return callback(new Error('not allowed to use system area'));
          } else if (field === 'created_time') {
            return callback(new Error('not allowed to specify created_time'));
          } else if (field === 'owner') {
            return callback(new Error('not allowed to specify owner'));
          } else if (field === 'meta') {
            return callback(new Error('not allowed to specify meta'));
          }
        }
      }

      var object_id = query._id;
      if (!object_id) return callback(new Error('no _id found in collection.update'));

      authorization_manager.hasPermission(current_user_id, 'UPDATE_OBJECT', object_type, object_id, function(err, ok) {
        if (!ok) return callback(new Error('no UPDATE_OBJECT permission'));

        collection.update(query, data, options, callback);
      });
      return null;
    },

    remove: function(query, options, callback) {
      var object_id = query._id;
      if (!object_id) return callback(new Error('no _id found in collection.update'));

      authorization_manager.hasPermission(current_user_id, 'DELETE_OBJECT', object_type, object_id, function(err, ok) {
        if (!ok) return callback(new Error('no DELETE_OBJECT permission'));

        collection.remove(query, options, callback);
      });
      return null;
    },

    findOne: function(query, fields, options, callback) {
      if (arguments.length === 2) {
        callback = fields;
        options = {};
        fields = null;
      } else if (arguments.length === 3) {
        callback = options;
        options = fields;
        fields = null;
      }

      fields = fields || options.fields || {};
      delete options.fields;
      modifyFields(fields);

      var object_id = query._id;
      if (!object_id) return callback(new Error('no _id found in collection.findOne'));

      authorization_manager.hasPermission(current_user_id, 'VIEW_OBJECT', object_type, object_id, function(err, ok) {
        if (!ok) return callback(new Error('no VIEW_OBJECT permission'));

        collection.findOne(query, fields, options, function(err, data) {
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
      return null;
    },

    find: function(query, fields, options, callback) {
      if (arguments.length === 2) {
        if (typeof fields === 'function') {
          callback = fields;
          options = {};
          fields = null;
        } else {
          options = fields;
          fields = null;
        }
      } else if (arguments.length === 3) {
        if (typeof options === 'function') {
          callback = options;
          options = fields;
          fields = null;
        }
      }

      var toArrayCallback = null;
      var toArray = function(cb) {
        toArrayCallback = cb;
      };

      callback = callback || function(err) {
        if (err) {
          console.log(err);
          if (toArrayCallback) {
            toArrayCallback(err, []);
          } else {
            toArray = function(cb) {
              cb(err, []);
            };
          }
        }
        return null;
      };

      fields = fields || options.fields || {};
      delete options.fields;
      modifyFields(fields);

      authorization_manager.hasPermission(current_user_id, 'VIEW_OBJECTS', object_type, query, function(err, ok) {
        if (!ok) return callback(new Error('no VIEW_OBJECTS permission'));

        authorization_manager.getScopeCriteria(current_user_id, function(err, criteria) {
          if (err) return callback(err);

          query = Object.keys(query).length > 0 ? {
            $and: [query, {
              $or: criteria
            }]
          } : {
            $or: criteria
          };
          collection.find(query, fields, options, function(err, cursor) {
            if (err) return callback(err);

            callback(null, cursor);
            if (toArrayCallback) cursor.toArray(toArrayCallback);
          });
        });
      });

      return {
        toArray: toArray
      };
    },

    count: function(query, options, callback) {
      if (arguments.length === 2) {
        callback = options;
        options = {};
      }

      authorization_manager.hasPermission(current_user_id, 'COUNT_OBJECTS', object_type, query, function(err, ok) {
        if (!ok) return callback(new Error('no COUNT_OBJECTS permission'));

        authorization_manager.getScopeCriteria(current_user_id, function(err, criteria) {
          if (err) return callback(err);

          query = Object.keys(query).length > 0 ? {
            $and: [query, {
              $or: criteria
            }]
          } : {
            $or: criteria
          };
          collection.count(query, options, callback);
        });
      });
      return null;
    },

    aggregate: function(pipeline, options, callback) {
      if (arguments.length === 2) {
        callback = options;
        options = {};
      }

      authorization_manager.hasPermission(current_user_id, 'AGGREGATE_OBJECTS', object_type, pipeline, function(err, ok) {
        if (!ok) return callback(new Error('no AGGREGATE_OBJECTS permission'));

        authorization_manager.getScopeCriteria(current_user_id, function(err, criteria) {
          if (err) return callback(err);

          pipeline.unshift({
            $match: {
              $or: criteria
            }
          });
          collection.aggregate(pipeline, options, callback);
        });
      });
      return null;
    }

  };
}

function getWrappedDb(current_user_id) {
  return {
    collection: function(object_type, options, callback) {
      if (arguments.length === 2) {
        callback = options;
        options = {};
      }
      getBareCollection(object_type, function(err, collection) {
        if (err) return callback(err);
        callback(null, getWrappedCollection(current_user_id, object_type, collection));
      });
    }
  };
}

function ensureUniqueIndex(collection_name, fields) {
  if (!Array.isArray(fields)) {
    fields = [fields];
  }
  getBareCollection(collection_name, function(err, collection) {
    if (err) return console.log('failed to get a collection.', err);

    collection.ensureIndex(_.object(_.map(fields, function(x) {
      return [x, 1];
    })), {
      unique: true
    }, function(err) {
      if (err) return console.log('failed to ensure index.', err);
    });
  });
}


function initialize(options) {
  var mongodb_url = options.mongodb_url || 'mongodb://localhost:27017/socialcmsdb';
  MongoClient.connect(mongodb_url, function(err, db) {
    if (err) return console.log('Unable to connect to MongoDB: ' + mongodb_url);

    console.log('Connected to MongoDB.');
    mongodb_db = db;

    var ensure_unique_index = options.ensure_unique_index;
    if (ensure_unique_index) {
      if (!Array.isArray(ensure_unique_index)) {
        ensure_unique_index = [ensure_unique_index];
      }
      _.each(ensure_unique_index, function(x) {
        if (x.object_type && x.object_fields) {
          ensureUniqueIndex(x.object_type, x.object_fields);
        } else {
          console.log('invalid ensure_unique_index option');
        }
      });
    }
  });
}


exports.initialize = initialize;
exports.getBareCollection = getBareCollection;
exports.getWrappedDb = getWrappedDb;
exports.createPrimaryKey = createPrimaryKey;
