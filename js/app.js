new Vue({
  el: '#app',

  data() {
    return {
      projects: [],
      panelCounts: {},
      showNewProjectModal: false,
      newProjectName: '',

      currentProject: null,
      panels: [],
      groups: [],
      editingId: null,
      selectedGroupId: null,
      form: createPanel(),

      showNewGroupModal: false,
      newGroupName: '',

      currentLang: I18n.getLang(),
      formCollapsed: false,
    };
  },

  computed: {
    availableLangs() {
      return I18n.getAvailableLangs();
    },
    selectedGroup() {
      return this.groups.find(g => g.id === this.selectedGroupId) || null;
    },
  },

  watch: {
    showNewProjectModal(val) {
      if (val) this.$nextTick(() => this.$refs.newProjectInput && this.$refs.newProjectInput.focus());
    },
    showNewGroupModal(val) {
      if (val) this.$nextTick(() => this.$refs.newGroupInput && this.$refs.newGroupInput.focus());
    },
  },

  async mounted() {
    await this.loadProjects();
    window.addEventListener('resize', this.onResize);
  },

  beforeDestroy() {
    window.removeEventListener('resize', this.onResize);
    SceneManager.destroy();
  },

  methods: {
    formatDate,

    // Translate a key using the current language.
    // Accessing this.currentLang makes Vue track it as a reactive dependency,
    // so the template re-renders automatically on language change.
    t(key, params) {
      return I18n.t(key, this.currentLang, params);
    },

    setLang(code) {
      I18n.setLang(code);
      this.currentLang = code;
    },

    onResize() {
      if (!this.currentProject) return;
      const container = document.querySelector('.panel-left');
      if (container) SceneManager.resize(container);
    },

    // ── Projects ──────────────────────────────────────────────────────────────
    async loadProjects() {
      this.projects = await ProjectRepository.getAll();
      await this.loadPanelCounts();
    },

    async loadPanelCounts() {
      const counts = {};
      for (const proj of this.projects) {
        counts[proj.id] = await PanelRepository.countByProject(proj.id);
      }
      this.panelCounts = counts;
    },

    async createProject() {
      const name = this.newProjectName.trim();
      if (!name) return;
      const id = await ProjectRepository.add({ name, createdAt: Date.now() });
      this.showNewProjectModal = false;
      this.newProjectName = '';
      await this.loadProjects();
      const proj = await ProjectRepository.getById(id);
      this.openProject(proj);
    },

    async deleteProject(proj) {
      if (!confirm(this.t('confirmDeleteProject', { name: proj.name }))) return;
      await PanelRepository.removeByProject(proj.id);
      await GroupRepository.removeByProject(proj.id);
      await ProjectRepository.remove(proj.id);
      await this.loadProjects();
    },

    async openProject(proj) {
      this.currentProject = proj;
      this.panels = await PanelRepository.getByProject(proj.id);
      this.groups = await GroupRepository.getByProject(proj.id);
      this.editingId = null;
      this.selectedGroupId = null;
      this.form = createPanel();
      this.$nextTick(() => {
        SceneManager.init(document.getElementById('three-canvas'));
        this.initJsTree();
        this.panels.forEach(p => EventBus.$emit('panel:added', p));
        this.$nextTick(() => this.refreshJsTree());
      });
    },

    async backToProjects() {
      SceneManager.destroy();
      const $jt = $('#jstree-container');
      if ($jt.data('jstree')) $jt.jstree('destroy');
      this.currentProject = null;
      this.panels = [];
      this.groups = [];
      this.editingId = null;
      this.selectedGroupId = null;
      await this.loadProjects();
    },

    // ── Groups ────────────────────────────────────────────────────────────────
    async createGroup() {
      const name = this.newGroupName.trim();
      if (!name) return;
      const id = await GroupRepository.add({ name, projectId: this.currentProject.id });
      const group = await GroupRepository.getById(id);
      this.groups.push(group);
      this.showNewGroupModal = false;
      this.newGroupName = '';
      this.$nextTick(() => this.refreshJsTree());
    },

    async deleteGroup(id) {
      const group = this.groups.find(g => g.id === id);
      if (!group) return;
      if (!confirm(this.t('confirmDeleteGroup', { name: group.name }))) return;

      // Ungroup all panels belonging to this group
      await PanelRepository.ungroupByGroup(id);
      this.panels = this.panels.map(p =>
        p.groupId === id ? { ...p, groupId: null } : p
      );
      if (this.editingId !== null) {
        const editing = this.panels.find(p => p.id === this.editingId);
        if (editing && editing.groupId === null) this.form = { ...this.form, groupId: null };
      }

      await GroupRepository.remove(id);
      this.groups = this.groups.filter(g => g.id !== id);
      this.selectedGroupId = null;
      this.$nextTick(() => this.refreshJsTree());
    },

    cancelGroupSelection() {
      this.selectedGroupId = null;
      const inst = $('#jstree-container').jstree(true);
      if (inst) inst.deselect_all(true);
    },

    // ── Panels ────────────────────────────────────────────────────────────────
    async submitPanel() {
      if (!this.form.name.trim()) return;
      if (this.editingId) {
        await this._updatePanel();
      } else {
        await this._addPanel();
      }
      this.form = createPanel();
      this.$nextTick(() => this.refreshJsTree());
    },

    async _addPanel() {
      const data = { ...this.form, projectId: this.currentProject.id };
      const id = await PanelRepository.add(data);
      const panel = await PanelRepository.getById(id);
      this.panels.push(panel);
      EventBus.$emit('panel:added', panel);
    },

    async _updatePanel() {
      const data = { ...this.form, projectId: this.currentProject.id };
      await PanelRepository.update(this.editingId, data);
      const updated = await PanelRepository.getById(this.editingId);
      const idx = this.panels.findIndex(p => p.id === this.editingId);
      if (idx !== -1) this.$set(this.panels, idx, updated);
      EventBus.$emit('panel:updated', updated);
      this.editingId = null;
    },

    async deletePanel(id) {
      await PanelRepository.remove(id);
      this.panels = this.panels.filter(p => p.id !== id);
      EventBus.$emit('panel:removed', id);
      if (this.editingId === id) {
        this.editingId = null;
        this.form = createPanel();
      }
      this.$nextTick(() => this.refreshJsTree());
    },

    startEdit(id) {
      const panel = this.panels.find(p => p.id === id);
      if (!panel) return;
      this.editingId = id;
      this.selectedGroupId = null;
      this.formCollapsed = false;
      const { projectId, id: _id, ...fields } = panel;
      this.form = { ...fields };
    },

    cancelEdit() {
      this.editingId = null;
      this.selectedGroupId = null;
      this.form = createPanel();
      const inst = $('#jstree-container').jstree(true);
      if (inst) inst.deselect_all(true);
    },

    // ── jsTree ────────────────────────────────────────────────────────────────
    initJsTree() {
      const self = this;
      $('#jstree-container').jstree({
        core: {
          data: [],
          themes: { variant: 'large', dots: true, icons: true },
          // Prevent group nodes from being dropped inside other nodes
          check_callback: (operation, node) => {
            if (operation === 'move_node' && node.type === 'group') return false;
            return true;
          },
        },
        plugins: ['wholerow', 'types', 'dnd'],
        types: {
          panel: { icon: 'jstree-icon jstree-file' },
          group: { icon: 'jstree-icon jstree-folder' },
        },
        dnd: {
          // Only panel nodes are draggable; groups stay fixed
          is_draggable: nodes => nodes.every(n => n.type === 'panel'),
        },
      });

      $('#jstree-container').on('select_node.jstree', function(e, data) {
        const nodeId = data.node.id;
        if (nodeId.startsWith('panel-')) {
          const id = parseInt(nodeId.replace('panel-', ''));
          self.startEdit(id);
        } else if (nodeId.startsWith('group-')) {
          const id = parseInt(nodeId.replace('group-', ''));
          self.editingId = null;
          self.form = createPanel();
          self.selectedGroupId = id;
        }
      });

      // Persist group membership when a panel is dragged to a new parent
      $('#jstree-container').on('move_node.jstree', async function(e, data) {
        const nodeId = data.node.id;
        if (!nodeId.startsWith('panel-')) return;

        const panelId = parseInt(nodeId.replace('panel-', ''));
        const parentId = data.parent;
        const groupId = parentId.startsWith('group-')
          ? parseInt(parentId.replace('group-', ''))
          : null;

        await PanelRepository.update(panelId, { groupId });
        const idx = self.panels.findIndex(p => p.id === panelId);
        if (idx !== -1) self.$set(self.panels, idx, { ...self.panels[idx], groupId });
        if (self.editingId === panelId) self.form = { ...self.form, groupId };
      });
    },

    refreshJsTree() {
      const inst = $('#jstree-container').jstree(true);
      if (!inst) return;

      const nodes = [];

      this.groups.forEach(g => {
        nodes.push({
          id: `group-${g.id}`,
          parent: '#',
          text: `<span class="jstree-group-label">${g.name}</span>`,
          type: 'group',
          state: { opened: true },
        });
      });

      this.panels.forEach(p => {
        const parent = p.groupId ? `group-${p.groupId}` : '#';
        nodes.push({
          id: `panel-${p.id}`,
          parent,
          text: `<b>${p.name}</b> <span style="color:#667;font-size:0.75em">${p.width}\u00d7${p.height}\u00d7${p.depth} mm</span>`,
          type: 'panel',
        });
      });

      inst.settings.core.data = nodes;
      inst.refresh();
    },

    // ── Image upload ──────────────────────────────────────────────────────────
    onImageUpload(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => { this.form.imageDataUrl = ev.target.result; };
      reader.readAsDataURL(file);
    },

    // ── Export / Import JSON ──────────────────────────────────────────────────
    async exportProject(proj) {
      const [panels, groups] = await Promise.all([
        PanelRepository.getByProject(proj.id),
        GroupRepository.getByProject(proj.id),
      ]);
      const payload = {
        name: proj.name,
        createdAt: proj.createdAt,
        exportedAt: Date.now(),
        // exportId preserves the original DB id so panel groupId refs can be remapped on import
        groups: groups.map(({ id, projectId, ...rest }) => ({ ...rest, exportId: id })),
        panels: panels.map(({ id, projectId, ...rest }) => rest),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${proj.name.replace(/[^a-z0-9]/gi, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },

    async importFromJson(e) {
      const file = e.target.files[0];
      if (!file) return;
      this.$refs.importInput.value = '';
      let data;
      try {
        data = JSON.parse(await file.text());
      } catch {
        alert(this.t('invalidJsonFile'));
        return;
      }
      if (!data.name || !Array.isArray(data.panels)) {
        alert(this.t('invalidProjectFile'));
        return;
      }
      const projectId = await ProjectRepository.add({ name: data.name, createdAt: Date.now() });

      // Create groups first and build exportId → newId map for panel remapping
      const groupIdMap = {};
      for (const group of (data.groups || [])) {
        const { exportId, ...groupData } = group;
        const newId = await GroupRepository.add({ ...groupData, projectId });
        if (exportId !== undefined) groupIdMap[exportId] = newId;
      }

      for (const panel of data.panels) {
        const { id, groupId, ...panelData } = panel;
        const mappedGroupId = (groupId != null && groupIdMap[groupId] !== undefined)
          ? groupIdMap[groupId]
          : null;
        await PanelRepository.add({ ...panelData, groupId: mappedGroupId, projectId });
      }

      await this.loadProjects();
      const proj = await ProjectRepository.getById(projectId);
      this.openProject(proj);
    },
  },
});
