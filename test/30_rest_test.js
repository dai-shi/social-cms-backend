var assert = require('assert');
var express = require('express');
var request = require('request');
var MongoClient = require('mongodb').MongoClient;
var mongodb_url = process.env.MONGODB_URL || 'mongodb://localhost:27017/socialcmsdb_test';
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

describe('initialize server', function() {
  it('should start the server', function(done) {
    var app = express();
    app.use(SCB.middleware());
    app.listen(port);
    //wait a sec for mongodb connection be ready
    setTimeout(done, 1000);
  });
});

describe('form login test', function() {
  it('should fail to login as unknown user', function(done) {
    request.post('http://localhost:' + port + '/login/local', {
      form: {
        username: 'xxx',
        password: 'yyy',
        failed_redirect: '/loginfailed',
        success_redirect: '/loginsuccess'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 302);
      assert.equal(response.headers.location, '/loginfailed');
      done();
    });
  });

  it('should fail to login with empty password');
  it('should login as a user');
});

describe('create post test', function() {
  it('should post a post');
});
