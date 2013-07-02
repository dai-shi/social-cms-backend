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
    app.use(SCB.middleware({
      mongodb_url: mongodb_url
    }));
    app.listen(port);
    //wait a sec for mongodb connection be ready
    setTimeout(done, 300);
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

  it('should fail to login with empty password', function(done) {
    request.post('http://localhost:' + port + '/login/local', {
      form: {
        username: 'dummyuser',
        password: '',
        failed_redirect: '/loginfailed',
        success_redirect: '/loginsuccess'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 302);
      assert.equal(response.headers.location, '/loginfailed');
      done();
    });
  });

  it('should login as a user', function(done) {
    request.post('http://localhost:' + port + '/login/local', {
      form: {
        username: 'dummyuser',
        password: 'dummypassword',
        failed_redirect: '/loginfailed',
        success_redirect: '/loginsuccess'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 302);
      assert.equal(response.headers.location, '/loginsuccess');
      done();
    });
  });

});

describe('create post test', function() {
  it('should post a new post', function(done) {
    request.post('http://localhost:' + port + '/posts', {
      json: {
        foo: 'bar'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200);
      assert.equal(response.body.status, 'ok');
      done();
    });
  });

  it('should fail to post with _id', function(done) {
    request.post('http://localhost:' + port + '/posts', {
      json: {
        _id: 999,
        foo: 'bar'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 500);
      done();
    });
  });

  it('should fail to post with system', function(done) {
    request.post('http://localhost:' + port + '/posts', {
      json: {
        system: 'xxx',
        foo: 'bar'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 500);
      done();
    });
  });

  it('should fail to post with created_time', function(done) {
    request.post('http://localhost:' + port + '/posts', {
      json: {
        created_time: 'xxx',
        foo: 'bar'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 500);
      done();
    });
  });


  it('should fail to post with owner', function(done) {
    request.post('http://localhost:' + port + '/posts', {
      json: {
        owner: 'xxx',
        foo: 'bar'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 500);
      done();
    });
  });

  //TODO post (group scope, user scope, group/user scope)

});
