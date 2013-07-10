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

  it('should create a group with the user', function(done) {
    MongoClient.connect(mongodb_url, function(err, db) {
      if (err) return done(err);
      db.collection('group', function(err, collection) {
        if (err) return done(err);
        collection.insert({
          _id: 1,
          name: 'group1',
          members: [{
            user_id: 1
          }]
        }, {
          w: 1
        }, done);
      });
    });
  });

  it('should create a group with no member', function(done) {
    MongoClient.connect(mongodb_url, function(err, db) {
      if (err) return done(err);
      db.collection('group', function(err, collection) {
        if (err) return done(err);
        collection.insert({
          _id: 2,
          name: 'group2',
          members: []
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
    //wait a while for the mongodb connection to be ready
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
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body._id, 1);
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

  it('should post a new post with group scope', function(done) {
    request.post('http://localhost:' + port + '/posts', {
      json: {
        scope: [{
          group_id: 1
        }],
        foo: 'bar'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body._id, 2);
      done();
    });
  });

  it('should fail to post a new post with wrong group scope', function(done) {
    request.post('http://localhost:' + port + '/posts', {
      json: {
        scope: [{
          group_id: 2
        }],
        foo: 'bar'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 500);
      done();
    });
  });

  it('should fail to post a new post with non-existent group scope', function(done) {
    request.post('http://localhost:' + port + '/posts', {
      json: {
        scope: [{
          group_id: 9
        }],
        foo: 'bar'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 500);
      done();
    });
  });


  it('should post a new post with user scope', function(done) {
    request.post('http://localhost:' + port + '/posts', {
      json: {
        scope: [{
          user_id: 1
        }],
        foo: 'bar'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body._id, 3);
      done();
    });
  });

  it('should fail to post a new post with wrong user scope', function(done) {
    request.post('http://localhost:' + port + '/posts', {
      json: {
        scope: [{
          user_id: 9
        }],
        foo: 'bar'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 500);
      done();
    });
  });

  it('should post a new post with user/group scope', function(done) {
    request.post('http://localhost:' + port + '/posts', {
      json: {
        scope: [{
          user_id: 1,
          group_id: 1
        }],
        foo: 'bar'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body._id, 4);
      done();
    });
  });

  it('should fail to post a new post with wrong user/group scope', function(done) {
    request.post('http://localhost:' + port + '/posts', {
      json: {
        scope: [{
          user_id: 1,
          group_id: 2
        }],
        foo: 'bar'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 500);
      done();
    });
  });

});

describe('get post test', function() {
  it('should get a post', function(done) {
    request.get({
      url: 'http://localhost:' + port + '/posts/1',
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body.foo, 'bar');
      assert.equal(response.body._id, 1);
      done();
    });
  });

  it('should get a post', function(done) {
    request.get({
      url: 'http://localhost:' + port + '/posts/2',
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body.foo, 'bar');
      assert.equal(response.body._id, 2);
      done();
    });
  });

  it('should get a post', function(done) {
    request.get({
      url: 'http://localhost:' + port + '/posts/3',
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body.foo, 'bar');
      assert.equal(response.body._id, 3);
      done();
    });
  });

  it('should get a post', function(done) {
    request.get({
      url: 'http://localhost:' + port + '/posts/4',
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body.foo, 'bar');
      assert.equal(response.body._id, 4);
      done();
    });
  });

  it('should fail to get a post', function(done) {
    request.get({
      url: 'http://localhost:' + port + '/posts/9',
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 404);
      done();
    });
  });

});

describe('query post test', function() {
  it('should query posts', function(done) {
    request.get({
      url: 'http://localhost:' + port + '/posts',
      json: true,
      qs: {
        query: JSON.stringify({
          foo: 'bar'
        })
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body.length, 4);
      done();
    });
  });

  it('should fail to query posts', function(done) {
    request.get({
      url: 'http://localhost:' + port + '/posts',
      json: true,
      qs: {
        query: JSON.stringify({
          foo: 'xxx'
        })
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body.length, 0);
      done();
    });
  });

});

describe('delete post test', function() {
  it('should delete a post', function(done) {
    request({
      method: 'delete',
      url: 'http://localhost:' + port + '/posts/1',
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body.status, 'ok');
      done();
    });
  });

  it('should query remaining posts', function(done) {
    request.get({
      url: 'http://localhost:' + port + '/posts',
      json: true,
      qs: {
        query: JSON.stringify({
          foo: 'bar'
        })
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body.length, 3);
      done();
    });
  });

  it('should fail to delete a post', function(done) {
    request({
      method: 'delete',
      url: 'http://localhost:' + port + '/posts/9',
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 500, response.body);
      done();
    });
  });

});

describe('update post test', function() {
  it('should update a post', function(done) {
    request({
      method: 'put',
      url: 'http://localhost:' + port + '/posts/2',
      json: {
        $set: {
          foo: 'bar2',
          bar: 'bar'
        }
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body.status, 'ok');
      done();
    });
  });

  it('should get the updated post', function(done) {
    request.get({
      url: 'http://localhost:' + port + '/posts/2',
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body.foo, 'bar2');
      assert.equal(response.body.bar, 'bar');
      assert.equal(response.body.scope[0].group_id, 1);
      done();
    });
  });

});

describe('user creation test', function() {
  it('should create a new user', function(done) {
    request.post('http://localhost:' + port + '/login/local', {
      form: {
        mode: 'create',
        username: 'user001',
        password: 'password001',
        success_redirect: '/adduser_success'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 302);
      assert.equal(response.headers.location, '/adduser_success');
      done();
    });
  });

  it('should fail to create a new user without username', function(done) {
    request.post('http://localhost:' + port + '/login/local', {
      form: {
        mode: 'create',
        success_redirect: '/adduser_success'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 500);
      done();
    });
  });

  it('should fail to create an existing use', function(done) {
    request.post('http://localhost:' + port + '/login/local', {
      form: {
        mode: 'create',
        username: 'dummyuser',
        password: 'password002',
        success_redirect: '/adduser_success'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 500);
      done();
    });
  });

});
