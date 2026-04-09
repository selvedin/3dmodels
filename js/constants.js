const DEFAULT_PANEL = {
  name: '', width: 600, height: 600, depth: 18,
  px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0,
  materialType: 'color', color: '#4a90d9', imageDataUrl: null, textureOrientation: 'horizontal',
  groupId: null,
};

const DEFAULT_GROUP = {
  name: '',
};

const SCENE_CONFIG = {
  FOG_NEAR: 12000,
  FOG_FAR: 30000,
  CAMERA_FOV: 50,
  CAMERA_NEAR: 1,
  CAMERA_FAR: 40000,
  CAMERA_POSITION: { x: 4000, y: 3200, z: 6500 },
  GRID_SIZE: 5000,
  GRID_MAJOR_DIVISIONS: 50,
  GRID_MINOR_DIVISIONS: 10,
  GROUND_SIZE: 6000,
  TONE_MAPPING_EXPOSURE: 1.0,
  ORBIT_DAMPING_FACTOR: 0.07,
  ORBIT_MIN_DISTANCE: 50,
  ORBIT_MAX_DISTANCE: 18000,
  SHADOW_MAP_SIZE: 2048,
  TEXTURE_REPEAT_SCALE: 400,
};
