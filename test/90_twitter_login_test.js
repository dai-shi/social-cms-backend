/* jshint undef: true, unused: true, latedef: true */
/* jshint quotmark: single, eqeqeq: true */
/* jshint node: true */

/* global describe, it */

var assert = require('assert');
var express = require('express');
var request = require('request');

request = request.defaults({
  headers: {
    'user-agent': 'Mozilla/5.0' //twitter wants this
  },
  jar: true
});

var MongoClient = require('mongodb').MongoClient;
var mongodb_url = process.env.TEST_MONGODB_URL || 'mongodb://localhost:27017/socialcmsdb_test';

var twitter_consumer_key = process.env.TWITTER_CONSUMER_KEY;
var twitter_consumer_secret = process.env.TWITTER_CONSUMER_SECRET;

//twitter account infomation for login test
var twitter_user_password = process.env.TWITTER_USER_PASSWORD;
var twitter_fullname = process.env.TWITTER_USER_FULLNAME;
var twitter_screen_name = process.env.TWITTER_SCREEN_NAME;
var twitter_user_id = process.env.TWITTER_USER_ID;

var test_ready = twitter_consumer_key && twitter_consumer_secret && twitter_user_password && twitter_fullname && twitter_screen_name && twitter_user_id && true;

if (!test_ready) {
  console.log('Not enough envvars for Twitter test, skipping...');
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
      passport_strategy: 'twitter',
      twitter_consumer_key: twitter_consumer_key,
      twitter_consumer_secret: twitter_consumer_secret,
      set_twitter_username: true
    }));
    server = app.listen(port);
    //wait a while for the mongodb connection to be ready
    setTimeout(done, 300);
  });
});


describe('authorization with twitter', function() {
  var my_user_id;
  var authenticity_token;
  var oauth_token;

  it('should get twitter authenticity token', function(done) {
    if (!test_ready) return done();
    //Get authenticity_token
    request.get('https://twitter.com/', function(error, response) {
      var match = /value="(.+)"\sname="authenticity_token"/.exec(response.body);
      assert.ok(match[1]);
      authenticity_token = match[1];
      done();
    });
  });

  it('should login twitter', function(done) {
    if (!test_ready) return done();
    request.post('https://twitter.com/sessions', {
      followAllRedirects: true,
      form: {
        'session[username_or_email]': twitter_screen_name,
        'session[password]': twitter_user_password,
        'return_to_ssl': true,
        'redirect_after_login': '/',
        'authenticity_token': authenticity_token,
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      done();
    });
  });

  it('should get twitter oauth token', function(done) {
    if (!test_ready) return done();
    request.get('http://localhost:' + port + '/login/twitter', {
        followAllRedirects: true,
      },
      function(error, response) {
        assert.equal(response.statusCode, 200, response.body);
        var match = /name="oauth_token"\stype="hidden"\svalue="(.+)"/.exec(response.body);
        assert.ok(match[1]);
        oauth_token = match[1];
        done();
      });
  });

  it('should login as the twitter user', function(done) {
    if (!test_ready) return done();
    request.post('https://api.twitter.com/oauth/authenticate', {
      followAllRedirects: true,
      form: {
        authenticity_token: authenticity_token,
        redirect_after_login: 'https://api.twitter.com/oauth/authenticate?oauth_token=' + oauth_token,
        oauth_token: oauth_token
      }
    }, function(error, response) {
      var match = /<a class="maintain-context" href="(.+)"/.exec(response.body);
      assert.ok(match[1]);
      var callback_url = match[1];
      request.get(callback_url, function(error, response) {
        assert.equal(response.statusCode, 200, response.body);
        done();
      });
    });
  });

  it('should set twitter fullname and screen_name', function(done) {
    if (!test_ready) return done();
    request.get('http://localhost:' + port + '/users/myself', {
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body.fullname, twitter_fullname);
      assert.equal(response.body.screen_name, twitter_screen_name);
      my_user_id = response.body._id;
      done();
    });
  });

  it('should get current user object', function(done) {
    if (!test_ready) return done();
    SCB.authorization_manager.getCurrentUserObject({
      user: my_user_id
    }, function(err, user_object) {
      if (err) return done(err);
      assert.equal(user_object._id, my_user_id);
      assert.equal(user_object.fullname, twitter_fullname);
      assert.equal(user_object.system.twitter_user_id, twitter_user_id);
      done();
    });
  });
});

describe('shutdown server', function() {
  it('should stop the server', function(done) {
    if (!test_ready) return done();
    server.close();
    done();
  });
});
