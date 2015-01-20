/* jshint undef: true, unused: true, latedef: true */
/* jshint quotmark: single, eqeqeq: true */
/* jshint node: true */

/* global describe, it */

var assert = require('assert');
var path = require('path');
var request = require('request');
var jsdom = require('jsdom');
var express = require('express');
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
      breeze_mongo: true,
      routes: [{
        object_type: 'user',
        object_prefix: '/breeze-service/users'
      }, {
        object_type: 'post',
        object_prefix: '/breeze-service/posts'
      }, {
        object_prefix: '/breeze-service/SaveChanges'
      }]
    }));
    app.use(express.static(path.join(__dirname, 'public')));
    server = app.listen(port);
    //wait a while for the mongodb connection to be ready
    setTimeout(done, 300);
  });
});

var jar001 = request.jar();

describe('form login', function() {
  it('should login as a dummy user', function(done) {
    request.post('http://localhost:' + port + '/login/local', {
      json: true,
      form: {
        username: 'dummyuser',
        password: 'dummypassword'
      },
      jar: jar001
    }, function(error, response) {
      assert.equal(response.statusCode, 200);
      assert.ok(response.body.user_id);
      done();
    });
  });
});

describe('basic', function() {
  it('test01', function(done) {
    var scripts = ['libs/jquery-2.0.2.js', 'libs/q.js', 'libs/breeze.debug.js', 'libs/breeze.dataservice.mongo.js', 'test.js', 'test01.js'].map(function(x) {
      return 'http://localhost:' + port + '/' + x;
    });
    jar001.getCookieString('http://localhost:' + port, function(err, cookieStr) {
      jsdom.env('http://localhost:' + port + '/test.html', scripts, {
        jar: jar001,
        document: {
          cookie: cookieStr,
          cookieDomain: 'localhost'
        }
      }, function(errors, window) {
        assert.ifError(errors);
        setTimeout(function() {
          assert.equal(window.document.getElementById('result').innerHTML, 'ok');
          done();
        }, 500);
      });
    });
  });

  it('test02', function(done) {
    var scripts = ['libs/jquery-2.0.2.js', 'libs/q.js', 'libs/breeze.debug.js', 'libs/breeze.dataservice.mongo.js', 'test.js', 'test02.js'].map(function(x) {
      return 'http://localhost:' + port + '/' + x;
    });
    jar001.getCookieString('http://localhost:' + port, function(err, cookieStr) {
      jsdom.env('http://localhost:' + port + '/test.html', scripts, {
        jar: jar001,
        document: {
          cookie: cookieStr,
          cookieDomain: 'localhost'
        }
      }, function(errors, window) {
        assert.ifError(errors);
        setTimeout(function() {
          assert.equal(window.document.getElementById('result').innerHTML, 'ok');
          done();
        }, 500);
      });
    });
  });

  it('test03', function(done) {
    var scripts = ['libs/jquery-2.0.2.js', 'libs/q.js', 'libs/breeze.debug.js', 'libs/breeze.dataservice.mongo.js', 'test.js', 'test03.js'].map(function(x) {
      return 'http://localhost:' + port + '/' + x;
    });
    jar001.getCookieString('http://localhost:' + port, function(err, cookieStr) {
      jsdom.env('http://localhost:' + port + '/test.html', scripts, {
        jar: jar001,
        document: {
          cookie: cookieStr,
          cookieDomain: 'localhost'
        }
      }, function(errors, window) {
        assert.ifError(errors);
        setTimeout(function() {
          assert.equal(window.document.getElementById('result').innerHTML, 'ok1ok2');
          done();
        }, 500);
      });
    });
  });

});


describe('no login', function() {
  it('should fail to get user/myself', function(done) {
    request.get('http://localhost:' + port + '/breeze-service/users/myself', {
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body.length, 0);
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
