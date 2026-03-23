/**
 * camera-manager.js
 * Real MindAR image target tracking.
 * Replaces the simulation with live detection anchored to the painting.
 *
 * Requires: targets.mind in the project root (compile from your painting image
 * at https://hiukim.github.io/mind-ar-js-doc/tools/compile/)
 */

const MINDAR_CDN = 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js';

export class CameraManager {
  constructor(viewportEl) {
    this.viewport = viewportEl;
    this.mindarThree = null;
    this.anchor = null;
    this.threeCamera = null;
    this.isTracking = false;
    this._onTargetFound = null;
    this._onTargetLost = null;
    this._onTargetUpdate = null;
  }

  async init() {
    // Load MindAR + THREE.js from CDN (includes THREE internally)
    await this._loadScript(MINDAR_CDN);

    this.mindarThree = new window.MINDAR.IMAGE.MindARThree({
      container: this.viewport,
      imageTargetSrc: './targets.mind',
      maxTrack: 1,
      filterMinCF: 0.001,   // smoothing: lower = smoother but more lag
      filterBeta: 1000,
      warmupTolerance: 1,
      missTolerance: 5,     // frames before lost — increase for exhibitions
    });

    const { renderer, scene, camera } = this.mindarThree;
    this.threeCamera = camera;

    // Invisible plane anchored to the painting — used to project corners to screen
    const geo = new window.THREE.PlaneGeometry(1, 1);
    const mat = new window.THREE.MeshBasicMaterial({ visible: false });
    const plane = new window.THREE.Mesh(geo, mat);

    this.anchor = this.mindarThree.addAnchor(0);
    this.anchor.group.add(plane);

    this.anchor.onTargetFound = () => {
      this.isTracking = true;
      const rect = this._getScreenRect();
      if (rect && this._onTargetFound) this._onTargetFound(rect);
    };

    this.anchor.onTargetLost = () => {
      this.isTracking = false;
      if (this._onTargetLost) this._onTargetLost();
    };

    await this.mindarThree.start();

    // Render loop — fires on every frame, emits position updates while tracking
    renderer.setAnimationLoop(() => {
      renderer.render(scene, camera);
      if (this.isTracking) {
        const rect = this._getScreenRect();
        if (rect && this._onTargetUpdate) this._onTargetUpdate(rect);
      }
    });

    console.log('[CameraManager] MindAR tracking active. Point camera at the painting.');
    return true;
  }

  /**
   * Project the 4 corners of the tracked target plane to viewport percentages.
   * Returns the bounding rect in the same format the rest of the app expects.
   */
  _getScreenRect() {
    if (!this.anchor || !this.threeCamera) return null;
    const THREE = window.THREE;
    const w = this.viewport.clientWidth;
    const h = this.viewport.clientHeight;

    const corners = [
      new THREE.Vector3(-0.5, -0.5, 0),
      new THREE.Vector3( 0.5, -0.5, 0),
      new THREE.Vector3( 0.5,  0.5, 0),
      new THREE.Vector3(-0.5,  0.5, 0),
    ];

    const matrix = this.anchor.group.matrixWorld;
    const projected = corners.map(c => {
      const v = c.clone().applyMatrix4(matrix).project(this.threeCamera);
      return {
        x: ( v.x * 0.5 + 0.5) * 100,
        y: (-v.y * 0.5 + 0.5) * 100,   // flip Y (WebGL vs CSS)
      };
    });

    const xs = projected.map(p => p.x);
    const ys = projected.map(p => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    const width  = Math.max(...xs) - x;
    const height = Math.max(...ys) - y;

    return {
      targetId: 'painting',
      position: { x: x + width / 2, y: y + height / 2, z: 0 },
      dimensions: { x, y, width, height },   // all in viewport %
    };
  }

  onTargetFound(callback)  { this._onTargetFound  = callback; }
  onTargetLost(callback)   { this._onTargetLost   = callback; }
  onTargetUpdate(callback) { this._onTargetUpdate = callback; }

  destroy() {
    if (this.mindarThree) this.mindarThree.stop();
  }

  _loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(s);
    });
  }
}
