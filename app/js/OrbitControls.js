// Simplified, stable OrbitControls
// Boon Ong edition — prevents clipping, flipping, and wild rotations

import {
    EventDispatcher,
    MOUSE,
    Quaternion,
    Spherical,
    TOUCH,
    Vector2,
    Vector3,
} from "three";

class OrbitControls extends EventDispatcher {
    constructor(object, domElement) {
        super();

        this.object = object;
        this.domElement = domElement;
        this.domElement.style.touchAction = "none";

        this.enabled = true;
        this.target = new Vector3(0, 0, 0);

        // Stable distance limits
        this.minDistance = 3;
        this.maxDistance = 20;

        // Vertical orbit limits (prevents flipping)
        this.minPolarAngle = Math.PI * 0.1;
        this.maxPolarAngle = Math.PI * 0.9;

        // Horizontal orbit limits
        this.minAzimuthAngle = -Math.PI * 0.85;
        this.maxAzimuthAngle =  Math.PI * 0.85;

        // Smooth damping
        this.enableDamping = true;
        this.dampingFactor = 0.07;

        // Interaction speeds
        this.enableZoom = true;
        this.enableRotate = true;
        this.enablePan = true;

        this.rotateSpeed = 0.7;
        this.zoomSpeed = 1.0;
        this.panSpeed = 0.6;

        // Internal state
        this.spherical = new Spherical();
        this.sphericalDelta = new Spherical();
        this.scale = 1;
        this.panOffset = new Vector3();

        this.tempVec3 = new Vector3();
        this.tempQuat = new Quaternion().setFromUnitVectors(
            object.up,
            new Vector3(0, 1, 0)
        );
        this.tempQuatInverse = this.tempQuat.clone().invert();

        this.state = "none";
        this.rotateStart = new Vector2();
        this.rotateEnd = new Vector2();
        this.rotateDelta = new Vector2();
        this.panStart = new Vector2();
        this.panEnd   = new Vector2();
        this.panDelta = new Vector2();

        // Event bindings
        this.domElement.addEventListener("pointerdown", (e) =>
            this.onPointerDown(e)
        );
        this.domElement.addEventListener(
            "wheel",
            (e) => this.onMouseWheel(e),
            { passive: false }
        );

        this.update();
    }

    update() {
        const offset = this.tempVec3;

        offset.copy(this.object.position).sub(this.target);
        offset.applyQuaternion(this.tempQuat);

        this.spherical.setFromVector3(offset);
        this.spherical.theta += this.sphericalDelta.theta;
        this.spherical.phi += this.sphericalDelta.phi;

        // Clamp angles
        this.spherical.theta = Math.max(
            this.minAzimuthAngle,
            Math.min(this.maxAzimuthAngle, this.spherical.theta)
        );
        this.spherical.phi = Math.max(
            this.minPolarAngle,
            Math.min(this.maxPolarAngle, this.spherical.phi)
        );

        this.spherical.makeSafe();

        // Clamp zoom
        this.spherical.radius = Math.max(
            this.minDistance,
            Math.min(this.maxDistance, this.spherical.radius * this.scale)
        );

        offset.setFromSpherical(this.spherical);
        offset.applyQuaternion(this.tempQuatInverse);

        this.object.position.copy(this.target).add(offset);
        this.object.lookAt(this.target);

        if (this.enableDamping) {
            this.sphericalDelta.theta *= 0.9;
            this.sphericalDelta.phi *= 0.9;
            this.panOffset.multiplyScalar(0.9);
        } else {
            this.sphericalDelta.set(0, 0, 0);
            this.panOffset.set(0, 0, 0);
        }

        this.scale = 1;
    }

    onPointerDown(event) {
        event.preventDefault();

        if (event.button === 0 && event.shiftKey) {
            this.state = "pan";
            this.panStart.set(event.clientX, event.clientY);
            this._panGround = this._screenToGround(event.clientX, event.clientY);
        } else if (event.button === 0) {
            this.state = "rotate";
            this.rotateStart.set(event.clientX, event.clientY);
        }

        this.domElement.addEventListener("pointermove", (e) =>
            this.onPointerMove(e)
        );
        this.domElement.addEventListener("pointerup", (e) =>
            this.onPointerUp(e)
        );
    }

    onPointerMove(event) {
        if (this.state === "rotate") {
            this.rotateEnd.set(event.clientX, event.clientY);
            this.rotateDelta
                .subVectors(this.rotateEnd, this.rotateStart)
                .multiplyScalar(this.rotateSpeed * 0.005);
            this.sphericalDelta.theta -= this.rotateDelta.x;
            this.sphericalDelta.phi -= this.rotateDelta.y;
            this.rotateStart.copy(this.rotateEnd);
        } else if (this.state === "pan") {
            // Project current mouse onto ground plane; slide target so
            // the world point stays under the cursor.
            const curr = this._screenToGround(event.clientX, event.clientY);
            if (this._panGround && curr) {
                const delta = this._panGround.clone().sub(curr);
                this.target.add(delta);
                this._panGround = this._screenToGround(event.clientX, event.clientY);
            }
        }
        this.update();
    }

    // Project a screen point onto the Y=0 ground plane via camera ray
    _screenToGround(clientX, clientY) {
        const rect = this.domElement.getBoundingClientRect();
        const ndcX =  ((clientX - rect.left) / rect.width)  * 2 - 1;
        const ndcY = -((clientY - rect.top)  / rect.height) * 2 + 1;
        const near = new Vector3(ndcX, ndcY, -1).unproject(this.object);
        const far  = new Vector3(ndcX, ndcY,  1).unproject(this.object);
        const dir  = new Vector3().subVectors(far, near).normalize();
        if (Math.abs(dir.y) < 1e-6) return null;
        const t = -near.y / dir.y;
        if (t < 0) return null;
        return near.clone().addScaledVector(dir, t);
    }

    onPointerUp() {
        this.state = "none";
        this.domElement.removeEventListener("pointermove", (e) =>
            this.onPointerMove(e)
        );
        this.domElement.removeEventListener("pointerup", (e) =>
            this.onPointerUp(e)
        );
    }

    onMouseWheel(event) {
        event.preventDefault();

        if (event.deltaY > 0) {
            this.scale = 1.1;
        } else if (event.deltaY < 0) {
            this.scale = 1 / 1.1;
        }

        this.update();
    }
}

export { OrbitControls };
