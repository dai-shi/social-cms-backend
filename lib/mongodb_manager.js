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

var MongoClient = require('mongodb').MongoClient;

var mongodb_db = null;

function init(options) {
  var mongodb_url = options.mongodb_url || 'mongodb://localhost:27017/socialcmsdb';
  MongoClient.connect(mongodb_url, function(err, db) {
    if (err) {
      console.log('Unable to connect to MongoDB: ' + mongodb_url);
      return;
    }

    console.log('Connected to MongoDB.');
    mongodb_db = db;
  });
}

var post_collection = null;

function getPostCollection(callback) {
  if (post_collection) {
    callback(null, post_collection);
    return;
  }

  if (!mongodb_db) {
    callback('no mongodb connection');
    return;
  }

  mongodb_db.collection('post', function(err, collection) {
    if (err) {
      callback(err);
      return;
    }

    post_collection = collection;
    callback(null, post_collection);
  });
}

exports.init = init;
exports.getPostCollection = getPostCollection;
