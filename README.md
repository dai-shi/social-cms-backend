social-cms-backend
==================

Express middleware to provide schema-less REST APIs for creating a social networking website primarily using angular.js. It comes with built-in authentication, authorization and notification features.

How to install
--------------

    $ npm install social-cms-backend

How to use
----------

    var express = require('express');
    var SCB = require('social-cms-backend');
    var app = express();
    app.use(SCB.middleware({
      mongodb_url: 'mongodb://localhost:27017/socialcmsdb'
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

    POST /posts

    GET /posts?query=...

    GET /posts/inbox

    GET /posts/count

    GET /posts/123

    PUT /posts/123

    DELETE /posts/123

A special endpoint:

    GET /users/myself

Videos
------

### How to create a Twitter clone in 15 minutes
(still under recording)

<script src="http://dai-shi.github.io/social-cms-backend/jsttyplay/js/vt/parse.js"></script>
<script src="http://dai-shi.github.io/social-cms-backend/jsttyplay/js/vt/emulate.js"></script>
<script src="http://dai-shi.github.io/social-cms-backend/jsttyplay/js/ttyrec-browser.js"></script>
<script src="http://dai-shi.github.io/social-cms-backend/jsttyplay/js/binary-read.js"></script>
<script src="http://dai-shi.github.io/social-cms-backend/jsttyplay/js/vt/font.js"></script>
<script src="http://dai-shi.github.io/social-cms-backend/jsttyplay/js/vt/canvasview.js"></script>
<script src="http://dai-shi.github.io/social-cms-backend/javascripts/ttyplay.js"></script>
<canvas id="canvas" width="80" height="30">
<a href="http://dai-shi.github.io/social-cms-backend/">Visit the GitHub page</a>
</canvas>
<input type="button" value="Play" id="play" />
<input type="button" value="Pause" id="pause" />
<input type="button" value="PlayPause" id="playpause" />
<input type="button" value="Freeze" id="freeze" />
<input type="button" value="Thaw" id="thaw" />
<input type="button" value="Rewind" id="rewind" />

Notes:
* The result isn't working yet (no authentication logic).
* I found two bugs after recording.

TODOs
-----

* Authentication: email(digest auth), facebook
* Notification: email, facebook
