const db = new Dexie('3dModelBuilder');
db.version(1).stores({
  projects: '++id, name, createdAt',
  panels:   '++id, projectId, name, width, height, depth, px, py, pz, rx, ry, rz',
});
