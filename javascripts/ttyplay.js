/* global VTCanvasView: false */
/* global get_binary_data_async: false */
/* global TTYRecParse: false */

var ttyrecord_url = 'http://dai-shi.github.io/social-cms-backend/ttyrecord';
var tty_data;
var nextFrameIdx = 0;

var accurateTimeInterval = 1000 / 60; // max 60fps
var frameJumpMax = 60;
var speedFactor = 1;

var viewReady = false;
var playReady = false;

var initialState;
var vtview;
var time_diff;
var nextFrameTimeout;

function nextFrame() {
  var now = (new Date()).getTime() / 1000;
  var framesCounted = 0;
  while (framesCounted < frameJumpMax && nextFrameIdx < tty_data.length && tty_data[nextFrameIdx].time + (time_diff - now) * speedFactor < 0) {
    var record = tty_data[nextFrameIdx++];
    vtview.parseData(record.data);
    framesCounted++;
  }

  vtview.draw();

  if (nextFrameIdx < tty_data.length) nextFrameTimeout = setTimeout(nextFrame, (tty_data[0].time + (time_diff - (new Date()).getTime() / 1000) * speedFactor) * 1000 + accurateTimeInterval);
}

function go() {
  var now = (new Date()).getTime() / 1000;
  time_diff = now - tty_data[nextFrameIdx].time;

  nextFrame();
}

function readyCheck() {
  if (viewReady && playReady) go();
}

setTimeout(function() {
  vtview = new VTCanvasView(document.getElementById('canvas'), {
    onReady: function() {
      viewReady = true;
      readyCheck();
    },
    fontName: 'fixed-9x18'
  });
  initialState = {
    vtview: vtview.freeze(),
    nextFrameIdx: 0
  };
}, 20);

get_binary_data_async(ttyrecord_url, function(data, err) {
  if (err) throw err;
  tty_data = TTYRecParse(data);

  playReady = true;
  readyCheck();
});

setTimeout(function() {
  var freezeData;

  document.getElementById("play").addEventListener('click', function(evt) {
    if (!nextFrameTimeout) go();
    evt.preventDefault();
  }, false);
  document.getElementById("pause").addEventListener('click', function(evt) {
    if (nextFrameTimeout) {
      clearTimeout(nextFrameTimeout);
      nextFrameTimeout = null;
    }
    evt.preventDefault();
  }, false);
  document.getElementById("freeze").addEventListener('click', function(evt) {
    freezeData = {
      vtview: vtview.freeze(),
      nextFrameIdx: nextFrameIdx
    };
    evt.preventDefault();
  }, false);
  document.getElementById("thaw").addEventListener('click', function(evt) {
    evt.preventDefault();
    var wasplaying = false;
    if (freezeData) {
      if (nextFrameTimeout) {
        wasplaying = true;
        clearTimeout(nextFrameTimeout);
        nextFrameTimeout = null;
      }

      nextFrameIdx = freezeData.nextFrameIdx;
      vtview.thaw(freezeData.vtview);
      vtview.draw();
      if (wasplaying) go();
    }
  }, false);
  document.getElementById("rewind").addEventListener('click', function(evt) {
    evt.preventDefault();
    var wasplaying = false;
    if (nextFrameTimeout) {
      wasplaying = true;
      clearTimeout(nextFrameTimeout);
      nextFrameTimeout = null;
    }

    nextFrameIdx = initialState.nextFrameIdx;
    vtview.thaw(initialState.vtview);
    vtview.draw();
    if (wasplaying) go();
  }, false);
  document.getElementById("doublespeed").addEventListener('click', function(evt) {
    evt.preventDefault();
    var wasplaying = false;
    if (nextFrameTimeout) {
      wasplaying = true;
      clearTimeout(nextFrameTimeout);
      nextFrameTimeout = null;
    }

    speedFactor = 2;
    nextFrameIdx = initialState.nextFrameIdx;
    vtview.thaw(initialState.vtview);
    vtview.draw();
    if (wasplaying) go();
  }, false);
  document.getElementById("triplespeed").addEventListener('click', function(evt) {
    evt.preventDefault();
    var wasplaying = false;
    if (nextFrameTimeout) {
      wasplaying = true;
      clearTimeout(nextFrameTimeout);
      nextFrameTimeout = null;
    }

    speedFactor = 3;
    nextFrameIdx = initialState.nextFrameIdx;
    vtview.thaw(initialState.vtview);
    vtview.draw();
    if (wasplaying) go();
  }, false);
  document.getElementById("normalspeed").addEventListener('click', function(evt) {
    evt.preventDefault();
    var wasplaying = false;
    if (nextFrameTimeout) {
      wasplaying = true;
      clearTimeout(nextFrameTimeout);
      nextFrameTimeout = null;
    }

    speedFactor = 1;
    nextFrameIdx = initialState.nextFrameIdx;
    vtview.thaw(initialState.vtview);
    vtview.draw();
    if (wasplaying) go();
  }, false);
}, 100);
