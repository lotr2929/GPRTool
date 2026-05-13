import * as THREE from 'three';
import { OrbitControls } from './OrbitControls.js';
import { state } from './state.js';
import { syncViewportBackground } from './viewport.js';
import { updateSceneHelpers } from './grid.js';

export function initScene() {
  const canvas    = document.getElementById('three-canvas');
  const container = canvas.parentElement;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();

  state.renderer  = renderer;
  state.scene     = scene;
  state.canvas    = canvas;
  state.container = container;

  syncViewportBackground();
  new MutationObserver(syncViewportBackground)
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const camera3D = new THREE.PerspectiveCamera(45, 2, 0.1, 10000);
  camera3D.position.set(100, 100, 100);
  state.camera3D = camera3D;

  const camera2D = new THREE.OrthographicCamera(-50, 50, 50, -50, 0.1, 20000);
  camera2D.position.set(0, 10000, 0);
  camera2D.quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  state.camera2D = camera2D;
  state.camera   = camera2D;

  const controls3D = new OrbitControls(camera3D, state.renderer.domElement);
  state.controls3D = controls3D;
  controls3D.enableDamping      = true;
  controls3D.dampingFactor      = 0.08;
  controls3D.rotateSpeed        = 0.6;
  controls3D.zoomSpeed          = 0.8;
  controls3D.panSpeed           = 1.0;
  controls3D.screenSpacePanning = true;
  controls3D.minDistance        = 1;
  controls3D.maxDistance        = 5000;
  controls3D.minPolarAngle      = 0.01;
  controls3D.maxPolarAngle      = Math.PI * 0.85;
  controls3D.mouseButtons       = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  controls3D.touches            = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  const controls2D = { update: () => {}, saveState: () => {}, target: new THREE.Vector3() };
  state.controls2D = controls2D;
  state.controls   = controls2D;

  const keyLight    = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(2, 4, 3);
  const fillLight   = new THREE.DirectionalLight(0xffffff, 0.4);
  fillLight.position.set(-3, 2, -2);
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(keyLight, fillLight, ambientLight);

  state.MAT = {
    model:    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
    ground:   new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
    roof:     new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
    wall:     new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
    sloped:   new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
    hover:    new THREE.MeshBasicMaterial({ color: 0xd8d8d8, side: THREE.DoubleSide }),
    selected: new THREE.MeshBasicMaterial({ color: 0xc8e8c8, side: THREE.DoubleSide }),
  };

  state.edgeGroup = new THREE.Group();

  state.raycaster  = new THREE.Raycaster();
  state.pointerNDC = new THREE.Vector2();

  updateSceneHelpers(100);
}
