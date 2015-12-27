var express = require('express');
var expressSession = require('express-session');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

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
    realm: 'my_realm',
    login_success_path: '/'
  },
  always_follow_myself: true
};
app.use(SCB.middleware(SCB_options));
var server = http.createServer(app);
var sio = socket_io(server);
sio.use(SCB.socket_io(SCB_options));

var crypto = require('crypto');
var md5 = function(str) {
  return crypto.createHash('md5').update(str).digest('hex');
};

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
      "passhash": md5('ichiro:my_realm:test'),
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
        "passhash": md5('jiro:my_realm:test'),
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
          "passhash": md5('saburo:my_realm:test'),
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

app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function(req, res){
  res.sendFile(__dirname + '/views/index.html');
});
server.listen(3000);
