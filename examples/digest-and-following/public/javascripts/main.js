/* jshint undef: true, unused: true, latedef: true */
/* jshint quotmark: single, eqeqeq: true */
/* jshint devel: true, globalstrict: true */

/* global angular */

'use strict';

angular.module('mainModule', ['ngResource', 'ngSanitize']);


angular.module('mainModule').controller('homeController', function($scope, $http, postResource, getMyself) {
  var socket = io();
  socket.on('new-post', function(data) {
    console.log('Received:', data);
    getInbox();
  });

  $scope.destination = 'public';

  function getPost() {
    postResource.query(function(data) {
      $scope.posts = data;
    });
  }

  function getInbox() {
    postResource.query({
      id: 'inbox'
    }, function(data) {
      $scope.inbox = data;
    });
  }
  
  getMyself($scope, function() {
    getPost();
    getInbox();

    $scope.postMessage = function(message) {
      var postObj = {
        message: message
      };
      if ($scope.destination !== 'public') {
        var dest = $scope.destination.match(/user_id/) ? 'user_id' : 'group_id';
        var id = $scope.destination.match(/\d+/)[0];
        if (dest === 'user_id') postObj.destination = [{
          'user_id': parseInt(id)
        }];
        else if (dest === 'group_id') postObj.destination = [{
          'group_id': parseInt(id)
        }];
      }
      postResource.save(postObj, function() {
        getPost();
        getInbox();
      });
    };
  }, function() {
    console.log('login error');
  });
});


angular.module('mainModule').factory('userResource', function($resource) {
  return $resource('users/:id');
});

angular.module('mainModule').factory('postResource', function($resource) {
  return $resource('posts/:id');
});

angular.module('mainModule').factory('getMyself', function(userResource) {
  return function($scope, success, err) {
    userResource.get({
      id: 'myself'
    }, function(data) {
      $scope.myself = data;
      if (data.following) {
        var countLoop = 0,
          maxLoop = data.following.length;
        var successful = function() {
          if (success) {
            success();
          }
        };
        var getFollowingUser = function(idObj) {
          if (idObj.hasOwnProperty('user_id')) {
            userResource.get({
              id: idObj.user_id
            }, function(data) {
              idObj.name = data.name;
              idObj.idInfo = 'user_id' + idObj.user_id;
              countLoop++;
              if (maxLoop === countLoop) {
                successful();
              }
            });
          } else if (idObj.hasOwnProperty('group_id')) {
            idObj.name = 'All member(ichiro, jiro, saburo)';
            idObj.idInfo = 'group_id' + idObj.group_id;
            countLoop++;
            if (maxLoop === countLoop) {
              successful();
            }
          }
        };
        for (var i = 0; i < maxLoop; i++) {
          getFollowingUser(data.following[i]);
        }
      }
    }, function() {
      if (err) {
        err();
      }
    });
  };
});
