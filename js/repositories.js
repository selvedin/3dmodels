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
  ungroupByGroup:  (groupId)   => db.panels.where('groupId').equals(groupId).modify({ groupId: null }),
};

const GroupRepository = {
  getByProject:    (projectId) => db.groups.where('projectId').equals(projectId).toArray(),
  getById:         (id)        => db.groups.get(id),
  add:             (group)     => db.groups.add(group),
  update:          (id, data)  => db.groups.update(id, data),
  remove:          (id)        => db.groups.delete(id),
  removeByProject: (projectId) => db.groups.where('projectId').equals(projectId).delete(),
};
