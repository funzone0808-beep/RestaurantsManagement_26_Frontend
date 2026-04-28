/*
  AURUM - THREE.JS HERO SCENE
  Floating 3D geometric forms + particles
*/

(function () {
  "use strict";

  const canvas = document.getElementById("heroCanvas");
  const heroSection = document.getElementById("hero");
  if (!canvas || typeof THREE === "undefined") return;

  const HERO_SCENE_DEFAULTS = {
    enabled: true,
    template: "default",
    modelPreset: "none",
    preset: "default",
    toneMappingExposure: 1.2,
    cameraDistance: 12,
    ambientLightIntensity: 0.5,
    goldLightIntensity: 3.5,
    warmLightIntensity: 2.5,
    rimLightIntensity: 0.8,
    particleCount: 280,
  };
  const HERO_SCENE_MAX_PARTICLE_COUNT = 600;
  const SUPPORTED_HERO_SCENE_TEMPLATES = new Set([
    "default",
    "orbital",
    "sculptural",
    "constellation",
  ]);
  const SUPPORTED_HERO_SCENE_MODEL_PRESETS = new Set([
    "none",
    "coffee-cup",
    "plated-dish",
    "dessert",
    "service-cloche",
  ]);

  function getFiniteRuntimeValue(value, fallback) {
    const candidate = Number(value);
    return Number.isFinite(candidate) ? candidate : fallback;
  }

  function getIntegerRuntimeValue(value, fallback, min, max) {
    const candidate = Math.round(getFiniteRuntimeValue(value, fallback));
    return Math.min(Math.max(candidate, min), max);
  }

  function getHeroSceneRuntimeConfig() {
    const sceneConfig = window.APP_STATE?.heroScene;
    const templateCandidate =
      typeof sceneConfig?.template === "string"
        ? sceneConfig.template.trim().toLowerCase()
        : "";
    const modelPresetCandidate =
      typeof sceneConfig?.modelPreset === "string"
        ? sceneConfig.modelPreset.trim().toLowerCase()
        : "";

    return {
      enabled:
        typeof sceneConfig?.enabled === "boolean"
          ? sceneConfig.enabled
          : HERO_SCENE_DEFAULTS.enabled,
      template: SUPPORTED_HERO_SCENE_TEMPLATES.has(templateCandidate)
        ? templateCandidate
        : HERO_SCENE_DEFAULTS.template,
      modelPreset: SUPPORTED_HERO_SCENE_MODEL_PRESETS.has(modelPresetCandidate)
        ? modelPresetCandidate
        : HERO_SCENE_DEFAULTS.modelPreset,
      preset:
        typeof sceneConfig?.preset === "string" && sceneConfig.preset.trim()
          ? sceneConfig.preset.trim().toLowerCase()
          : HERO_SCENE_DEFAULTS.preset,
      toneMappingExposure: getFiniteRuntimeValue(
        sceneConfig?.toneMappingExposure,
        HERO_SCENE_DEFAULTS.toneMappingExposure,
      ),
      cameraDistance: getFiniteRuntimeValue(
        sceneConfig?.cameraDistance,
        HERO_SCENE_DEFAULTS.cameraDistance,
      ),
      ambientLightIntensity: getFiniteRuntimeValue(
        sceneConfig?.ambientLightIntensity,
        HERO_SCENE_DEFAULTS.ambientLightIntensity,
      ),
      goldLightIntensity: getFiniteRuntimeValue(
        sceneConfig?.goldLightIntensity,
        HERO_SCENE_DEFAULTS.goldLightIntensity,
      ),
      warmLightIntensity: getFiniteRuntimeValue(
        sceneConfig?.warmLightIntensity,
        HERO_SCENE_DEFAULTS.warmLightIntensity,
      ),
      rimLightIntensity: getFiniteRuntimeValue(
        sceneConfig?.rimLightIntensity,
        HERO_SCENE_DEFAULTS.rimLightIntensity,
      ),
      particleCount: getIntegerRuntimeValue(
        sceneConfig?.particleCount,
        HERO_SCENE_DEFAULTS.particleCount,
        0,
        HERO_SCENE_MAX_PARTICLE_COUNT,
      ),
    };
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = HERO_SCENE_DEFAULTS.toneMappingExposure;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    200,
  );
  camera.position.set(0, 0, HERO_SCENE_DEFAULTS.cameraDistance);

  const ambientLight = new THREE.AmbientLight(0xfff5e0, 0.5);
  scene.add(ambientLight);

  const goldLight = new THREE.PointLight(0xc9a84c, 3.5, 40);
  goldLight.position.set(6, 5, 8);
  scene.add(goldLight);

  const warmLight = new THREE.PointLight(0xffd59a, 2.5, 35);
  warmLight.position.set(-8, -3, 6);
  scene.add(warmLight);

  const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
  rimLight.position.set(0, 10, -5);
  scene.add(rimLight);

  const goldMaterial = new THREE.MeshStandardMaterial({
    color: 0xc9a84c,
    metalness: 0.92,
    roughness: 0.08,
    envMapIntensity: 1.5,
  });
  const darkGoldMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b6914,
    metalness: 0.95,
    roughness: 0.05,
    envMapIntensity: 1.5,
  });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0xe8d5a3,
    metalness: 0.6,
    roughness: 0.15,
    transparent: true,
    opacity: 0.85,
  });
  const wireMaterial = new THREE.MeshBasicMaterial({
    color: 0xc9a84c,
    wireframe: true,
    transparent: true,
    opacity: 0.15,
  });

  const shapes = [];
  const templateRoot = new THREE.Group();
  scene.add(templateRoot);
  const foodModelRoot = new THREE.Group();
  scene.add(foodModelRoot);

  let pulseTargets = [];
  let foodModelFloaters = [];
  let foodModelPulseTargets = [];
  let activeTemplateKey = "";
  let activeModelPresetKey = "";
  const activeLookTarget = new THREE.Vector3(0.5, 0, 0);
  let activeLightMotion = {
    radiusX: 8,
    radiusZ: 6,
    baseZ: 4,
    baseY: 3,
    amplitudeY: 3,
    speedX: 0.5,
    speedY: 0.3,
  };

  function cloneSceneMaterial(baseMaterial, overrides = {}) {
    const nextMaterial = baseMaterial.clone();
    const nextOverrides = { ...overrides };

    if (Object.prototype.hasOwnProperty.call(nextOverrides, "color")) {
      nextMaterial.color?.set(nextOverrides.color);
      delete nextOverrides.color;
    }

    Object.assign(nextMaterial, nextOverrides);
    return nextMaterial;
  }

  function createTemplateMesh(
    geometry,
    material,
    { position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 } = {},
  ) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);

    if (Array.isArray(scale)) {
      mesh.scale.set(...scale);
    } else {
      mesh.scale.setScalar(scale);
    }

    return mesh;
  }

  function createSceneGroup({
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
  } = {}) {
    const group = new THREE.Group();
    group.position.set(...position);
    group.rotation.set(...rotation);

    if (Array.isArray(scale)) {
      group.scale.set(...scale);
    } else {
      group.scale.setScalar(scale);
    }

    return group;
  }

  function registerTemplateShape(mesh, config = {}) {
    templateRoot.add(mesh);
    shapes.push({
      mesh,
      rotX: config.rotX || 0,
      rotY: config.rotY || 0,
      floatAmp: config.floatAmp || 0,
      floatFreq: config.floatFreq || 0.5,
      baseY:
        typeof config.baseY === "number" ? config.baseY : mesh.position.y,
      phaseOffset: config.phaseOffset || 0,
    });

    return mesh;
  }

  function registerPulseTarget(
    mesh,
    { baseScale = 1, amplitude = 0.02, speed = 1.2, scaleMultiplier = 1 } = {},
  ) {
    pulseTargets.push({
      mesh,
      baseScale,
      amplitude,
      speed,
      scaleMultiplier,
    });
  }

  function registerFoodModelFloat(object3d, config = {}) {
    foodModelRoot.add(object3d);
    foodModelFloaters.push({
      object3d,
      rotX: config.rotX || 0,
      rotY: config.rotY || 0,
      floatAmp: config.floatAmp || 0,
      floatFreq: config.floatFreq || 0.5,
      baseY:
        typeof config.baseY === "number" ? config.baseY : object3d.position.y,
      phaseOffset: config.phaseOffset || 0,
    });

    return object3d;
  }

  function registerFoodModelPulse(
    object3d,
    { baseScale = 1, amplitude = 0.02, speed = 1.1, scaleMultiplier = 1 } = {},
  ) {
    foodModelPulseTargets.push({
      object3d,
      baseScale,
      amplitude,
      speed,
      scaleMultiplier,
    });
  }

  function disposeTemplateObject(object3d) {
    object3d.traverse((node) => {
      if (!node.isMesh) return;

      node.geometry?.dispose?.();

      if (Array.isArray(node.material)) {
        node.material.forEach((material) => material?.dispose?.());
      } else {
        node.material?.dispose?.();
      }
    });
  }

  function clearActiveHeroTemplate() {
    shapes.length = 0;
    pulseTargets = [];

    while (templateRoot.children.length) {
      const child = templateRoot.children[0];
      templateRoot.remove(child);
      disposeTemplateObject(child);
    }
  }

  function clearActiveHeroFoodModel() {
    foodModelFloaters = [];
    foodModelPulseTargets = [];

    while (foodModelRoot.children.length) {
      const child = foodModelRoot.children[0];
      foodModelRoot.remove(child);
      disposeTemplateObject(child);
    }
  }

  function buildDefaultHeroTemplate() {
    activeLookTarget.set(0.5, 0, 0);
    activeLightMotion = {
      radiusX: 8,
      radiusZ: 6,
      baseZ: 4,
      baseY: 3,
      amplitudeY: 3,
      speedX: 0.5,
      speedY: 0.3,
    };

    const coreMesh = registerTemplateShape(
      createTemplateMesh(
        new THREE.IcosahedronGeometry(2.2, 0),
        cloneSceneMaterial(goldMaterial),
        { position: [0.5, 0, 0] },
      ),
      { rotX: 0.003, rotY: 0.005, floatAmp: 0.15, floatFreq: 0.6, baseY: 0 },
    );
    registerPulseTarget(coreMesh);

    const coreWire = registerTemplateShape(
      createTemplateMesh(
        new THREE.IcosahedronGeometry(2.25, 0),
        cloneSceneMaterial(wireMaterial),
        { position: [0.5, 0, 0] },
      ),
      { rotX: 0.003, rotY: 0.005, floatAmp: 0.15, floatFreq: 0.6, baseY: 0 },
    );
    registerPulseTarget(coreWire, { scaleMultiplier: 1.02 });

    registerTemplateShape(
      createTemplateMesh(
        new THREE.TorusGeometry(3.5, 0.06, 8, 80),
        cloneSceneMaterial(goldMaterial, { transparent: true, opacity: 0.6 }),
        {
          position: [0.5, 0, 0],
          rotation: [Math.PI / 3, 0, 0],
        },
      ),
      { rotX: 0.002, rotY: 0.004, floatAmp: 0.1, floatFreq: 0.5, baseY: 0 },
    );

    registerTemplateShape(
      createTemplateMesh(
        new THREE.TorusGeometry(4.8, 0.03, 6, 100),
        new THREE.MeshBasicMaterial({
          color: 0xc9a84c,
          transparent: true,
          opacity: 0.12,
        }),
        {
          position: [0.5, 0, 0],
          rotation: [Math.PI / 2.5, Math.PI / 5, 0],
        },
      ),
      { rotX: -0.001, rotY: 0.003, floatAmp: 0.08, floatFreq: 0.4, baseY: 0 },
    );

    [
      { pos: [-5.5, 2, -2], scale: 0.5, material: darkGoldMaterial },
      { pos: [6, -1.5, -3], scale: 0.65, material: glassMaterial },
      { pos: [-4, -3, -1], scale: 0.4, material: goldMaterial },
      { pos: [5.5, 3, -1], scale: 0.35, material: wireMaterial },
      { pos: [0, 4.5, -3], scale: 0.45, material: darkGoldMaterial },
      { pos: [-6, 0.5, -4], scale: 0.3, material: glassMaterial },
    ].forEach((satellite, index) => {
      registerTemplateShape(
        createTemplateMesh(
          index % 2 === 0
            ? new THREE.OctahedronGeometry(1, 0)
            : new THREE.TetrahedronGeometry(1, 0),
          cloneSceneMaterial(satellite.material),
          {
            position: satellite.pos,
            scale: satellite.scale,
          },
        ),
        {
          rotX: (Math.random() - 0.5) * 0.01,
          rotY: (Math.random() - 0.5) * 0.01,
          floatAmp: 0.2 + Math.random() * 0.3,
          floatFreq: 0.4 + Math.random() * 0.6,
          baseY: satellite.pos[1],
          phaseOffset: index * 0.8,
        },
      );
    });
  }

  function buildOrbitalHeroTemplate() {
    activeLookTarget.set(0, 0, 0);
    activeLightMotion = {
      radiusX: 9.5,
      radiusZ: 7.2,
      baseZ: 4.5,
      baseY: 2.8,
      amplitudeY: 2.6,
      speedX: 0.42,
      speedY: 0.26,
    };

    const coreMesh = registerTemplateShape(
      createTemplateMesh(
        new THREE.IcosahedronGeometry(1.7, 1),
        cloneSceneMaterial(glassMaterial, { opacity: 0.9, metalness: 0.72 }),
        { position: [0, 0, 0] },
      ),
      { rotX: 0.0022, rotY: 0.0042, floatAmp: 0.1, floatFreq: 0.52, baseY: 0 },
    );
    registerPulseTarget(coreMesh, { amplitude: 0.026, speed: 1 });

    const innerWire = registerTemplateShape(
      createTemplateMesh(
        new THREE.IcosahedronGeometry(1.95, 0),
        cloneSceneMaterial(wireMaterial, { opacity: 0.2 }),
        { position: [0, 0, 0] },
      ),
      { rotX: 0.002, rotY: 0.0032, floatAmp: 0.08, floatFreq: 0.45, baseY: 0 },
    );
    registerPulseTarget(innerWire, {
      amplitude: 0.018,
      speed: 0.9,
      scaleMultiplier: 1.04,
    });

    [
      {
        radius: 3.1,
        tube: 0.07,
        rotation: [Math.PI / 2.8, 0, Math.PI / 8],
        opacity: 0.72,
      },
      {
        radius: 4.25,
        tube: 0.04,
        rotation: [Math.PI / 2.2, Math.PI / 5, Math.PI / 4],
        opacity: 0.34,
      },
      {
        radius: 5.4,
        tube: 0.03,
        rotation: [Math.PI / 2, 0, Math.PI / 2.8],
        opacity: 0.12,
      },
    ].forEach((ring, index) => {
      registerTemplateShape(
        createTemplateMesh(
          new THREE.TorusGeometry(ring.radius, ring.tube, 10, 100),
          cloneSceneMaterial(goldMaterial, {
            transparent: true,
            opacity: ring.opacity,
          }),
          {
            position: [0, 0, -0.4 * index],
            rotation: ring.rotation,
          },
        ),
        {
          rotX: 0.0015 - index * 0.0005,
          rotY: 0.003 + index * 0.0007,
          floatAmp: 0.06 + index * 0.02,
          floatFreq: 0.4 + index * 0.08,
          baseY: 0,
          phaseOffset: index * 0.7,
        },
      );
    });

    [
      { pos: [-4.5, 2.2, -2.2], scale: 0.45, material: darkGoldMaterial },
      { pos: [4.9, 2.8, -2.6], scale: 0.4, material: glassMaterial },
      { pos: [5.8, -1.8, -2.1], scale: 0.32, material: goldMaterial },
      { pos: [-5.2, -2.4, -3.1], scale: 0.38, material: wireMaterial },
    ].forEach((satellite, index) => {
      registerTemplateShape(
        createTemplateMesh(
          index % 2 === 0
            ? new THREE.OctahedronGeometry(1, 0)
            : new THREE.TetrahedronGeometry(1, 0),
          cloneSceneMaterial(satellite.material),
          {
            position: satellite.pos,
            scale: satellite.scale,
          },
        ),
        {
          rotX: 0.002 + index * 0.0008,
          rotY: 0.0035 + index * 0.0005,
          floatAmp: 0.22,
          floatFreq: 0.45 + index * 0.1,
          baseY: satellite.pos[1],
          phaseOffset: index * 1.1,
        },
      );
    });
  }

  function buildSculpturalHeroTemplate() {
    activeLookTarget.set(0, 0.55, 0);
    activeLightMotion = {
      radiusX: 7.2,
      radiusZ: 5.8,
      baseZ: 4,
      baseY: 3.6,
      amplitudeY: 3.4,
      speedX: 0.34,
      speedY: 0.22,
    };

    const baseCore = registerTemplateShape(
      createTemplateMesh(
        new THREE.OctahedronGeometry(1.8, 0),
        cloneSceneMaterial(darkGoldMaterial),
        {
          position: [0, -0.35, 0],
          rotation: [Math.PI / 9, Math.PI / 6, 0],
        },
      ),
      { rotX: 0.0024, rotY: 0.0038, floatAmp: 0.08, floatFreq: 0.42, baseY: -0.35 },
    );
    registerPulseTarget(baseCore, { amplitude: 0.02, speed: 1.05 });

    const glassTop = registerTemplateShape(
      createTemplateMesh(
        new THREE.TetrahedronGeometry(1.35, 0),
        cloneSceneMaterial(glassMaterial, { opacity: 0.88 }),
        {
          position: [0.1, 2.8, -0.6],
          rotation: [Math.PI / 12, Math.PI / 4, 0],
        },
      ),
      {
        rotX: 0.0016,
        rotY: 0.0028,
        floatAmp: 0.12,
        floatFreq: 0.56,
        baseY: 2.8,
        phaseOffset: 0.8,
      },
    );
    registerPulseTarget(glassTop, { amplitude: 0.014, speed: 0.8 });

    registerTemplateShape(
      createTemplateMesh(
        new THREE.TorusGeometry(2.7, 0.08, 10, 90),
        cloneSceneMaterial(goldMaterial, { transparent: true, opacity: 0.45 }),
        {
          position: [0, 0.6, -0.3],
          rotation: [Math.PI / 2.2, 0, Math.PI / 7],
        },
      ),
      { rotX: 0.0018, rotY: 0.0034, floatAmp: 0.08, floatFreq: 0.38, baseY: 0.6 },
    );

    registerTemplateShape(
      createTemplateMesh(
        new THREE.TorusGeometry(1.2, 0.05, 8, 70),
        cloneSceneMaterial(wireMaterial, { opacity: 0.2 }),
        {
          position: [0.2, 2.15, -0.4],
          rotation: [Math.PI / 2.4, Math.PI / 5, 0],
        },
      ),
      { rotX: -0.0012, rotY: 0.0032, floatAmp: 0.05, floatFreq: 0.44, baseY: 2.15 },
    );

    [
      { pos: [-3.4, 1.1, -2.6], scale: 0.42, material: goldMaterial },
      { pos: [3.1, -1.4, -2.2], scale: 0.55, material: glassMaterial },
      { pos: [2.8, 3.5, -3.4], scale: 0.3, material: darkGoldMaterial },
      { pos: [-2.6, 4.2, -3.1], scale: 0.28, material: wireMaterial },
      { pos: [0.2, -3.4, -2.7], scale: 0.36, material: darkGoldMaterial },
    ].forEach((satellite, index) => {
      registerTemplateShape(
        createTemplateMesh(
          index % 2 === 0
            ? new THREE.OctahedronGeometry(1, 0)
            : new THREE.TetrahedronGeometry(1, 0),
          cloneSceneMaterial(satellite.material),
          {
            position: satellite.pos,
            scale: satellite.scale,
          },
        ),
        {
          rotX: 0.0014 + index * 0.0006,
          rotY: 0.0024 + index * 0.0005,
          floatAmp: 0.16 + index * 0.02,
          floatFreq: 0.35 + index * 0.08,
          baseY: satellite.pos[1],
          phaseOffset: index * 0.9,
        },
      );
    });
  }

  function buildConstellationHeroTemplate() {
    activeLookTarget.set(0, 0, 0);
    activeLightMotion = {
      radiusX: 10.2,
      radiusZ: 7.5,
      baseZ: 4.8,
      baseY: 2.6,
      amplitudeY: 2.2,
      speedX: 0.28,
      speedY: 0.2,
    };

    const coreMesh = registerTemplateShape(
      createTemplateMesh(
        new THREE.IcosahedronGeometry(0.95, 0),
        cloneSceneMaterial(glassMaterial, {
          opacity: 0.82,
          metalness: 0.52,
        }),
        { position: [0, 0, 0] },
      ),
      { rotX: 0.0018, rotY: 0.0024, floatAmp: 0.05, floatFreq: 0.38, baseY: 0 },
    );
    registerPulseTarget(coreMesh, { amplitude: 0.03, speed: 0.92 });

    [
      {
        radius: 2.8,
        rotation: [Math.PI / 2.8, Math.PI / 7, 0],
        opacity: 0.16,
      },
      {
        radius: 4.2,
        rotation: [Math.PI / 2.15, 0, Math.PI / 3],
        opacity: 0.1,
      },
    ].forEach((ring, index) => {
      registerTemplateShape(
        createTemplateMesh(
          new THREE.TorusGeometry(ring.radius, 0.024, 8, 120),
          new THREE.MeshBasicMaterial({
            color: 0xc9a84c,
            transparent: true,
            opacity: ring.opacity,
          }),
          {
            position: [0, 0, -0.8 - index * 0.3],
            rotation: ring.rotation,
          },
        ),
        {
          rotX: 0.0008,
          rotY: 0.0024 + index * 0.0005,
          floatAmp: 0.04,
          floatFreq: 0.3 + index * 0.05,
          baseY: 0,
        },
      );
    });

    [
      { pos: [-5.6, 2.2, -2.6], scale: 0.28, material: goldMaterial },
      { pos: [-3.1, -2.8, -1.7], scale: 0.22, material: glassMaterial },
      { pos: [-1.2, 3.7, -3.8], scale: 0.18, material: darkGoldMaterial },
      { pos: [1.5, -3.6, -2.5], scale: 0.24, material: wireMaterial },
      { pos: [3.9, 2.6, -2.1], scale: 0.26, material: goldMaterial },
      { pos: [5.8, -1.4, -3.4], scale: 0.2, material: glassMaterial },
      { pos: [0.4, 5.1, -4.1], scale: 0.18, material: darkGoldMaterial },
      { pos: [-6.2, 0.2, -4.6], scale: 0.16, material: wireMaterial },
    ].forEach((satellite, index) => {
      registerTemplateShape(
        createTemplateMesh(
          index % 2 === 0
            ? new THREE.OctahedronGeometry(1, 0)
            : new THREE.TetrahedronGeometry(1, 0),
          cloneSceneMaterial(satellite.material),
          {
            position: satellite.pos,
            scale: satellite.scale,
          },
        ),
        {
          rotX: 0.001 + index * 0.0003,
          rotY: 0.0018 + index * 0.0004,
          floatAmp: 0.1 + (index % 3) * 0.03,
          floatFreq: 0.26 + index * 0.04,
          baseY: satellite.pos[1],
          phaseOffset: index * 0.55,
        },
      );
    });
  }

  function buildCoffeeCupFoodModel() {
    const group = createSceneGroup({
      position: [4.1, -1.35, -2.3],
      rotation: [0.08, -0.28, -0.04],
      scale: 0.92,
    });

    group.add(
      createTemplateMesh(
        new THREE.CylinderGeometry(0.95, 0.78, 1.7, 28, 1, false),
        cloneSceneMaterial(glassMaterial, {
          color: 0xf5ead5,
          transparent: false,
          opacity: 1,
          metalness: 0.25,
          roughness: 0.28,
        }),
        { position: [0, 0.08, 0] },
      ),
    );

    group.add(
      createTemplateMesh(
        new THREE.CylinderGeometry(0.74, 0.62, 1.32, 24),
        cloneSceneMaterial(darkGoldMaterial, {
          color: 0x5b3920,
          metalness: 0.15,
          roughness: 0.65,
        }),
        { position: [0, 0.18, 0] },
      ),
    );

    group.add(
      createTemplateMesh(
        new THREE.TorusGeometry(0.42, 0.08, 12, 36, Math.PI * 1.25),
        cloneSceneMaterial(goldMaterial, {
          color: 0xf3dfb0,
          metalness: 0.45,
          roughness: 0.22,
        }),
        {
          position: [0.92, 0.15, 0],
          rotation: [0, 0, Math.PI / 2],
        },
      ),
    );

    group.add(
      createTemplateMesh(
        new THREE.CylinderGeometry(1.5, 1.72, 0.14, 32),
        cloneSceneMaterial(goldMaterial, {
          color: 0xd9c08a,
          metalness: 0.58,
          roughness: 0.18,
        }),
        { position: [0, -0.88, 0] },
      ),
    );

    group.add(
      createTemplateMesh(
        new THREE.TorusGeometry(1.1, 0.08, 10, 40),
        cloneSceneMaterial(wireMaterial, {
          color: 0xc9a84c,
          opacity: 0.24,
        }),
        {
          position: [0, -0.78, 0],
          rotation: [Math.PI / 2, 0, 0],
        },
      ),
    );

    registerFoodModelFloat(group, {
      rotX: 0.0008,
      rotY: 0.0018,
      floatAmp: 0.18,
      floatFreq: 0.42,
      baseY: group.position.y,
      phaseOffset: 0.4,
    });
    registerFoodModelPulse(group, {
      amplitude: 0.018,
      speed: 0.92,
    });
  }

  function buildPlatedDishFoodModel() {
    const group = createSceneGroup({
      position: [4.25, -1.5, -2.55],
      rotation: [0.18, -0.3, -0.02],
      scale: 1,
    });

    group.add(
      createTemplateMesh(
        new THREE.CylinderGeometry(1.72, 1.92, 0.18, 36),
        cloneSceneMaterial(glassMaterial, {
          color: 0xf1e6d3,
          transparent: false,
          opacity: 1,
          metalness: 0.22,
          roughness: 0.34,
        }),
        { position: [0, -0.32, 0] },
      ),
    );

    group.add(
      createTemplateMesh(
        new THREE.CylinderGeometry(1.1, 1.35, 0.22, 28),
        cloneSceneMaterial(goldMaterial, {
          color: 0x8f5c24,
          metalness: 0.18,
          roughness: 0.72,
        }),
        { position: [0, 0.02, 0] },
      ),
    );

    group.add(
      createTemplateMesh(
        new THREE.SphereGeometry(0.5, 20, 18),
        cloneSceneMaterial(goldMaterial, {
          color: 0xd09339,
          metalness: 0.2,
          roughness: 0.58,
        }),
        { position: [-0.48, 0.24, 0.22], scale: [1, 0.72, 1] },
      ),
    );

    group.add(
      createTemplateMesh(
        new THREE.SphereGeometry(0.42, 18, 16),
        cloneSceneMaterial(glassMaterial, {
          color: 0x4c7d3f,
          transparent: false,
          opacity: 1,
          metalness: 0.12,
          roughness: 0.7,
        }),
        { position: [0.42, 0.2, -0.1], scale: [1.1, 0.48, 1] },
      ),
    );

    group.add(
      createTemplateMesh(
        new THREE.TorusGeometry(1.25, 0.04, 10, 50),
        cloneSceneMaterial(wireMaterial, {
          color: 0xc9a84c,
          opacity: 0.22,
        }),
        {
          position: [0, -0.2, 0],
          rotation: [Math.PI / 2, 0, 0],
        },
      ),
    );

    registerFoodModelFloat(group, {
      rotX: 0.0007,
      rotY: 0.0016,
      floatAmp: 0.16,
      floatFreq: 0.34,
      baseY: group.position.y,
      phaseOffset: 0.9,
    });
    registerFoodModelPulse(group, {
      amplitude: 0.012,
      speed: 0.84,
    });
  }

  function buildDessertFoodModel() {
    const group = createSceneGroup({
      position: [4.35, -1.25, -2.45],
      rotation: [0.14, -0.32, 0.03],
      scale: 0.96,
    });

    group.add(
      createTemplateMesh(
        new THREE.CylinderGeometry(1.34, 1.52, 0.12, 32),
        cloneSceneMaterial(glassMaterial, {
          color: 0xf4ead8,
          transparent: false,
          opacity: 1,
          metalness: 0.2,
          roughness: 0.32,
        }),
        { position: [0, -0.68, 0] },
      ),
    );

    group.add(
      createTemplateMesh(
        new THREE.CylinderGeometry(0.72, 0.9, 0.95, 24),
        cloneSceneMaterial(goldMaterial, {
          color: 0xc17b42,
          metalness: 0.16,
          roughness: 0.74,
        }),
        { position: [0, -0.18, 0] },
      ),
    );

    group.add(
      createTemplateMesh(
        new THREE.SphereGeometry(0.62, 20, 18),
        cloneSceneMaterial(glassMaterial, {
          color: 0xf0e0bb,
          transparent: false,
          opacity: 1,
          metalness: 0.18,
          roughness: 0.36,
        }),
        { position: [0, 0.56, 0] },
      ),
    );

    group.add(
      createTemplateMesh(
        new THREE.SphereGeometry(0.18, 14, 14),
        cloneSceneMaterial(goldMaterial, {
          color: 0x8a1623,
          metalness: 0.12,
          roughness: 0.5,
        }),
        { position: [0.08, 1.12, 0.08] },
      ),
    );

    group.add(
      createTemplateMesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.36, 12),
        cloneSceneMaterial(goldMaterial, {
          color: 0x5a7f45,
          metalness: 0.08,
          roughness: 0.82,
        }),
        {
          position: [0.16, 1.22, -0.02],
          rotation: [0.2, 0, -0.3],
        },
      ),
    );

    registerFoodModelFloat(group, {
      rotX: 0.0009,
      rotY: 0.0017,
      floatAmp: 0.17,
      floatFreq: 0.46,
      baseY: group.position.y,
      phaseOffset: 1.2,
    });
    registerFoodModelPulse(group, {
      amplitude: 0.014,
      speed: 0.96,
    });
  }

  function buildServiceClocheFoodModel() {
    const group = createSceneGroup({
      position: [4.05, -1.4, -2.6],
      rotation: [0.12, -0.3, -0.04],
      scale: 0.98,
    });

    group.add(
      createTemplateMesh(
        new THREE.CylinderGeometry(1.78, 1.96, 0.14, 34),
        cloneSceneMaterial(goldMaterial, {
          color: 0xd8c08e,
          metalness: 0.68,
          roughness: 0.16,
        }),
        { position: [0, -0.74, 0] },
      ),
    );

    group.add(
      createTemplateMesh(
        new THREE.SphereGeometry(1.34, 28, 22, 0, Math.PI * 2, 0, Math.PI / 2),
        cloneSceneMaterial(glassMaterial, {
          color: 0xf5e7c6,
          transparent: false,
          opacity: 1,
          metalness: 0.42,
          roughness: 0.22,
        }),
        {
          position: [0, -0.12, 0],
          rotation: [Math.PI, 0, 0],
          scale: [1, 0.9, 1],
        },
      ),
    );

    group.add(
      createTemplateMesh(
        new THREE.SphereGeometry(0.24, 18, 16),
        cloneSceneMaterial(goldMaterial, {
          color: 0xc9a84c,
          metalness: 0.78,
          roughness: 0.12,
        }),
        { position: [0, 0.98, 0] },
      ),
    );

    group.add(
      createTemplateMesh(
        new THREE.CylinderGeometry(0.1, 0.14, 0.22, 16),
        cloneSceneMaterial(goldMaterial, {
          color: 0xc9a84c,
          metalness: 0.78,
          roughness: 0.12,
        }),
        { position: [0, 0.78, 0] },
      ),
    );

    group.add(
      createTemplateMesh(
        new THREE.TorusGeometry(1.12, 0.04, 10, 48),
        cloneSceneMaterial(wireMaterial, {
          color: 0xfff2cb,
          opacity: 0.18,
        }),
        {
          position: [0, 0.14, 0],
          rotation: [Math.PI / 2, 0, 0],
        },
      ),
    );

    registerFoodModelFloat(group, {
      rotX: 0.0006,
      rotY: 0.0015,
      floatAmp: 0.15,
      floatFreq: 0.32,
      baseY: group.position.y,
      phaseOffset: 0.7,
    });
    registerFoodModelPulse(group, {
      amplitude: 0.012,
      speed: 0.78,
    });
  }

  const HERO_SCENE_TEMPLATE_REGISTRY = {
    default: buildDefaultHeroTemplate,
    orbital: buildOrbitalHeroTemplate,
    sculptural: buildSculpturalHeroTemplate,
    constellation: buildConstellationHeroTemplate,
  };
  const HERO_SCENE_MODEL_PRESET_REGISTRY = {
    none: null,
    "coffee-cup": buildCoffeeCupFoodModel,
    "plated-dish": buildPlatedDishFoodModel,
    dessert: buildDessertFoodModel,
    "service-cloche": buildServiceClocheFoodModel,
  };

  function applyHeroSceneTemplate(templateKey) {
    const normalizedTemplateKey = SUPPORTED_HERO_SCENE_TEMPLATES.has(templateKey)
      ? templateKey
      : HERO_SCENE_DEFAULTS.template;

    if (normalizedTemplateKey === activeTemplateKey && shapes.length) {
      return;
    }

    clearActiveHeroTemplate();
    activeTemplateKey = normalizedTemplateKey;

    const templateBuilder =
      HERO_SCENE_TEMPLATE_REGISTRY[normalizedTemplateKey] ||
      HERO_SCENE_TEMPLATE_REGISTRY.default;
    templateBuilder();
  }

  function applyHeroSceneModelPreset(modelPresetKey) {
    const normalizedModelPresetKey = SUPPORTED_HERO_SCENE_MODEL_PRESETS.has(
      modelPresetKey,
    )
      ? modelPresetKey
      : HERO_SCENE_DEFAULTS.modelPreset;

    if (
      normalizedModelPresetKey === activeModelPresetKey &&
      (normalizedModelPresetKey === "none" || foodModelRoot.children.length)
    ) {
      return;
    }

    clearActiveHeroFoodModel();
    activeModelPresetKey = normalizedModelPresetKey;

    const modelBuilder = HERO_SCENE_MODEL_PRESET_REGISTRY[normalizedModelPresetKey];
    if (typeof modelBuilder === "function") {
      modelBuilder();
    }
  }

  applyHeroSceneTemplate(HERO_SCENE_DEFAULTS.template);
  applyHeroSceneModelPreset(HERO_SCENE_DEFAULTS.modelPreset);

  let activeParticleCount = getHeroSceneRuntimeConfig().particleCount;
  const positions = new Float32Array(HERO_SCENE_MAX_PARTICLE_COUNT * 3);
  const particleSpeeds = [];
  for (let i = 0; i < HERO_SCENE_MAX_PARTICLE_COUNT; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 30;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 15 - 5;
    particleSpeeds.push({
      x: (Math.random() - 0.5) * 0.002,
      y: (Math.random() - 0.5) * 0.002,
    });
  }
  const partGeo = new THREE.BufferGeometry();
  partGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  partGeo.setDrawRange(0, activeParticleCount);
  const partMat = new THREE.PointsMaterial({
    color: 0xd4a843,
    size: 0.06,
    transparent: true,
    opacity: 0.55,
    sizeAttenuation: true,
  });
  const particles = new THREE.Points(partGeo, partMat);
  scene.add(particles);

  let mouseX = 0;
  let mouseY = 0;
  let targetX = 0;
  let targetY = 0;
  document.addEventListener("mousemove", (event) => {
    mouseX = (event.clientX / window.innerWidth - 0.5) * 2;
    mouseY = -(event.clientY / window.innerHeight - 0.5) * 2;
  });

  let scrollY = 0;
  window.addEventListener("scroll", () => {
    scrollY = window.scrollY;
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();
    const sceneConfig = getHeroSceneRuntimeConfig();
    const sceneEnabled = sceneConfig.enabled !== false;

    applyHeroSceneTemplate(sceneConfig.template);
    applyHeroSceneModelPreset(sceneConfig.modelPreset);

    renderer.toneMappingExposure = sceneConfig.toneMappingExposure;
    ambientLight.intensity = sceneConfig.ambientLightIntensity;
    goldLight.intensity = sceneConfig.goldLightIntensity;
    warmLight.intensity = sceneConfig.warmLightIntensity;
    rimLight.intensity = sceneConfig.rimLightIntensity;
    camera.position.z = sceneConfig.cameraDistance;
    canvas.style.opacity = sceneEnabled ? "1" : "0";

    if (activeParticleCount !== sceneConfig.particleCount) {
      activeParticleCount = sceneConfig.particleCount;
      partGeo.setDrawRange(0, activeParticleCount);
    }

    if (heroSection) {
      heroSection.dataset.heroSceneTemplate = sceneConfig.template;
      heroSection.dataset.heroSceneModelPreset = sceneConfig.modelPreset;
      heroSection.dataset.heroScenePreset = sceneConfig.preset;
      heroSection.dataset.heroSceneEnabled = sceneEnabled ? "true" : "false";
    }

    if (!sceneEnabled) {
      renderer.clear();
      return;
    }

    targetX += (mouseX - targetX) * 0.04;
    targetY += (mouseY - targetY) * 0.04;

    camera.position.x = targetX * 0.8;
    camera.position.y = targetY * 0.5 - scrollY * 0.002;
    camera.lookAt(activeLookTarget);

    shapes.forEach((shape) => {
      shape.mesh.rotation.x += shape.rotX;
      shape.mesh.rotation.y += shape.rotY;
      const phase = shape.phaseOffset || 0;
      shape.mesh.position.y =
        shape.baseY + Math.sin(elapsed * shape.floatFreq + phase) * shape.floatAmp;
    });

    foodModelFloaters.forEach((item) => {
      item.object3d.rotation.x += item.rotX;
      item.object3d.rotation.y += item.rotY;
      const phase = item.phaseOffset || 0;
      item.object3d.position.y =
        item.baseY + Math.sin(elapsed * item.floatFreq + phase) * item.floatAmp;
    });

    goldLight.position.x =
      Math.cos(elapsed * activeLightMotion.speedX) * activeLightMotion.radiusX;
    goldLight.position.z =
      Math.sin(elapsed * activeLightMotion.speedX) * activeLightMotion.radiusZ +
      activeLightMotion.baseZ;
    goldLight.position.y =
      Math.sin(elapsed * activeLightMotion.speedY) * activeLightMotion.amplitudeY +
      activeLightMotion.baseY;

    const posAttr = partGeo.attributes.position;
    for (let i = 0; i < activeParticleCount; i += 1) {
      posAttr.array[i * 3] += particleSpeeds[i].x;
      posAttr.array[i * 3 + 1] += particleSpeeds[i].y;
      if (posAttr.array[i * 3] > 15) posAttr.array[i * 3] = -15;
      if (posAttr.array[i * 3] < -15) posAttr.array[i * 3] = 15;
      if (posAttr.array[i * 3 + 1] > 10) posAttr.array[i * 3 + 1] = -10;
      if (posAttr.array[i * 3 + 1] < -10) posAttr.array[i * 3 + 1] = 10;
    }
    posAttr.needsUpdate = true;

    pulseTargets.forEach((target) => {
      const pulse =
        target.baseScale + Math.sin(elapsed * target.speed) * target.amplitude;
      target.mesh.scale.setScalar(pulse * target.scaleMultiplier);
    });

    foodModelPulseTargets.forEach((target) => {
      const pulse =
        target.baseScale + Math.sin(elapsed * target.speed) * target.amplitude;
      target.object3d.scale.setScalar(pulse * target.scaleMultiplier);
    });

    renderer.render(scene, camera);
  }

  animate();
})();
