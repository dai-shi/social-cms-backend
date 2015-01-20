/* jshint undef: true, unused: true, latedef: true */
/* jshint quotmark: single, eqeqeq: true */
/* jshint node: true */

/* global describe, it */

var assert = require('assert');
var async = require('async');
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
      ['user005', 'pass005'],
      ['user006', 'pass006']
    ], function(item, done) {
      request.post('http://localhost:' + port + '/adduser/local', {
        form: {
          username: item[0],
          password: item[1]
        }
      }, function(error, response) {
        assert.equal(response.statusCode, 200, response.body);
        done();
      });
    }, done);
  });

});

describe('user ownership', function() {
  var user_id_001;
  var user_id_002;

  it('should login as user001', function(done) {
    request.post('http://localhost:' + port + '/login/local', {
      json: true,
      form: {
        username: 'user001',
        password: 'pass001'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      user_id_001 = response.body.user_id;
      user_id_002 = user_id_001 + 1;
      done();
    });
  });

  var post_id_001;
  var post_id_002;

  it('should post a new post', function(done) {
    request.post('http://localhost:' + port + '/posts', {
      json: {
        content: 'post001-001'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      post_id_001 = response.body._id;
      post_id_002 = post_id_001 + 1;
      done();
    });
  });

  it('should post a new post for user001', function(done) {
    request.post('http://localhost:' + port + '/posts', {
      json: {
        scope: [{
          user_id: user_id_001
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
          user_id: user_id_002
        }],
        content: 'post001-003'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 403, response.body);
      done();
    });
  });

  it('should fail to post a new post for user001 & user002', function(done) {
    request.post('http://localhost:' + port + '/posts', {
      json: {
        scope: [{
          user_id: user_id_001
        }, {
          user_id: user_id_002
        }],
        content: 'post001-004'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 403, response.body);
      done();
    });
  });

  it('should get the public post', function(done) {
    request.get('http://localhost:' + port + '/posts/' + post_id_001, {
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body.content, 'post001-001');
      done();
    });
  });

  it('should get the post for user001', function(done) {
    request.get('http://localhost:' + port + '/posts/' + post_id_002, {
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

  it('should update the public post by user001', function(done) {
    request.put('http://localhost:' + port + '/posts/' + post_id_001, {
      json: {
        $set: {
          foo: 'bar'
        }
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      done();
    });
  });

  it('should logout user001', function(done) {
    request.post('http://localhost:' + port + '/logout/local', {
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      done();
    });
  });

  it('should login as user002', function(done) {
    request.post('http://localhost:' + port + '/login/local', {
      json: true,
      form: {
        username: 'user002',
        password: 'pass002'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      done();
    });
  });

  it('should get the public post', function(done) {
    request.get('http://localhost:' + port + '/posts/' + post_id_001, {
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body.content, 'post001-001');
      done();
    });
  });

  it('should fail to get the post for user001', function(done) {
    request.get('http://localhost:' + port + '/posts/' + post_id_002, {
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 404, response.body);
      done();
    });
  });

  it('should fail to update the public post by user001', function(done) {
    request.put('http://localhost:' + port + '/posts/' + post_id_001, {
      json: {
        $set: {
          foo: 'bar'
        }
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 403, response.body);
      done();
    });
  });

  it('should logout user002', function(done) {
    request.post('http://localhost:' + port + '/logout/local', {
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      done();
    });
  });

});


describe('user friendship', function() {
  var user_id_003;
  var user_id_004;

  it('should login as user003', function(done) {
    request.post('http://localhost:' + port + '/login/local', {
      json: true,
      form: {
        username: 'user003',
        password: 'pass003'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      user_id_003 = response.body.user_id;
      user_id_004 = user_id_003 + 1;
      done();
    });
  });

  it('should make user004 as a friend', function(done) {
    request.put('http://localhost:' + port + '/users/' + user_id_003, {
      json: {
        $push: {
          friends: {
            user_id: user_id_004
          }
        }
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      done();
    });
  });

  it('should logout user003', function(done) {
    request.post('http://localhost:' + port + '/logout/local', {
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      done();
    });
  });

  it('should login as user004', function(done) {
    request.post('http://localhost:' + port + '/login/local', {
      json: true,
      form: {
        username: 'user004',
        password: 'pass004'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      done();
    });
  });

  it('should make user003 as a friend', function(done) {
    request.put('http://localhost:' + port + '/users/' + user_id_004, {
      json: {
        $push: {
          friends: {
            user_id: user_id_003
          }
        }
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      done();
    });
  });

  var post_id_003;

  it('should post a new post for user003 & user004', function(done) {
    request.post('http://localhost:' + port + '/posts', {
      json: {
        scope: [{
          user_id: user_id_003
        }, {
          user_id: user_id_004
        }],
        content: 'post002-001'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      post_id_003 = response.body._id;
      done();
    });
  });

  it('should get the post for user004', function(done) {
    request.get('http://localhost:' + port + '/posts/' + post_id_003, {
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body.content, 'post002-001');
      done();
    });
  });

  it('should logout user004', function(done) {
    request.post('http://localhost:' + port + '/logout/local', {
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      done();
    });
  });

  it('should login as user003', function(done) {
    request.post('http://localhost:' + port + '/login/local', {
      json: true,
      form: {
        username: 'user003',
        password: 'pass003'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      done();
    });
  });

  it('should get the post for user003', function(done) {
    request.get('http://localhost:' + port + '/posts/' + post_id_003, {
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body.content, 'post002-001');
      done();
    });
  });

});


describe('group membership', function() {
  var user_id_005;
  var user_id_006;

  it('should login as user005', function(done) {
    request.post('http://localhost:' + port + '/login/local', {
      json: true,
      form: {
        username: 'user005',
        password: 'pass005'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      user_id_005 = response.body.user_id;
      user_id_006 = user_id_005 + 1;
      done();
    });
  });

  var group_id_001;

  it('should create a group', function(done) {
    request.post('http://localhost:' + port + '/groups', {
      json: {
        members: [{
          user_id: user_id_005
        }, {
          user_id: user_id_006
        }]
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      group_id_001 = response.body._id;
      done();
    });
  });

  var post_id_004;

  it('should post a new post for the group', function(done) {
    request.post('http://localhost:' + port + '/posts', {
      json: {
        scope: [{
          group_id: group_id_001
        }],
        content: 'post003-001'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      post_id_004 = response.body._id;
      done();
    });
  });

  it('should get the post for the group (user005)', function(done) {
    request.get('http://localhost:' + port + '/posts/' + post_id_004, {
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body.content, 'post003-001');
      done();
    });
  });

  it('should logout user005', function(done) {
    request.post('http://localhost:' + port + '/logout/local', {
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      done();
    });
  });

  it('should login as user006', function(done) {
    request.post('http://localhost:' + port + '/login/local', {
      json: true,
      form: {
        username: 'user006',
        password: 'pass006'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      done();
    });
  });

  it('should get the post for the group (user006)', function(done) {
    request.get('http://localhost:' + port + '/posts/' + post_id_004, {
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body.content, 'post003-001');
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
