/* jshint undef: true, unused: true, latedef: true */
/* jshint quotmark: single, eqeqeq: true */
/* jshint node: true */

/* global describe, it */

var assert = require('assert');
var express = require('express');
var request = require('request');
request = request.defaults({
  jar: true
});
var MongoClient = require('mongodb').MongoClient;
var mongodb_url = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/socialcmsdb_test';
var SCB = require('../lib/index.js');
var port = process.env.PORT || 27891;

describe('initialize database', function() {
  it('should clear the test database', function(done) {
    MongoClient.connect(mongodb_url, function(err, db) {
      if (err) return done(err);
      db.dropDatabase(done);
    });
  });

  it('should create a dummy user account', function(done) {
    MongoClient.connect(mongodb_url, function(err, db) {
      if (err) return done(err);
      db.collection('user', function(err, collection) {
        if (err) return done(err);
        collection.insert({
          _id: 1,
          system: {
            username: 'dummyuser',
            password: 'dummypassword'
          }
        }, {
          w: 1
        }, done);
      });
    });
  });

});

var server;

describe('initialize server', function() {
  it('should start the server', function(done) {
    var app = express();
    app.use(SCB.middleware({
      mongodb_url: mongodb_url,
      ensure_unique_index: {
        object_type: 'like',
        object_fields: ['owner', 'post_id']
      }
    }));
    server = app.listen(port);
    //wait a while for the mongodb connection to be ready
    setTimeout(done, 300);
  });
});

describe('form login test', function() {
  it('should login as a user', function(done) {
    request.post('http://localhost:' + port + '/login/local', {
      json: true,
      form: {
        username: 'dummyuser',
        password: 'dummypassword'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200);
      assert.ok(response.body.user_id);
      done();
    });
  });

});

var base_post_id;

describe('create post test', function() {
  it('should post a new post with special json', function(done) {
    request.post('http://localhost:' + port + '/posts', {
      json: {
        foo: 'bar',
        date: '/Date(123456789)/',
        regex: '/RegExp([0-9]+)/'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.ok(response.body._id);
      base_post_id = response.body._id;
      done();
    });
  });

  it('should special json has proper types', function(done) {
    MongoClient.connect(mongodb_url, function(err, db) {
      if (err) return done(err);
      db.collection('post', function(err, collection) {
        if (err) return done(err);
        collection.findOne({
          _id: base_post_id,
        }, function(err, result) {
          if (err) return done(err);
          assert.ok(result.date instanceof Date);
          assert.ok(result.regex instanceof RegExp);
          done();
        });
      });
    });
  });

});

describe('shutdown server', function() {
  it('should stop the server', function(done) {
    server.close();
    done();
  });
});
