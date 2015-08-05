social-cms-backend
==================

Express middleware to provide schema-less REST APIs for creating a social networking website primarily using angular.js. It comes with built-in authentication, authorization and notification features.

Motivation
----------

There exists several MVC framework libraries for node.js
that are inspired by Rails.  But they might be a bit outdated,
when it comes to angular.js, client-side MVW framework.
I would like to propose a maybe new style of web programming,
which is the combination of a domain-specific REST API library
(ready to use, no coding required) and client-side coding.

This project is to provide such a library for a web site
like SNS/Twitter/Facebook in a closed/private environment.

How to install
--------------

    $ npm install social-cms-backend

How to use
----------

    var express = require('express');
    var SCB = require('social-cms-backend');
    var app = express();
    app.use(SCB.middleware({
      mongodb_url: 'mongodb://localhost:27017/socialcmsdb',
      passport_strategy: 'facebook',
      facebook_app_id: process.env.FACEBOOK_APP_ID,
      facebook_app_secret: process.env.FACEBOOK_APP_SECRET
    }));
    app.listen(3000);

With socket.io v1.0

    var http = require('http');
    var express = require('express');
    var socket_io = require('socket.io');
    var SCB = require('social-cms-backend');
    var app = express();
    var SCB_options = {
      mongodb_url: 'mongodb://localhost:27017/socialcmsdb',
      passport_strategy: 'facebook',
      facebook_app_id: process.env.FACEBOOK_APP_ID,
      facebook_app_secret: process.env.FACEBOOK_APP_SECRET
    };
    app.use(SCB.middleware(SCB_options));
    var server = http.createServer(app);
    var sio = socket_io(server);
    sio.use(SCB.socket_io(SCB_options));
    server.listen(3000);

With HTTP DIGEST strategy:

    var SCB_options = {
      mongodb_url: 'mongodb://localhost:27017/socialcmsdb',
      passport_strategy: 'digest',
      auth_digest: {
        realm: 'my_realm'
      }
    };

With BreezeJS support:

    var SCB_options = {
      mongodb_url: 'mongodb://localhost:27017/socialcmsdb',
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
    };

REST APIs
---------

By default, there are 4 object types:
* user
* group
* post
* like

The following is the example of the post object endpoint.

### List post objects

    GET /posts?query=...

The "query" query parameter is a MongoDB query parameter object
that is stringified (probably by JSON.stringify).
* `skip` and `limit` query parameters are also supported.

### Get one post object

    GET /posts/123

The "123" is the `_id` of the post.

### Save a new post

    POST /posts

The body is an object (JSON format) without system preserved properties such as
`_id`, `system`, `created_time`, `owner`, `meta`.

### Update a post

    PUT /posts/123

The body is a MongoDB update object (JSON format) using update operators.

### Delete a post

    DELETE /posts/123

### Count posts

    GET /posts/count?query=...

This is a special endpoint.

### Get following posts

    GET /posts/inbox

This is a special endpoint to only get posts that matches with predefined "following".
More description follows in the next section.

### Aggregate Posts

    GET /posts/aggregate?pipeline=...

This is a special endpoint to use MongoDB aggregate command.
The "pipeline" query parameter is a MongoDB pipeline parameter object
that is stringified (probably by JSON.stringify).

User and Group
--------------

User objects can also be accessed by REST API.
For example, all user list can be fetched by

    GET /users

unless othrewise restricted.

To get login user information, use this special endpoint.

    GET /users/myself

To create a group, save a group object like the following:

    {
      members: [
        { user_id: 111 },
        { user_id: 112 },
        { user_id: 113 }
      ]
    }

The `user_id` is the `_id` attribute of a user object.

You can also define nested groups like the following:

    {
      members: [
        { user_id: 111 },
        { group_id: 211 },
        { group_id: 212 }
      ]
    }

The `group_id` is the `_id` attribute of a group object.

Access Control
--------------

Object read permission is handled by the `scope` attribute.
For example, if an object has the `scope` like this,

    {
      data: { ... },
      scope: {
        { user_id: 111 },
        { group_id: 211 }
      }
    }

this object can only be accessed by the user `user_id=111` and
all members of the group `group_id=211`.
Notice `data` attribute is just an example.

Object write permission is based on ownership,
which means an object can only be updated by the user who first saved.

These access control can be customized by `hasPermission` SCB option.

Followings and Followers
------------------------

There is a special endpoint `inbox`.
if an object has `destination` property and if a user follows
that destination, that object is added to the user `inbox`.
For example, suppose a user with `user_id=111` follows
another user with `user_id=112`, a user object will be

    {
      _id: 111,
      following: [{
        user_id: 112
      }]
    }

and if an object has `destination` like the following

    {
      destination: [{
        user_id: 112
      }]
    }

the user with `user_id=111` will see this object in one's own `inbox`.

A user can also follow a group, in this case the user object would look
like the following.

    {
      _id: 111,
      following: [{
        group_id: 211
      }]
    }

There is an SCB option `always_follow_myself` and if it is `true`,
it is equivalent to having a user `user_id=111` object like

    {
      _id: 111,
      following: [{
        user_id: 111
      }]
    }

for all users.

Push by socket.io
-----------------------------

If an object has a `destination` property and a user follows it,
the server pushes the object to to the user by socket.io,
if socket.io is configured properly (See the example in "How To Use").

For example, if a "post" object like the following is inserted;

    {
      destination: [{
        group_id: 211
      }]
    }

all the users who follow `group_id=211` will receive the whole object
as a message identified by `new-post`.
So the clients of the users are expected to listen to it by the following.

    socket.on('new-post', function(data) {
      //do something with data
    });

Extension to JSON format
------------------------

Sometimes, we want to encode JavaScript objects in JSON.
We have a special notion for `Date` and `RegExp` like the following.

    {"key1":"val1", "key2": "/Date(12345)/"} //12345 is milliseconds

    {"key3":"val3", "key4": "/RegExp([A-Z][a-z]+)/"}

Defining Object Types
---------------------

The examples above are all about the post object.
You can define any objects and their routes in an SCB option.

    routes: [{
      object_type: 'user',
      object_prefix: '/rest/users'
    }, {
      object_type: 'group',
      object_prefix: '/rest/posts'
    }, {
      object_type: 'article',
      object_prefix: '/rest/articles'
    }, {
      object_type: 'comment',
      object_prefix: '/rest/comments'
    }, {
      object_type: 'like',
      object_prefix: '/rest/likes'
    }]

However, keeping `user` and `group` objects are always required for
authentication and authorization.

If you want to create a unique index, you can define it in an SCB option.

    ensure_unique_index: {
      object_type: 'like',
      object_fields: ['owner', 'article_id']
    }

This will restrict one "like" at most for one article for each user.

Screencast
----------

### How to create a Twitter clone in 15 minutes

Screencast preview (quadruple speed):

![Preview](http://dai-shi.github.io/social-cms-backend/ttyrecord.gif)

<a href="http://dai-shi.github.io/social-cms-backend/ttyplay.html" target="_blank">Controllable screencast at normal speed</a>

Notes:

* There is a typo found after the recording.
  `/javascript/main.js -> /javascripts/main.js`
* The resulting code is available
  [here](https://github.com/dai-shi/twitter-clone-sample/tree/20130804_recorded)
* You can try the running web service of the code
  <a href="http://twitterclonesample-nodeangularapp.rhcloud.com/" target="_blank">here</a>

TODOs
-----

* Notification: email
