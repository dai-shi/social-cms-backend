var assert = require('assert');
var async = require('async');
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
});

var server;

describe('initialize server', function() {
  it('should start the server', function(done) {
    var app = express();
    app.use(SCB.middleware({
      mongodb_url: mongodb_url,
      passport_strategy: 'facebook'
    }));
    server = app.listen(port);
    //wait a while for the mongodb connection to be ready
    setTimeout(done, 300);
  });
});


describe('authorization with facebook', function(){
  it('should login in with a facebook account');
});
