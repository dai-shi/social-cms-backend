var express = require('express');
var expressSession = require('express-session');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require('./routes/index');

var app = express();
var http = require('http');
var socket_io = require('socket.io');
var SCB = require('social-cms-backend');
var SCB_options = {
  mongodb_url: 'mongodb://localhost:27017/socialcmsdb',
  passport_strategy: 'digest',
  session_middleware: require('express-session')({
    secret: 'dummy secret'
  }),
  auth_digest: {
    realm: 'my_realm'
  },
  always_follow_myself: true
};
app.use(SCB.middleware(SCB_options));
var server = http.createServer(app);
var sio = socket_io(server);
sio.use(SCB.socket_io(SCB_options));

var CryptoJS = require('crypto-js');

var client = require('mongodb').MongoClient;
client.connect('mongodb://localhost:27017/socialcmsdb', function(err, db) {
  if (err) console.log(err);
  db.dropDatabase();
  var userCollection = db.collection("user");
  userCollection.save({
    "_id": 1,
    "name": "ichiro",
    "owner": {
      "user_id": 1
    },
    "system": {
      "username": "ichiro",
      "passhash": CryptoJS.MD5('ichiro:my_realm:test').toString(),
      "remember_me": null
    }
  }, function(err, result) {
    userCollection.save({
      "_id": 2,
      "name": "jiro",
      "owner": {
        "user_id": 2
      },
      "system": {
        "username": "jiro",
        "passhash": CryptoJS.MD5('jiro:my_realm:test').toString(),
        "remember_me": null
      }
    }, function(err, result) {
      userCollection.save({
        "_id": 3,
        "name": "saburo",
        "owner": {
          "user_id": 3
        },
        "system": {
          "username": "saburo",
          "passhash": CryptoJS.MD5('saburo:my_realm:test').toString(),
          "remember_me": null
        }
      }, function(err, result) {
        var groupCollection = db.collection("group");
        groupCollection.save({
          "_id": 1,
          "name": "brother",
          "members": [{
            "user_id": 1
          }, {
            "user_id": 2
          }, {
            "user_id": 3
          }],
          "owner": {
            "user_id": 1
          }
        }, function(err, result) {
          userCollection.updateMany({
            "_id": 1
          }, {
            $set: {
              following: [{
                user_id: 2
              }, {
                group_id: 1
              }]
            }
          }, function(err, result) {
            if (err) console.log(err);
            userCollection.updateMany({
              "_id": 2
            }, {
              $set: {
                following: [{
                  user_id: 1
                }, {
                  group_id: 1
                }]
              }
            }, function(err, result) {
              userCollection.updateMany({
                "_id": 3
              }, {
                $set: {
                  following: [{
                    group_id: 1
                  }]
                }
              });
            });
          });
        });
      });
    });
  });
});
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/login/digest', function(req, res, next) {
  res.redirect('/');
});

/// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
server.listen(3000);
