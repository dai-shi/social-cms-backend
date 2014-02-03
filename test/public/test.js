/* global breeze:false */

breeze.config.initializeAdapterInstance("modelLibrary", "backingStore", true);
breeze.config.initializeAdapterInstance("dataService", "mongo", true);

var ds = new breeze.DataService({
  serviceName: 'breeze-service',
  hasServerMetadata: false
});

var manager = new breeze.EntityManager({
  dataService: ds
});

var model = {
  initialize: function(metadataStore) {
    metadataStore.addEntityType({
      shortName: 'post',
      namespace: 'SCB_breeze_test',
      defaultResourceName: 'post',
      dataProperties: {
        guid: {
          dataType: breeze.DataType.Guid,
          isNullable: false,
          isPartOfKey: true
        },
        message: {
          dataType: breeze.DataType.String,
          isNullable: false
        },
        title: {
          dataType: breeze.DataType.String
        }
      }
    });
  }
};

model.initialize(manager.metadataStore);
