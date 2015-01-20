/* jshint undef: true, unused: true, latedef: true */
/* jshint quotmark: single, eqeqeq: true */
/* jshint node: true */

/* global describe, it */

var assert = require('assert');
var async = require('async');
var http = require('http');
var express = require('express');
var socket_io = require('socket.io');
var socket_io_client = require('socket.io-client');
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
    var options = {
      mongodb_url: mongodb_url,
      session_middleware: require('express-session')({
        secret: 'dummy secret'
      })
    };
    app.use(SCB.middleware(options));
    server = http.createServer(app);
    var sio = socket_io(server);
    sio.use(SCB.socket_io(options));
    server.listen(port);
    //wait a while for the mongodb connection to be ready
    setTimeout(done, 300);
  });
});

describe('user setup', function() {
  it('create users', function(done) {
    async.eachSeries([
      ['user001', 'pass001'],
      ['user002', 'pass002']
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

var user_id_001;
var user_id_002;
var group_id_001;

describe('followership setup', function() {

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

  it('should create a group', function(done) {
    request.post('http://localhost:' + port + '/groups', {
      json: {
        members: [{
          user_id: user_id_001
        }, {
          user_id: user_id_002
        }]
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      group_id_001 = response.body._id;
      done();
    });
  });

  it('should follow user002 and group001 (user001)', function(done) {
    request.put('http://localhost:' + port + '/users/' + user_id_001, {
      json: {
        $set: {
          following: [{
            user_id: user_id_002
          }, {
            group_id: group_id_001
          }]
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

  it('should follow user001 and group001 (user002)', function(done) {
    request.put('http://localhost:' + port + '/users/' + user_id_002, {
      json: {
        $set: {
          following: [{
            user_id: user_id_001
          }, {
            group_id: group_id_001
          }]
        }
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      done();
    });
  });

});

describe('check inbox', function() {

  it('should post a public post without destination', function(done) {
    request.post('http://localhost:' + port + '/posts', {
      json: {
        content: 'post001'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      done();
    });
  });

  it('should post a public post with user002 destination', function(done) {
    request.post('http://localhost:' + port + '/posts', {
      json: {
        content: 'post002',
        destination: [{
          user_id: user_id_002
        }]
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      done();
    });
  });

  it('should post a public post with user001 destination', function(done) {
    request.post('http://localhost:' + port + '/posts', {
      json: {
        content: 'post003',
        destination: [{
          user_id: user_id_001
        }]
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      done();
    });
  });

  it('should get the inbox for user002', function(done) {
    request.get('http://localhost:' + port + '/posts/inbox', {
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body.length, 1);
      assert.equal(response.body[0].content, 'post003');
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

  it('should login as user001', function(done) {
    request.post('http://localhost:' + port + '/login/local', {
      json: true,
      form: {
        username: 'user001',
        password: 'pass001'
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      done();
    });
  });

  it('should get the inbox for user001', function(done) {
    request.get('http://localhost:' + port + '/posts/inbox', {
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body.length, 1);
      assert.equal(response.body[0].content, 'post002');
      done();
    });
  });

  it('should post a public post with group001 destination', function(done) {
    request.post('http://localhost:' + port + '/posts', {
      json: {
        content: 'post004',
        destination: [{
          group_id: group_id_001
        }]
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      done();
    });
  });

  it('should get the inbox for user001', function(done) {
    request.get('http://localhost:' + port + '/posts/inbox', {
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body.length, 2);
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

  it('should get the inbox for user002', function(done) {
    request.get('http://localhost:' + port + '/posts/inbox', {
      json: true
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.body.length, 2);
      done();
    });
  });

  //
  // socket.io test
  //
  var socket_user002;
  var last_data_user002 = null;
  it('should connect socket.io for user002', function(done) {
    var cookie = request.get('http://localhost:' + port + '/').headers.cookie;
    var myAgent = new http.Agent();
    myAgent._addRequest = myAgent.addRequest;
    myAgent.addRequest = function(req, host, portnum, localAddress) {
      if (host === 'localhost' && portnum == port) { // jshint ignore: line
        var old = req._headers.cookie;
        req._headers.cookie = cookie + (old ? '; ' + old : '');
        req._headerNames.cookie = 'Cookie';
      }
      return myAgent._addRequest(req, host, portnum, localAddress);
    };
    socket_user002 = socket_io_client('http://localhost:' + port + '/', {
      agent: myAgent
    });
    socket_user002.on('connect', function() {
      socket_user002.on('new-post', function(data) {
        last_data_user002 = data;
      });
      done();
    });
  });

  it('should recieve push via socket.io for user002', function(done) {
    request.post('http://localhost:' + port + '/posts', {
      json: {
        content: 'post005',
        destination: [{
          group_id: group_id_001
        }]
      }
    }, function(error, response) {
      assert.equal(response.statusCode, 200, response.body);
      setTimeout(function() {
        assert.ok(last_data_user002);
        assert.equal(last_data_user002.content, 'post005');
        done();
      }, 100);
    });
  });

});


describe('shutdown server', function() {
  it('should stop the server', function(done) {
    server.close();
    done();
  });
});
