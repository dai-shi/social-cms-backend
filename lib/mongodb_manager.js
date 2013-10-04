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
var MongoClient = require('mongodb').MongoClient;

var mongodb_db = null;

var collection_map = {};

function getCollection(collection_name, callback) {
  if (collection_map[collection_name]) return callback(null, collection_map[collection_name]);
  if (!mongodb_db) return callback('no mongodb connection');

  mongodb_db.collection(collection_name, function(err, collection) {
    if (err) return callback(err);
    collection_map[collection_name] = collection;
    callback(null, collection);
  });
}

function ensureUniqueIndex(collection_name, fields) {
  if (!Array.isArray(fields)) {
    fields = [fields];
  }
  getCollection(collection_name, function(err, collection) {
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


var primary_key_map = {};

function createPrimaryKey(collection_name, callback) {
  if (primary_key_map[collection_name]) return callback(null, ++primary_key_map[collection_name]);

  getCollection(collection_name, function(err, collection) {
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
          primary_key_map[collection_name] = max_id + 1;
          callback(null, max_id + 1);
        }
      });
    });
  });
}

exports.initialize = initialize;
exports.getCollection = getCollection;
exports.createPrimaryKey = createPrimaryKey;
