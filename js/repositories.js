const ProjectRepository = {
  getAll:   ()     => db.projects.orderBy('createdAt').reverse().toArray(),
  getById:  (id)   => db.projects.get(id),
  add:      (proj) => db.projects.add(proj),
  remove:   (id)   => db.projects.delete(id),
};

const PanelRepository = {
  getByProject:    (projectId) => db.panels.where('projectId').equals(projectId).toArray(),
  countByProject:  (projectId) => db.panels.where('projectId').equals(projectId).count(),
  getById:         (id)        => db.panels.get(id),
  add:             (panel)     => db.panels.add(panel),
  update:          (id, data)  => db.panels.update(id, data),
  remove:          (id)        => db.panels.delete(id),
  removeByProject: (projectId) => db.panels.where('projectId').equals(projectId).delete(),
};
