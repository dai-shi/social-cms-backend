/*
  Copyright (C) 2014, Daishi Kato <daishi@axlight.com>
  All rights reserved.
*/

/* jshint undef: true, unused: true, latedef: true */
/* jshint quotmark: single, eqeqeq: true, camelcase: true */
/* jshint node: true */

'use strict';

var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var expressSession = require('express-session');
var SCB = require('social-cms-backend');
var app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(bodyParser.json({
  reviver: SCB.middleware.parseJSONReceiver
}));
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(cookieParser());

app.use(SCB.middleware({
  mongodbUrl: process.env.MONGODB_URL || process.env.MONGOHQ_URL,
  sessionMiddleware: expressSession({
    secret: process.env.SESSION_SECRET || 'secret-02735980257d257e7988b81',
    resave: false,
    saveUninitialized: true
  }),
  passportStrategy: 'local',
  login_path: '/login/local',
  adduser_path: '/adduser/local',
  login_success_local_path: '/#/home',
  login_failed_local_path: '/#/login',
}));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/');
});

app.get('/', function(req, res) {
  res.render('index');
});

app.get(/^\/(.+)\.html$/, function(req, res) {
  var viewName = req.params[0];
  res.render(viewName);
});

app.listen(process.env.PORT || 3000);
