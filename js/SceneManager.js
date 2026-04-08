const SceneManager = (() => {
  let scene, camera, renderer, controls, meshMap = {}, isReady = false;

  function init(canvas) {
    const W = canvas.parentElement.clientWidth;
    const H = canvas.parentElement.clientHeight;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0d1a);
    scene.fog = new THREE.Fog(0x0d0d1a, SCENE_CONFIG.FOG_NEAR, SCENE_CONFIG.FOG_FAR);

    camera = new THREE.PerspectiveCamera(
      SCENE_CONFIG.CAMERA_FOV, W / H,
      SCENE_CONFIG.CAMERA_NEAR, SCENE_CONFIG.CAMERA_FAR
    );
    camera.position.set(
      SCENE_CONFIG.CAMERA_POSITION.x,
      SCENE_CONFIG.CAMERA_POSITION.y,
      SCENE_CONFIG.CAMERA_POSITION.z
    );

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = SCENE_CONFIG.TONE_MAPPING_EXPOSURE;

    // Environment map for PBR reflections (RoomEnvironment → PMREM)
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    scene.environment = pmrem.fromScene(new THREE.RoomEnvironment()).texture;
    pmrem.dispose();

    _addLights();
    _addFloor();

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = SCENE_CONFIG.ORBIT_DAMPING_FACTOR;
    controls.minDistance = SCENE_CONFIG.ORBIT_MIN_DISTANCE;
    controls.maxDistance = SCENE_CONFIG.ORBIT_MAX_DISTANCE;

    meshMap = {};
    isReady = true;
    _startLoop();
  }

  function _addLights() {
    // RoomEnvironment IBL already provides ambient — a subtle hemisphere adds
    // sky/ground colour variation without doubling the base illumination.
    scene.add(new THREE.HemisphereLight(0xddeeff, 0x221100, 0.25));

    // Key light — sun-like, warm but not blown out
    const dirLight = new THREE.DirectionalLight(0xfff4e0, 0.85);
    dirLight.position.set(4000, 8000, 3000);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(SCENE_CONFIG.SHADOW_MAP_SIZE, SCENE_CONFIG.SHADOW_MAP_SIZE);
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 20000;
    dirLight.shadow.camera.left = -4000;
    dirLight.shadow.camera.right = 4000;
    dirLight.shadow.camera.top = 4000;
    dirLight.shadow.camera.bottom = -4000;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);

    // Fill light — cool bounce from opposite side, kept subtle
    const fillLight = new THREE.DirectionalLight(0x99aacc, 0.25);
    fillLight.position.set(-3000, 2000, -4000);
    scene.add(fillLight);

    // Accent point — toned down so it doesn't overpower textured surfaces
    const pointLight = new THREE.PointLight(0xe94560, 0.4, 12000);
    pointLight.position.set(-2000, 3000, 2000);
    scene.add(pointLight);
  }

  function _addFloor() {
    const gridMajor = new THREE.GridHelper(SCENE_CONFIG.GRID_SIZE, SCENE_CONFIG.GRID_MAJOR_DIVISIONS, 0x223355, 0x1a2a4a);
    scene.add(gridMajor);

    const gridMinor = new THREE.GridHelper(SCENE_CONFIG.GRID_SIZE, SCENE_CONFIG.GRID_MINOR_DIVISIONS, 0x2a4060, 0x1e304a);
    gridMinor.position.y = 0.5;
    scene.add(gridMinor);

    const groundGeo = new THREE.PlaneGeometry(SCENE_CONFIG.GROUND_SIZE, SCENE_CONFIG.GROUND_SIZE);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x0d1420, transparent: true, opacity: 0.8 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);

    const axes = new THREE.AxesHelper(500);
    axes.position.y = 1;
    scene.add(axes);
  }

  function _startLoop() {
    const animate = () => {
      if (!isReady) return;
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
  }

  function _buildMaterial(panel) {
    if (panel.materialType === 'image' && panel.imageDataUrl) {
      const tex = new THREE.TextureLoader().load(panel.imageDataUrl);
      // Mark texture as sRGB so Three.js linearises it correctly during rendering.
      // Without this, ACESFilmic + sRGBEncoding output double-corrects the colour,
      // making textured surfaces appear blown out.
      tex.encoding = THREE.sRGBEncoding;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(
        panel.width  / SCENE_CONFIG.TEXTURE_REPEAT_SCALE,
        panel.height / SCENE_CONFIG.TEXTURE_REPEAT_SCALE
      );
      return new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.8,     // wood/laminate surfaces are diffuse, not glossy
        metalness: 0.0,
        envMapIntensity: 0.6, // reduce IBL contribution so texture colour reads true
      });
    }
    return new THREE.MeshStandardMaterial({
      color: panel.color || DEFAULT_PANEL.color,
      roughness: 0.4,
      metalness: 0.25,      // panels are painted/lacquered, not metal
      envMapIntensity: 0.8,
    });
  }

  function addPanel(panel) {
    const geo = new THREE.BoxGeometry(panel.width, panel.height, panel.depth);
    // Shift origin to bottom-left-front corner so px/py/pz refer to that corner
    geo.translate(panel.width / 2, panel.height / 2, panel.depth / 2);

    const mesh = new THREE.Mesh(geo, _buildMaterial(panel));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(panel.px, panel.py, panel.pz);
    mesh.rotation.set(deg2rad(panel.rx), deg2rad(panel.ry), deg2rad(panel.rz));

    const edgesMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 });
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgesMat));

    scene.add(mesh);
    meshMap[panel.id] = mesh;
  }

  function updatePanel(panel) {
    removePanel(panel.id);
    addPanel(panel);
  }

  function removePanel(id) {
    const mesh = meshMap[id];
    if (!mesh) return;
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
    delete meshMap[id];
  }

  function resize(container) {
    if (!isReady) return;
    const W = container.clientWidth;
    const H = container.clientHeight;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H);
  }

  function destroy() {
    isReady = false;
    if (renderer) { renderer.dispose(); renderer = null; }
    meshMap = {};
    scene = camera = controls = null;
  }

  return { init, addPanel, updatePanel, removePanel, resize, destroy };
})();

// ── EventBus → SceneManager wiring ───────────────────────────────────────────
EventBus.$on('panel:added',   (panel) => SceneManager.addPanel(panel));
EventBus.$on('panel:updated', (panel) => SceneManager.updatePanel(panel));
EventBus.$on('panel:removed', (id)    => SceneManager.removePanel(id));
