//var assert = require('assert');
var express = require('express');
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
});

describe('initialize server', function() {
  it('should start the server', function(done) {
    var app = express();
    app.use(SCB.middleware());
    app.listen(port);
    done();
  });
  it('should create a dummy user account');
});

describe('form login test', function() {
  it('should login as a user');
  it('should fail to login with empty password');
  it('should fail to login as unknown user');
});

describe('create post test', function() {
  it('should post a post');
});
