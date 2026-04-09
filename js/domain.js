function createPanel(overrides = {}) {
  return { ...DEFAULT_PANEL, ...overrides };
}

function createGroup(overrides = {}) {
  return { ...DEFAULT_GROUP, ...overrides };
}

function deg2rad(degrees) {
  return degrees * Math.PI / 180;
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
