/*
  Copyright (C) 2014-2015, Daishi Kato <daishi@axlight.com>
  All rights reserved.
*/

/* jshint undef: true, unused: true, latedef: true */
/* jshint quotmark: single, eqeqeq: true, camelcase: true */
/* jshint devel: true, globalstrict: true */

/* global angular */

'use strict';

angular.module('mainModule', ['ngRoute', 'ngResource', 'ngSanitize', 'ngAnimate', 'mgcrea.ngStrap', 'ngCookies']);

angular.module('mainModule').config(function($routeProvider) {
  $routeProvider.
  when('/home', {
    templateUrl: 'partials/home.html',
    controller: 'homeController'
  }).
  when('/login', {
    templateUrl: 'partials/login.html',
    controller: 'loginController'
  }).
  when('/addUser', {
    templateUrl: 'partials/addUser.html',
    controller: 'addUserController'
  }).
  when('/about', {
    templateUrl: 'partials/about.html'
  }).
  otherwise({
    redirectTo: '/login'
  });
});

angular.module('mainModule').run(function($rootScope, userResource) {
  userResource.get({
    id: 'myself'
  }, function(data) {
    $rootScope.myself = data;
  });
});

angular.module('mainModule').controller('homeController', function($scope, $cookies, postResource) {

  // check login error
  if ($cookies['hajuku-input-login']) {
    delete $cookies['hajuku-input-login'];
  }

  function fetchPosts() {
    postResource.query(function(data) {
      console.log(data, 889);
      $scope.posts = data;
    });
  }
  fetchPosts();
console.log($scope.myself);
  $scope.addPost = function(message) {
    if (!message) return;
    if (!$scope.myself) return;
    postResource.save({
      message: message,
      from: {
        // id: 'local_' + $scope.myself._id,
        name: $scope.username
      }
    }, fetchPosts);
  };
});

angular.module('mainModule').controller('loginController', function($scope, $cookies) {

  // check login error
  if ($cookies['hajuku-input-login']) {
    window.alert('Login error');
    delete $cookies['hajuku-input-login'];
  }

  // submit button
  $scope.checkLogin = function() {
    $scope.username2 = 'aaaayyya';
    $cookies['hajuku-input-login'] = 'on';
  };
});

angular.module('mainModule').controller('addUserController', function($scope, $location, $http) {

  $scope.addUser = function(username, password) {

    $http({
      method: 'POST',
      url: '/adduser/local',
      data: {
        username: username,
        password: password,
        initdata: JSON.stringify({name: username}) /////////
      }
    }).success(function(res, status, headers, config) {

      alert('Usernameを登録しました。');
      $location.path('/#/login');

    }).error(function(data, status, headers, config) {

      $scope.username = config.data.username;
      $scope.password = config.data.password;

      if (status === 500) {
        alert('Usernameが重複しています。');
      } else {
        alert('Usernameの登録に失敗しました。');
      }
    });
  }
});

angular.module('mainModule').factory('userResource', function($resource) {
  return $resource('users/:id');
});

angular.module('mainModule').factory('postResource', function($resource) {
  return $resource('posts/:id');
});
