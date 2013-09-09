var assert = require('assert');
var express = require('express');
var request = require('request');
request = request.defaults({
  headers: {
    'user-agent': 'Mozilla/5.0' //facebook wants this
  }
});
var MongoClient = require('mongodb').MongoClient;
var mongodb_url = process.env.MONGODB_URL || 'mongodb://localhost:27017/socialcmsdb_test';
var facebook_app_id = process.env.FACEBOOK_APP_ID;
var facebook_app_secret = process.env.FACEBOOK_APP_SECRET;
var test_ready = facebook_app_id && facebook_app_secret && true;
if (!test_ready) {
  console.log('Not enough envvars for Facebook test, skipping...');
}
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
    if (!test_ready) return done();
    var app = express();
    app.use(SCB.middleware({
      mongodb_url: mongodb_url,
      passport_strategy: 'facebook',
      facebook_app_id: facebook_app_id,
      facebook_app_secret: facebook_app_secret,
      set_facebook_fullname: true
    }));
    server = app.listen(port);
    //wait a while for the mongodb connection to be ready
    setTimeout(done, 300);
  });
});


describe('authorization with facebook', function() {
  var facebook_app_access_token;
  var facebook_login_url;
  var facebook_user_id;
  var my_user_id;

  it('should get facebook app access token', function(done) {
    if (!test_ready) return done();
    request.get('https://graph.facebook.com/oauth/access_token?client_id=' + facebook_app_id + '&client_secret=' + facebook_app_secret + '&grant_type=client_credentials', function(error, response) {
      assert.equal(response.statusCode, 200);
      var match = /^access_token=(.*)$/.exec(response.body);
      assert.ok(match[1]);
      facebook_app_access_token = match[1];
      done();
    });
  });

  it('should get facebook test user account', function(done) {
    if (!test_ready) return done();
    request.get({
      uri: 'https://graph.facebook.com/' + facebook_app_id + '/accounts/test-users?installed=true&name=scbtest&locale=en_US&permissions=&method=post&access_token=' + facebook_app_access_token,
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 200);
      assert.ok(response.body.login_url);
      facebook_login_url = response.body.login_url;
      facebook_user_id = response.body.id;
      done();
    });
  });

  it('should login facebook', function(done) {
    if (!test_ready) return done();
    request.get('https://www.facebook.com', function() {
      request.get(facebook_login_url, function(error, response) {
        assert.equal(response.statusCode, 200, response.body);
        assert.ok(response.body.indexOf('scbtest') >= 0);
        done();
      });
    });
  });

  it('should login as the facebook user', function(done) {
    if (!test_ready) return done();
    request.get('http://localhost:' + port + '/login/facebook', function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      done();
    });
  });

  it('should set facebook fullname', function(done) {
    if (!test_ready) return done();
    setTimeout(function() {
      request.get('http://localhost:' + port + '/users/myself', {
        json: true
      }, function(error, response) {
        assert.equal(response.statusCode, 200, response.body);
        assert.equal(response.body.fullname, 'scbtest');
        my_user_id = response.body._id;
        done();
      });
    }, 300); //wait a little bit to finish setting fullname
  });

  it('should get current user object', function(done) {
    if (!test_ready) return done();
    SCB.getCurrentUserObject({
      user: my_user_id
    }, function(err, user_object) {
      if (err) return done(err);
      assert.equal(user_object._id, my_user_id);
      assert.equal(user_object.fullname, 'scbtest');
      assert.equal(user_object.system.facebook_user_id, facebook_user_id);
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
