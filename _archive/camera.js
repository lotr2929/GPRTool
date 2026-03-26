// camera.js — Stable Perspective Camera for Three.js
// Boon Ong edition — tuned for consistent viewport framing

import { PerspectiveCamera } from "three";

export function createCamera(renderer, container) {

  // Stable FOV, safe clipping, dynamic aspect
  const camera = new PerspectiveCamera(
    60,                                            // stable field of view
    container.clientWidth / container.clientHeight, // aspect ratio
    0.1,                                           // near clipping plane
    1000                                           // far clipping plane
  );

  // Good diagonal starting angle
  camera.position.set(5, 5, 5);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();

  return camera;
}
