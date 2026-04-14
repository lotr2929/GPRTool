// Replace:
gizmoCamera.quaternion.copy(camera3D.quaternion);
const bwd = new THREE.Vector3(0, 0, 1).applyQuaternion(gizmoCamera.quaternion);
gizmoCamera.position.copy(bwd).multiplyScalar(5);

// With:
gizmoCamera.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI/2); // Force top-down view
gizmoCamera.position.set(0, 5, 0); // Fixed position above compass
