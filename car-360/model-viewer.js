// Interactive 3D model viewer (three.js): studio lighting, soft ground shadow,
// orbit/zoom with damping, gentle auto-rotate that pauses while you interact.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function mountModel(root, url, { onProgress, onReady } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  root.appendChild(renderer.domElement);
  Object.assign(renderer.domElement.style, { width: '100%', height: '100%', display: 'block', touchAction: 'none' });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd4d2cf);
  scene.fog = new THREE.Fog(0xd4d2cf, 9, 22);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.minPolarAngle = 0.25; controls.maxPolarAngle = Math.PI / 2 - 0.04;
  controls.autoRotate = true; controls.autoRotateSpeed = 1.1;
  let idleTimer;
  controls.addEventListener('start', () => { controls.autoRotate = false; clearTimeout(idleTimer); });
  controls.addEventListener('end', () => { idleTimer = setTimeout(() => (controls.autoRotate = true), 2500); });

  // studio floor: tiled grey + soft contact shadow from an overhead "light box"
  const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 64), new THREE.MeshStandardMaterial({ color: 0xbdbcba, roughness: 0.55, metalness: 0 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(0.5, 8, 1.5); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 8; key.shadow.bias = -0.0004;
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
  scene.add(key);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 0.6));

  new GLTFLoader().load(url, gltf => {
    const car = gltf.scene;
    car.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    // normalise: ~4.9 m long like the real Purosangue, wheels on the floor, centred
    const box = new THREE.Box3().setFromObject(car), size = box.getSize(new THREE.Vector3());
    const s = 4.9 / Math.max(size.x, size.z);
    car.scale.setScalar(s);
    box.setFromObject(car);
    const c = box.getCenter(new THREE.Vector3());
    car.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
    scene.add(car);
    const h = box.getSize(new THREE.Vector3()).y;
    controls.target.set(0, h * 0.42, 0);
    camera.position.set(4.6, 1.6, 5.4);
    controls.minDistance = 3.5; controls.maxDistance = 11;
    controls.update();
    onReady && onReady(car);
  }, e => onProgress && e.total && onProgress(e.loaded / e.total));

  const resize = () => {
    const w = root.clientWidth, h = root.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(root); resize();
  let visible = true;
  new IntersectionObserver(([en]) => (visible = en.isIntersecting)).observe(root);
  renderer.setAnimationLoop(() => { if (!visible) return; controls.update(); renderer.render(scene, camera); });
  return { renderer, scene, camera, controls };
}
