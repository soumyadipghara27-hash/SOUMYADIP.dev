// ==========================================
// THREE.JS 3D CYBER CORE & PARTICLE ENGINE
// ==========================================

const canvas = document.getElementById('webgl-canvas');
const scene = new THREE.Scene();

// Camera Setup
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 18;

// WebGL Renderer Setup
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  alpha: true,
  antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// 1. Layered spiral galaxy
const galaxyGroup = new THREE.Group();
galaxyGroup.position.z = -3.5;
galaxyGroup.rotation.x = 0.38;
scene.add(galaxyGroup);

const ambientSpaceLight = new THREE.AmbientLight(0x8b9cff, 0.65);
scene.add(ambientSpaceLight);
const systemKeyLight = new THREE.DirectionalLight(0xc5eaff, 1.5);
systemKeyLight.position.set(-12, 10, 18);
scene.add(systemKeyLight);

const galaxyCount = 9000;
const galaxyPositions = new Float32Array(galaxyCount * 3);
const galaxyColors = new Float32Array(galaxyCount * 3);
const galaxyColorStops = [
  new THREE.Color(0x42ddff),
  new THREE.Color(0x8a70ff),
  new THREE.Color(0xff8ed1),
  new THREE.Color(0xffd7a0)
];

for (let index = 0; index < galaxyCount; index++) {
  const arm = index % 4;
  const radius = 0.7 + Math.pow(Math.random(), 0.72) * 9.2;
  const spiral = radius * 0.72;
  const angle = arm * (Math.PI * 2 / 4) + spiral + (Math.random() - 0.5) * (0.18 + radius * 0.035);
  const spread = 0.12 + radius * 0.045;
  const positionIndex = index * 3;
  galaxyPositions[positionIndex] = Math.cos(angle) * radius + (Math.random() - 0.5) * spread;
  galaxyPositions[positionIndex + 1] = (Math.random() - 0.5) * (0.16 + radius * 0.035);
  galaxyPositions[positionIndex + 2] = Math.sin(angle) * radius + (Math.random() - 0.5) * spread;

  const colorPosition = Math.min(radius / 9.2, 0.999) * (galaxyColorStops.length - 1);
  const colorStop = Math.floor(colorPosition);
  const color = galaxyColorStops[colorStop].clone().lerp(
    galaxyColorStops[colorStop + 1],
    colorPosition - colorStop
  );
  const brightness = 0.38 + Math.random() * 0.62;
  galaxyColors[positionIndex] = color.r * brightness;
  galaxyColors[positionIndex + 1] = color.g * brightness;
  galaxyColors[positionIndex + 2] = color.b * brightness;
}

const galaxyGeo = new THREE.BufferGeometry();
galaxyGeo.setAttribute('position', new THREE.BufferAttribute(galaxyPositions, 3));
galaxyGeo.setAttribute('color', new THREE.BufferAttribute(galaxyColors, 3));
const galaxyMat = new THREE.PointsMaterial({
  size: 0.075,
  vertexColors: true,
  transparent: true,
  opacity: 0.76,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  sizeAttenuation: true
});
const galaxy = new THREE.Points(galaxyGeo, galaxyMat);
galaxyGroup.add(galaxy);

const glowCanvas = document.createElement('canvas');
glowCanvas.width = 128;
glowCanvas.height = 128;
const glowContext = glowCanvas.getContext('2d');
const glowGradient = glowContext.createRadialGradient(64, 64, 0, 64, 64, 64);
glowGradient.addColorStop(0, 'rgba(255, 238, 255, 0.9)');
glowGradient.addColorStop(0.12, 'rgba(135, 111, 255, 0.55)');
glowGradient.addColorStop(0.38, 'rgba(81, 61, 190, 0.18)');
glowGradient.addColorStop(1, 'rgba(35, 25, 100, 0)');
glowContext.fillStyle = glowGradient;
glowContext.fillRect(0, 0, glowCanvas.width, glowCanvas.height);
const glowTexture = new THREE.CanvasTexture(glowCanvas);
const galaxyCoreGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowTexture,
  color: 0xbdb6ff,
  transparent: true,
  opacity: 0.52,
  blending: THREE.AdditiveBlending,
  depthWrite: false
}));
galaxyCoreGlow.scale.set(7, 7, 1);
galaxyGroup.add(galaxyCoreGlow);

const nebula = [];
[
  { color: 0x6c43d8, x: -5.2, y: -0.25, z: 0.9, size: 8.5 },
  { color: 0x087fa8, x: 4.8, y: 0.3, z: -0.8, size: 7.5 },
  { color: 0xc04b9f, x: 0.4, y: 0.12, z: 4.1, size: 6.5 }
].forEach((cloud) => {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture,
    color: cloud.color,
    transparent: true,
    opacity: 0.12,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));
  sprite.position.set(cloud.x, cloud.y, cloud.z);
  sprite.scale.set(cloud.size, cloud.size, 1);
  galaxyGroup.add(sprite);
  nebula.push(sprite);
});

// 2. Orbiting planets and a small exploration satellite
const planetarySystem = new THREE.Group();
const compactPlanetSystem = window.innerWidth < 800;
planetarySystem.position.set(compactPlanetSystem ? 0 : 4.5, 0, -10.5);
planetarySystem.scale.setScalar(compactPlanetSystem ? 0.68 : 0.82);
scene.add(planetarySystem);

function createPlanetTexture(base, highlight, shadow, seed) {
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = 512;
  textureCanvas.height = 256;
  const textureContext = textureCanvas.getContext('2d');
  const baseGradient = textureContext.createLinearGradient(0, 0, 512, 0);
  baseGradient.addColorStop(0, shadow);
  baseGradient.addColorStop(0.35, base);
  baseGradient.addColorStop(0.68, highlight);
  baseGradient.addColorStop(1, shadow);
  textureContext.fillStyle = baseGradient;
  textureContext.fillRect(0, 0, 512, 256);

  for (let band = 0; band < 34; band++) {
    const y = band * 8 + Math.sin(band * 1.7 + seed) * 5;
    const height = 2 + (band % 4);
    textureContext.fillStyle = band % 3 === 0
      ? 'rgba(255,255,255,0.11)'
      : 'rgba(5,9,28,0.09)';
    textureContext.fillRect(0, y, 512, height);
  }

  for (let detail = 0; detail < 90; detail++) {
    const x = (detail * 67 + seed * 31) % 512;
    const y = (detail * 43 + seed * 17) % 256;
    textureContext.fillStyle = 'rgba(255,255,255,0.055)';
    textureContext.fillRect(x, y, 1 + (detail % 3), 1);
  }

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
  return texture;
}

function addOrbit(radius, color, opacity, rotationX) {
  const orbit = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.012, 6, 180),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false
    })
  );
  orbit.rotation.x = rotationX;
  planetarySystem.add(orbit);
  return orbit;
}

const planetOrbits = [];

function addPlanet({ radius, size, color, highlight, shadow, seed, speed, ring }) {
  const orbit = new THREE.Group();
  planetarySystem.add(orbit);
  addOrbit(radius, color, 0.13, Math.PI / 2 + seed * 0.025);

  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(size, 40, 32),
    new THREE.MeshStandardMaterial({
      map: createPlanetTexture(color, highlight, shadow, seed),
      roughness: 0.92,
      metalness: 0.02,
      emissive: color,
      emissiveIntensity: 0.035
    })
  );
  planet.position.set(radius, Math.sin(seed) * 0.28, 0);
  orbit.add(planet);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(size * 1.045, 32, 24),
    new THREE.MeshBasicMaterial({
      color: highlight,
      transparent: true,
      opacity: 0.075,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  planet.add(atmosphere);

  if (ring) {
    const planetRing = new THREE.Mesh(
      new THREE.TorusGeometry(size * 1.48, size * 0.16, 8, 100),
      new THREE.MeshBasicMaterial({
        color: highlight,
        transparent: true,
        opacity: 0.62,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    planetRing.rotation.x = Math.PI * 0.22;
    planetRing.scale.y = 0.58;
    planet.add(planetRing);

    const outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(size * 1.82, size * 0.025, 6, 100),
      new THREE.MeshBasicMaterial({
        color: 0xd9c5ff,
        transparent: true,
        opacity: 0.5,
        depthWrite: false
      })
    );
    outerRing.rotation.copy(planetRing.rotation);
    outerRing.scale.y = 0.58;
    planet.add(outerRing);
  }

  planetOrbits.push({ orbit, planet, speed, phase: seed });
  return planet;
}

addPlanet({
  radius: 8.4,
  size: 0.54,
  color: '#e58a6e',
  highlight: '#ffd0a2',
  shadow: '#482b54',
  seed: 2,
  speed: 0.035
});

const ringedPlanet = addPlanet({
  radius: 11.3,
  size: 0.86,
  color: '#9768dd',
  highlight: '#f2a9db',
  shadow: '#352b70',
  seed: 4,
  speed: -0.022,
  ring: true
});

addPlanet({
  radius: 14.2,
  size: 0.64,
  color: '#378ac6',
  highlight: '#8de8ff',
  shadow: '#1e396f',
  seed: 6,
  speed: 0.016
});

const moonOrbit = new THREE.Group();
ringedPlanet.add(moonOrbit);
moonOrbit.position.set(1.25, 0.1, 0);
const moonPath = new THREE.Mesh(
  new THREE.TorusGeometry(0.48, 0.008, 5, 64),
  new THREE.MeshBasicMaterial({
    color: 0xb2c9ff,
    transparent: true,
    opacity: 0.25,
    depthWrite: false
  })
);
moonPath.rotation.x = Math.PI / 2.5;
moonOrbit.add(moonPath);
const moon = new THREE.Mesh(
  new THREE.SphereGeometry(0.12, 16, 12),
  new THREE.MeshStandardMaterial({
    color: 0xd4d9ec,
    roughness: 1,
    emissive: 0x252b4d,
    emissiveIntensity: 0.25
  })
);
moon.position.x = 0.48;
moonOrbit.add(moon);

const satelliteOrbit = new THREE.Group();
satelliteOrbit.position.set(-2.1, 0.3, 0.2);
ringedPlanet.add(satelliteOrbit);
const satellite = new THREE.Group();
satellite.position.x = 1.65;
satelliteOrbit.add(satellite);
const satelliteBody = new THREE.Mesh(
  new THREE.BoxGeometry(0.19, 0.2, 0.28),
  new THREE.MeshStandardMaterial({
    color: 0xd9e8f2,
    metalness: 0.72,
    roughness: 0.34,
    emissive: 0x253c55,
    emissiveIntensity: 0.25
  })
);
satellite.add(satelliteBody);
const satellitePanelMaterial = new THREE.MeshBasicMaterial({
  color: 0x43dfff,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.88
});
[-1, 1].forEach((direction) => {
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.025, 0.23), satellitePanelMaterial);
  panel.position.x = direction * 0.34;
  satellite.add(panel);

  const panelLines = new THREE.Mesh(
    new THREE.BoxGeometry(0.49, 0.01, 0.025),
    new THREE.MeshBasicMaterial({ color: 0xc4f9ff, transparent: true, opacity: 0.68 })
  );
  panelLines.position.x = direction * 0.34;
  satellite.add(panelLines);
});
const antenna = new THREE.Mesh(
  new THREE.CylinderGeometry(0.012, 0.02, 0.27, 8),
  satellitePanelMaterial
);
antenna.position.y = 0.19;
satellite.add(antenna);

// 3. Scroll-driven time-warp star trails
const warpCount = 180;
const warpPositions = new Float32Array(warpCount * 6);
const warpColors = new Float32Array(warpCount * 6);
const warpStars = [];
const warpColorStops = [new THREE.Color(0x62eaff), new THREE.Color(0xb68cff)];
for (let index = 0; index < warpCount; index++) {
  const start = index * 6;
  const x = Math.random() * 2 - 1;
  const y = Math.random() * 2 - 1;
  const distanceFromCenter = Math.hypot(x, y) || 1;
  warpStars.push({
    x,
    y,
    dx: x / distanceFromCenter,
    dy: y / distanceFromCenter
  });
  const color = warpColorStops[index % warpColorStops.length];
  for (let vertex = 0; vertex < 2; vertex++) {
    const colorIndex = start + vertex * 3;
    warpColors[colorIndex] = color.r;
    warpColors[colorIndex + 1] = color.g;
    warpColors[colorIndex + 2] = color.b;
  }
}

const warpGeometry = new THREE.BufferGeometry();
warpGeometry.setAttribute('position', new THREE.BufferAttribute(warpPositions, 3));
warpGeometry.setAttribute('color', new THREE.BufferAttribute(warpColors, 3));
const warpMaterial = new THREE.LineBasicMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});
const warpTrails = new THREE.LineSegments(warpGeometry, warpMaterial);
warpTrails.frustumCulled = false;
scene.add(warpTrails);

const jumpFlare = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowTexture,
  color: 0x87dfff,
  transparent: true,
  opacity: 0,
  blending: THREE.AdditiveBlending,
  depthWrite: false
}));
scene.add(jumpFlare);

// 4. Deep-space star field
const partCount = 2600;
const posArray = new Float32Array(partCount * 3);
const baseStarColors = new Float32Array(partCount * 3);
const displayStarColors = new Float32Array(partCount * 3);
const starData = [];
const starPalette = [
  new THREE.Color(0xa6eaff),
  new THREE.Color(0xffffff),
  new THREE.Color(0xc6b8ff),
  new THREE.Color(0xffd7eb)
];
for (let index = 0; index < partCount; index++) {
  const positionIndex = index * 3;
  const color = starPalette[Math.floor(Math.random() * starPalette.length)];
  const brightness = 0.35 + Math.random() * 0.65;
  starData.push({
    x: Math.random() * 2 - 1,
    y: Math.random() * 2 - 1,
    depth: 12 + Math.random() * 90,
    phase: Math.random() * Math.PI * 2,
    brightness
  });
  baseStarColors[positionIndex] = color.r * brightness;
  baseStarColors[positionIndex + 1] = color.g * brightness;
  baseStarColors[positionIndex + 2] = color.b * brightness;
  displayStarColors[positionIndex] = baseStarColors[positionIndex];
  displayStarColors[positionIndex + 1] = baseStarColors[positionIndex + 1];
  displayStarColors[positionIndex + 2] = baseStarColors[positionIndex + 2];
}

const partGeo = new THREE.BufferGeometry();
partGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
partGeo.setAttribute('color', new THREE.BufferAttribute(displayStarColors, 3));

const partMat = new THREE.PointsMaterial({
  size: 0.042,
  vertexColors: true,
  transparent: true,
  opacity: 0.68,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});
const particles = new THREE.Points(partGeo, partMat);
scene.add(particles);

// Mouse Parallax Tracking
let mouseX = 0;
let mouseY = 0;
let sceneScrollProgress = 0;
let displayedScrollProgress = 0;
let previousDisplayedScrollProgress = 0;
let scrollVelocity = 0;
let scrollWarp = 0;
let scrollWarpTarget = 0;
let previousScrollY = window.scrollY;
let previousScrollTime = performance.now();
const sceneReduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clock = new THREE.Clock();

function readSceneScrollProgress() {
  const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
  sceneScrollProgress = sceneReduceMotion || scrollableHeight <= 0
    ? 0
    : Math.min(Math.max(window.scrollY / scrollableHeight, 0), 1);
}

window.setSceneScrollProgress = (progress) => {
  if (!sceneReduceMotion) {
    sceneScrollProgress = Math.min(Math.max(progress, 0), 1);
  }
};

window.addEventListener('mousemove', (e) => {
  mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
  mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
});

window.addEventListener('scroll', () => {
  const now = performance.now();
  const deltaTime = Math.max((now - previousScrollTime) / 1000, 0.016);
  const scrollSpeed = Math.abs(window.scrollY - previousScrollY) / deltaTime;
  previousScrollY = window.scrollY;
  previousScrollTime = now;
  scrollWarpTarget = sceneReduceMotion ? 0 : Math.min(scrollSpeed / 1700, 1);
}, { passive: true });

if (!sceneReduceMotion && !window.gsap) {
  window.addEventListener('scroll', readSceneScrollProgress, { passive: true });
}
window.addEventListener('resize', readSceneScrollProgress);
readSceneScrollProgress();

// Animation Loop
function animate3D() {
  requestAnimationFrame(animate3D);

  const frameDelta = Math.min(clock.getDelta(), 0.05);
  const elapsed = sceneReduceMotion ? 0 : clock.elapsedTime;
  previousDisplayedScrollProgress = displayedScrollProgress;
  displayedScrollProgress += (sceneScrollProgress - displayedScrollProgress) * 0.045;
  scrollVelocity = frameDelta > 0
    ? Math.abs(displayedScrollProgress - previousDisplayedScrollProgress) / frameDelta
    : 0;
  scrollWarpTarget *= Math.exp(-frameDelta * 2.4);
  scrollWarp += (scrollWarpTarget - scrollWarp) * Math.min(frameDelta * 6, 1);

  const scrollWave = Math.sin(displayedScrollProgress * Math.PI);
  const warpVisibility = sceneReduceMotion ? 0 : Math.min(
    Math.max(scrollWarp * 1.35, scrollVelocity * 1.4, scrollWave * 0.24),
    0.88
  );
  camera.position.z += (18 - displayedScrollProgress * 30 - camera.position.z) * 0.025;
  const visibleDepth = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const jumpDepth = 8;
  const jumpHeight = jumpDepth * visibleDepth;
  jumpFlare.position.set(0, 0, camera.position.z - jumpDepth);
  jumpFlare.scale.set(4.5 + warpVisibility * 8, 4.5 + warpVisibility * 8, 1);
  jumpFlare.material.opacity = warpVisibility * 0.48;

  galaxyGroup.rotation.y = elapsed * 0.012 + displayedScrollProgress * Math.PI * 1.1;
  galaxyGroup.rotation.z = Math.sin(elapsed * 0.12) * 0.035 + displayedScrollProgress * 0.16;
  galaxyGroup.position.z = camera.position.z - 21 + displayedScrollProgress * 7;
  galaxyGroup.scale.setScalar(0.92 + displayedScrollProgress * 0.12);
  galaxyMat.opacity = 0.58 + Math.sin(displayedScrollProgress * Math.PI) * 0.22;
  galaxyCoreGlow.material.opacity = 0.38 + Math.sin(elapsed * 0.8) * 0.06;
  nebula.forEach((cloud, index) => {
    cloud.material.opacity = 0.09 + Math.sin(elapsed * 0.35 + index * 1.8) * 0.035;
  });
  planetarySystem.rotation.y = elapsed * 0.018 + displayedScrollProgress * Math.PI * 1.5;
  planetarySystem.rotation.x = Math.sin(displayedScrollProgress * Math.PI * 2) * 0.06;
  planetarySystem.position.x = window.innerWidth < 800 ? 0 : 4.5;
  planetarySystem.position.z = camera.position.z - 29 + displayedScrollProgress * 8;
  planetarySystem.scale.setScalar((window.innerWidth < 800 ? 0.68 : 0.82) + displayedScrollProgress * 0.1);
  planetOrbits.forEach(({ orbit, planet, speed, phase }) => {
    orbit.rotation.y = elapsed * speed + displayedScrollProgress * Math.PI * 2 + phase;
    planet.rotation.y += 0.004 + Math.abs(speed) * 0.025;
  });
  moonOrbit.rotation.y = elapsed * 0.8 + displayedScrollProgress * Math.PI * 3;
  satelliteOrbit.rotation.y = elapsed * 0.52 + displayedScrollProgress * Math.PI * 2.5;
  satellite.rotation.y = Math.sin(elapsed * 0.7) * 0.28;
  satellite.rotation.z = Math.sin(elapsed * 0.45) * 0.12;

  const starTravel = displayedScrollProgress * 78;
  for (let index = 0; index < partCount; index++) {
    const star = starData[index];
    const depth = 12 + (((star.depth - starTravel) % 90) + 90) % 90;
    const positionIndex = index * 3;
    const frustumHeight = depth * visibleDepth;
    posArray[positionIndex] = star.x * frustumHeight * camera.aspect;
    posArray[positionIndex + 1] = star.y * frustumHeight;
    posArray[positionIndex + 2] = camera.position.z - depth;

    const twinkle = 0.7 + Math.sin(elapsed * (0.6 + star.brightness) + star.phase) * 0.3;
    displayStarColors[positionIndex] = baseStarColors[positionIndex] * twinkle;
    displayStarColors[positionIndex + 1] = baseStarColors[positionIndex + 1] * twinkle;
    displayStarColors[positionIndex + 2] = baseStarColors[positionIndex + 2] * twinkle;
  }
  partGeo.attributes.position.needsUpdate = true;
  partGeo.attributes.color.needsUpdate = true;
  partMat.opacity = 0.62 + scrollWave * 0.16;

  for (let index = 0; index < warpCount; index++) {
    const star = warpStars[index];
    const positionIndex = index * 6;
    const viewDepth = 10;
    const viewHeight = viewDepth * visibleDepth;
    const radius = Math.hypot(star.x, star.y);
    const startScale = 1 - warpVisibility * 0.28;
    const endScale = 1 + warpVisibility * (0.5 + radius * 1.5);
    warpPositions[positionIndex] = star.x * startScale * viewHeight * camera.aspect;
    warpPositions[positionIndex + 1] = star.y * startScale * viewHeight;
    warpPositions[positionIndex + 2] = camera.position.z - viewDepth;
    warpPositions[positionIndex + 3] = star.x * endScale * viewHeight * camera.aspect;
    warpPositions[positionIndex + 4] = star.y * endScale * viewHeight;
    warpPositions[positionIndex + 5] = camera.position.z - viewDepth;
  }
  warpGeometry.attributes.position.needsUpdate = true;
  warpMaterial.opacity = warpVisibility * 0.82;

  particles.rotation.y = mouseX * 0.025 + displayedScrollProgress * 0.12;
  particles.rotation.x = mouseY * 0.018;

  renderer.render(scene, camera);
}

animate3D();

// Handle Responsive Window Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  planetarySystem.position.x = window.innerWidth < 800 ? 0 : 4.5;
});