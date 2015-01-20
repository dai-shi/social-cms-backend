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

var async = require('async');
var breezeMongo = require('breeze-mongodb');

var mongodb_manager = require('./mongodb_manager.js');
var authorization_manager = require('./authorization_manager.js');

function parseIntSafely(str) {
  if (/[1-9][0-9]*/.exec(str)) {
    return parseInt(str, 10);
  } else {
    return str;
  }
}

function parseJSONReceiver(key, value) {
  if (typeof value === 'string') {
    var match = /^\/Date\((\d+)\)\/$/.exec(value);
    if (match) {
      return new Date(parseInt(match[1], 10));
    }
  }
  return value;
}

function parseJSON(str) {
  try {
    return JSON.parse(str, parseJSONReceiver);
  } catch (e) {
    return null; //it's better to raise an error, though.
  }
}

function DefaultInsertHandler(db, object_type, data, callback) {
  this.db = db;
  this.object_type = object_type;
  this.data = data;
  this.callback = callback;
}

DefaultInsertHandler.prototype.run = function() {
  var self = this;
  var opts = {
    w: 1
  };
  this.db.collection(this.object_type, function(err, collection) {
    if (err) return self.callback(err);
    collection.insert(self.data, opts, function(err, result) {
      if (err) return self.callback(err);
      self.callback(null, result.length ? result[0] : result);
    });
  });
};

function DefaultFindOneHandler(db, object_type, object_id, callback) {
  this.db = db;
  this.object_type = object_type;
  this.object_id = object_id;
  this.callback = callback;
}

DefaultFindOneHandler.prototype.run = function() {
  var self = this;
  this.db.collection(this.object_type, function(err, collection) {
    if (err) return self.callback(err);
    collection.findOne({
      _id: parseIntSafely(self.object_id)
    }, self.callback);
  });
};

function DefaultFindHandler(db, object_type, query, sort, skip, limit, callback) {
  this.db = db;
  this.object_type = object_type;
  this.query = query || {};
  this.sort = sort || [
    ['created_time', 'desc']
  ];
  this.skip = skip || 0;
  this.limit = limit || 20;
  this.callback = callback;
}

DefaultFindHandler.prototype.run = function() {
  var self = this;
  var opts = {
    sort: this.sort,
    skip: this.skip,
    limit: this.limit
  };
  this.db.collection(this.object_type, function(err, collection) {
    if (err) return self.callback(err);
    var execQuery = function(query, callback) {
      collection.find(query, opts, function(err, cursor) {
        if (err) return callback(err);
        cursor.toArray(callback);
      });
    };
    if (Array.isArray(self.query)) {
      async.map(self.query, execQuery, self.callback);
    } else {
      execQuery(self.query, self.callback);
    }
  });
};

function DefaultCountHandler(db, object_type, query, callback) {
  this.db = db;
  this.object_type = object_type;
  this.query = query || {};
  this.callback = callback;
}

DefaultCountHandler.prototype.run = function() {
  var self = this;
  this.db.collection(this.object_type, function(err, collection) {
    if (err) return self.callback(err);
    var execQuery = function(query, callback) {
      collection.count(query, function(err, result) {
        if (err) return callback(err);
        callback(null, {
          count: result
        });
      });
    };
    if (Array.isArray(self.query)) {
      async.map(self.query, execQuery, self.callback);
    } else {
      execQuery(self.query, self.callback);
    }
  });
};

function DefaultAggregateHandler(db, object_type, pipeline, callback) {
  this.db = db;
  this.object_type = object_type;
  this.pipeline = pipeline || [];
  this.callback = callback;
}

DefaultAggregateHandler.prototype.run = function() {
  var self = this;
  this.db.collection(this.object_type, function(err, collection) {
    if (err) return self.callback(err);
    collection.aggregate(self.pipeline, function(err, result) {
      if (err) return self.callback(err);
      self.callback(null, result);
    });
  });
};

function DefaultRemoveHandler(db, object_type, object_id, callback) {
  this.db = db;
  this.object_type = object_type;
  this.object_id = object_id;
  this.callback = callback;
}

DefaultRemoveHandler.prototype.run = function() {
  var self = this;
  this.db.collection(this.object_type, function(err, collection) {
    if (err) return self.callback(err);
    collection.remove({
      _id: parseIntSafely(self.object_id)
    }, {
      w: 1
    }, function(err) {
      if (err) {
        if (err.message === 'no DELETE_OBJECT permission') {
          return self.callback(err);
        } else {
          return self.callback(null, null); //not found
        }
      }
      self.callback(null, true);
    });
  });
};

function DefaultUpdateHandler(db, object_type, object_id, data, callback) {
  delete data._id; // to work nice with angular-resource.js
  this.db = db;
  this.object_type = object_type;
  this.object_id = object_id;
  this.data = data;
  this.callback = callback;
}

DefaultUpdateHandler.prototype.run = function() {
  var self = this;
  this.db.collection(this.object_type, function(err, collection) {
    if (err) return self.callback(err);
    collection.update({
      _id: parseIntSafely(self.object_id)
    }, self.data, {
      w: 1
    }, function(err) {
      if (err) {
        if (err.message === 'no UPDATE_OBJECT permission') {
          return self.callback(err);
        } else {
          return self.callback(null, null); //not found
        }
      }
      self.callback(null, true);
    });
  });
};


module.exports = function(object_type, options) {
  var rePathCount = new RegExp('^/count($|\\?)');
  var rePathAggregate = new RegExp('^/aggregate($|\\?)');
  var rePathInbox = new RegExp('^/inbox($|\\?)');
  var rePathMyself = new RegExp('^/myself$');
  var rePathId = new RegExp('^/(\\w+)$');
  var rePathNone = new RegExp('^/?($|\\?)');

  function handleGet(req, res) {
    var current_user_id = authorization_manager.getCurrentUserId(req);
    var handler;
    var object_id;
    if (options.breeze_mongo) {
      var query = new breezeMongo.MongoQuery(req.query);
      query.execute(mongodb_manager.getWrappedDb(current_user_id), object_type, function(err, results) {
        if (err) {
          res.status(403).send('unable to process breeze get query: ' + err);
        } else {
          res.setHeader('Content-Type', 'application/json');
          res.send(results);
        }
      });
    } else if (rePathCount.test(req.url)) {
      handler = new DefaultCountHandler(mongodb_manager.getWrappedDb(current_user_id), object_type, parseJSON(req.query.query), function(err, result) {
        if (err) {
          res.status(403).send('unable to count objects: ' + err);
        } else {
          res.json(result);
        }
      });
      handler.run();
    } else if (rePathAggregate.test(req.url)) {
      handler = new DefaultAggregateHandler(mongodb_manager.getWrappedDb(current_user_id), object_type, parseJSON(req.query.pipeline), function(err, result) {
        if (err) {
          res.status(403).send('unable to aggregate objects: ' + err);
        } else {
          res.json(result);
        }
      });
      handler.run();
    } else if (rePathInbox.test(req.url)) {
      handler = new DefaultFindHandler(mongodb_manager.getWrappedDb(current_user_id), object_type, {
        'system.followers': current_user_id
      }, null, req.query.skip, req.query.limit, function(err, result) {
        if (err) {
          res.status(403).send('unable to get inbox ' + err);
        } else {
          res.json(result);
        }
      });
      handler.run();
    } else if (rePathMyself.test(req.url)) {
      if (current_user_id) {
        object_id = current_user_id;
        handler = new DefaultFindOneHandler(mongodb_manager.getWrappedDb(current_user_id), object_type, object_id, function(err, result) {
          if (err) {
            res.status(403).send('unable to get an object: ' + err);
          } else if (result) {
            res.json(result);
          } else {
            res.status(404).send('not found');
          }
        });
        handler.run();
      } else {
        res.status(403).send('not logged in');
      }
    } else if (rePathNone.test(req.url)) {
      handler = new DefaultFindHandler(mongodb_manager.getWrappedDb(current_user_id), object_type, parseJSON(req.query.query), parseJSON(req.query.sort), req.query.skip, req.query.limit, function(err, result) {
        if (err) {
          res.status(403).send('unable to query objects: ' + err);
        } else {
          res.json(result);
        }
      });
      handler.run();
    } else {
      var match = rePathId.exec(req.url);
      if (match) {
        object_id = match[1];
        handler = new DefaultFindOneHandler(mongodb_manager.getWrappedDb(current_user_id), object_type, object_id, function(err, result) {
          if (err) {
            res.status(403).send('unable to get an object: ' + err);
          } else if (result) {
            res.json(result);
          } else {
            res.status(404).send('not found');
          }
        });
        handler.run();
      } else {
        res.status(404).send('not found');
      }
    }
  }

  function handlePost(req, res) {
    var current_user_id = authorization_manager.getCurrentUserId(req);
    if (options.breeze_mongo) {
      var saveHandler = new breezeMongo.MongoSaveHandler(mongodb_manager.getWrappedDb(current_user_id), req.body, function(err, results) {
        if (err) {
          res.status(403).send('unable to process breeze save handler: ' + err);
        } else {
          res.setHeader('Content-Type', 'application/json');
          res.send(results);
        }
      });
      saveHandler.save();
    } else if (rePathNone.test(req.url)) {
      var handler = new DefaultInsertHandler(mongodb_manager.getWrappedDb(current_user_id), object_type, req.body, function(err, result) {
        if (err) {
          res.status(403).send('unable to create a new object: ' + err);
        } else {
          res.json(result);
        }
      });
      handler.run();
    } else {
      res.status(404).send('not found');
    }
  }

  function handleDelete(req, res) {
    var current_user_id = authorization_manager.getCurrentUserId(req);
    var match = rePathId.exec(req.url);
    var handler;
    var object_id;
    if (match) {
      object_id = match[1];
      handler = new DefaultRemoveHandler(mongodb_manager.getWrappedDb(current_user_id), object_type, object_id, function(err, result) {
        if (err) {
          res.status(403).send('unable to remove an object: ' + err);
        } else if (result) {
          res.json({
            status: 'ok'
          });
        } else {
          res.status(404).send('not found');
        }
      });
      handler.run();
    } else {
      res.status(404).send('not found');
    }
  }

  function handlePut(req, res) {
    var current_user_id = authorization_manager.getCurrentUserId(req);
    var match = rePathId.exec(req.url);
    var handler;
    var object_id;
    if (match) {
      object_id = match[1];
      handler = new DefaultUpdateHandler(mongodb_manager.getWrappedDb(current_user_id), object_type, object_id, req.body, function(err, result) {
        if (err) {
          res.status(403).send('unable to update an object: ' + err);
        } else if (result) {
          res.json({
            status: 'ok'
          });
        } else {
          res.status(404).send('not found');
        }
      });
      handler.run();
    } else {
      res.status(404).send('not found');
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
      res.status(400).send('bad request');
    }
  };
};
