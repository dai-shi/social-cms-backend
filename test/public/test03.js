/* global breeze:false */
/* global manager:false */
/* global ds:false */
/* global model:false */

document.getElementById('result').innerHTML = '';
var ent = manager.createEntity('post', {
  guid: breeze.DataType.Guid.getNext(),
  message: 'message002'
});
manager.addEntity(ent);
var savedEntities = manager.exportEntities();
var ents = manager.getEntities('post');
if (ents.length === 1 && ents[0].message === 'message002') {
  document.getElementById('result').innerHTML += 'ok1';
}

// refresh manager
var manager2 = new breeze.EntityManager({
  dataService: ds
});
model.initialize(manager2.metadataStore);
manager2.importEntities(savedEntities);

manager2.saveChanges().then(function() {
  breeze.EntityQuery.from('posts').toType('post').using(manager2).execute().then(function() {
    var ents2 = manager2.getEntities('post');
    if (ents2.length === 2 && ents2[0].message === 'message002' && ents2[1].message === 'message001') {
      document.getElementById('result').innerHTML += 'ok2';
    }
  });
});
