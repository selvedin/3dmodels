const db = new Dexie('3dModelBuilder');

db.version(1).stores({
  projects: '++id, name, createdAt',
  panels:   '++id, projectId, name, width, height, depth, px, py, pz, rx, ry, rz',
});

db.version(2).stores({
  projects: '++id, name, createdAt',
  panels:   '++id, projectId, groupId, name, width, height, depth, px, py, pz, rx, ry, rz',
  groups:   '++id, projectId, name',
}).upgrade(tx => {
  return tx.table('panels').toCollection().modify(panel => {
    if (panel.groupId === undefined) panel.groupId = null;
  });
});
