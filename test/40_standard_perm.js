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
      mongodb_url: mongodb_url
    }));
    server = app.listen(port);
    //wait a while for the mongodb connection to be ready
    setTimeout(done, 300);
  });
});

describe('user setup', function() {
  it('create users', function(done) {
    async.eachSeries([
      ['user001', 'pass001'],
      ['user002', 'pass002'],
      ['user003', 'pass003'],
      ['user004', 'pass004'],
      ['user005', 'pass005']
    ], function(item, done) {
      request.post('http://localhost:' + port + '/login/local', {
        form: {
          mode: 'create',
          username: item[0],
          password: item[1],
          success_redirect: '/adduser_success'
        }
      }, function(error, response) {
        assert.equal(response.statusCode, 302);
        assert.equal(response.headers.location, '/adduser_success');
        done();
      });
    }, done);
  });

});

describe('user ownership', function() {
  it('should login as user001', function(done) {
    request.post('http://localhost:' + port + '/login/local', {
      form: {
        username: 'user001',
        password: 'pass001',
        failed_redirect: '/loginfailed',
        success_redirect: '/loginsuccess'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 302);
      assert.equal(response.headers.location, '/loginsuccess');
      done();
    });
  });

  it('should post a new post', function(done) {
    request.post('http://localhost:' + port + '/posts', {
      json: {
        content: 'post001-001'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      done();
    });
  });

  it('should post a new post for user001', function(done) {
    request.post('http://localhost:' + port + '/posts', {
      json: {
        scope: [{
          user_id: 1
        }],
        content: 'post001-002'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      done();
    });
  });

  it('should fail to post a new post for user002', function(done) {
    request.post('http://localhost:' + port + '/posts', {
      json: {
        scope: [{
          user_id: 2
        }],
        content: 'post001-003'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 500, response.body);
      done();
    });
  });

  it('should fail to post a new post for user001 & user002', function(done) {
    request.post('http://localhost:' + port + '/posts', {
      json: {
        scope: [{
          user_id: 1
        }, {
          user_id: 2
        }],
        content: 'post001-004'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 500, response.body);
      done();
    });
  });

  it('should get the public post', function(done) {
    request.get('http://localhost:' + port + '/posts/1', {
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body.content, 'post001-001');
      done();
    });
  });

  it('should get the post for user001', function(done) {
    request.get('http://localhost:' + port + '/posts/2', {
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body.content, 'post001-002');
      done();
    });
  });

  it('should get posts for user001', function(done) {
    request.get('http://localhost:' + port + '/posts', {
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body.length, 2);
      done();
    });
  });

  it('should logout user001', function(done) {
    request.post('http://localhost:' + port + '/logout/local', {
      form: {
        success_redirect: '/logoutsuccess'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 302);
      assert.equal(response.headers.location, '/logoutsuccess');
      done();
    });
  });

  it('should login as user002', function(done) {
    request.post('http://localhost:' + port + '/login/local', {
      form: {
        username: 'user002',
        password: 'pass002',
        failed_redirect: '/loginfailed',
        success_redirect: '/loginsuccess'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 302);
      assert.equal(response.headers.location, '/loginsuccess');
      done();
    });
  });

  it('should get the public post', function(done) {
    request.get('http://localhost:' + port + '/posts/1', {
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body.content, 'post001-001');
      done();
    });
  });

  it('should fail to get the post for user001', function(done) {
    request.get('http://localhost:' + port + '/posts/2', {
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 404, response.body);
      done();
    });
  });



});















describe('shutdown server', function() {
  it('should stop the server', function(done) {
    server.close();
    done();
  });
});
