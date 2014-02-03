/* global breeze:false */
/* global manager:false */

// add a new post
document.getElementById('result').innerHTML = 'ng';
var ent = manager.createEntity('post', {
  guid: breeze.DataType.Guid.getNext(),
  message: 'message001'
});
manager.addEntity(ent);
manager.saveChanges().then(function() {
  document.getElementById('result').innerHTML = 'ok';
});
