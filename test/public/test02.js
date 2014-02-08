/* global breeze:false */
/* global manager:false */

// get posts
document.getElementById('result').innerHTML = 'ng';
breeze.EntityQuery.from('posts').toType('post').using(manager).execute().then(function() {
  var ents = manager.getEntities('post');
  if (ents.length === 1 && ents[0].message === 'message001') {
    document.getElementById('result').innerHTML = 'ok';
  }
});
