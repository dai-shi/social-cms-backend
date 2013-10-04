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

REST APIs
---------

By default, there are 4 objects:
* post
* user
* group
* like

The following is the example of the post object endpoints.

    POST /posts           (body: a JSON w/o system preserved keys)

    GET /posts?query=...  (query: MongoDB query parameter stringified)

    GET /posts/inbox

    GET /posts/count?query=...

    GET /posts/123

    PUT /posts/123        (body: MongoDB update object)

    DELETE /posts/123

A special endpoint:

    GET /users/myself

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

* Authentication: email(digest auth)
* Notification: email
* Realtime support (socket.io)
