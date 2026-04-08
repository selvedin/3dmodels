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
      editingId: null,
      form: createPanel(),
    };
  },

  watch: {
    showNewProjectModal(val) {
      if (val) this.$nextTick(() => this.$refs.newProjectInput && this.$refs.newProjectInput.focus());
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
      if (!confirm(`Delete project "${proj.name}" and all its panels?`)) return;
      await PanelRepository.removeByProject(proj.id);
      await ProjectRepository.remove(proj.id);
      await this.loadProjects();
    },

    async openProject(proj) {
      this.currentProject = proj;
      this.panels = await PanelRepository.getByProject(proj.id);
      this.editingId = null;
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
      this.editingId = null;
      await this.loadProjects();
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
      const { projectId, id: _id, ...fields } = panel;
      this.form = { ...fields };
    },

    cancelEdit() {
      this.editingId = null;
      this.form = createPanel();
      this.highlightNode(null);
    },

    // ── jsTree ────────────────────────────────────────────────────────────────
    initJsTree() {
      const self = this;
      $('#jstree-container').jstree({
        core: {
          data: [],
          themes: { variant: 'large', dots: true, icons: true },
          check_callback: true,
        },
        plugins: ['wholerow', 'types'],
        types: { panel: { icon: 'jstree-icon jstree-file' } },
      });

      $('#jstree-container').on('select_node.jstree', function(e, data) {
        const id = parseInt(data.node.id.replace('panel-', ''));
        self.startEdit(id);
      });
    },

    refreshJsTree() {
      const inst = $('#jstree-container').jstree(true);
      if (!inst) return;
      inst.settings.core.data = this.panels.map(p => ({
        id: `panel-${p.id}`,
        parent: '#',
        text: `<b>${p.name}</b> <span style="color:#667;font-size:0.75em">${p.width}×${p.height}×${p.depth} mm</span>`,
        type: 'panel',
      }));
      inst.refresh();
    },

    highlightNode(id) {
      const inst = $('#jstree-container').jstree(true);
      if (!inst) return;
      inst.deselect_all(true);
      if (id) inst.select_node(`panel-${id}`, true);
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
      const panels = await PanelRepository.getByProject(proj.id);
      const payload = {
        name: proj.name,
        createdAt: proj.createdAt,
        exportedAt: Date.now(),
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
        alert('Invalid JSON file.');
        return;
      }
      if (!data.name || !Array.isArray(data.panels)) {
        alert('Invalid project file: missing "name" or "panels" fields.');
        return;
      }
      const projectId = await ProjectRepository.add({ name: data.name, createdAt: Date.now() });
      for (const panel of data.panels) {
        const { id, ...panelData } = panel;
        await PanelRepository.add({ ...panelData, projectId });
      }
      await this.loadProjects();
      const proj = await ProjectRepository.getById(projectId);
      this.openProject(proj);
    },
  },
});
