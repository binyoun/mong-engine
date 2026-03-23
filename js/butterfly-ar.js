/**
 * butterfly-ar.js
 * AR butterfly placeholder — attaches to the MindAR anchor group.
 * Replace this.mesh with a loaded GLTF model when the 3D asset is ready.
 *
 * Swap point: replace _buildMesh() contents with a GLTFLoader call.
 */

export class ButterflyAR {
  constructor() {
    this.mesh       = null;
    this._animating = false;
    this._rafId     = null;
  }

  /**
   * Attach the butterfly to a MindAR anchor group.
   * Safe to call multiple times — won't duplicate.
   */
  attach(anchorGroup) {
    if (!window.THREE) {
      console.warn('[ButterflyAR] THREE not loaded yet');
      return;
    }
    if (!this.mesh) this._buildMesh();
    if (!this.mesh.parent) anchorGroup.add(this.mesh);
    this._startAnimation();
  }

  /** Remove from scene, stop animation. */
  detach() {
    this._stopAnimation();
    if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh);
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /**
   * Build a simple canvas-texture plane showing 蝶.
   * SWAP THIS with GLTFLoader when the real model is ready.
   */
  _buildMesh() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Outer glow pass
    ctx.shadowColor = '#d4a017';
    ctx.shadowBlur  = 48;
    ctx.fillStyle   = 'rgba(212,160,23,0.25)';
    ctx.font        = '168px serif';
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('蝶', size / 2, size / 2);

    // Crisp pass
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = 'rgba(232,192,64,0.92)';
    ctx.fillText('蝶', size / 2, size / 2);

    const texture = new window.THREE.CanvasTexture(canvas);
    const geo     = new window.THREE.PlaneGeometry(0.38, 0.38);
    const mat     = new window.THREE.MeshBasicMaterial({
      map:        texture,
      transparent: true,
      side:       window.THREE.DoubleSide,
      depthWrite: false,
    });

    this.mesh = new window.THREE.Mesh(geo, mat);
    // Sit slightly in front of the painting plane (z-fighting prevention)
    this.mesh.position.set(0.12, 0.1, 0.015);
  }

  _startAnimation() {
    if (this._animating) return;
    this._animating = true;

    const animate = () => {
      if (!this._animating || !this.mesh) return;
      const t = Date.now() * 0.001;

      // Gentle drift
      this.mesh.position.y = 0.1  + Math.sin(t * 0.7)  * 0.06;
      this.mesh.position.x = 0.12 + Math.sin(t * 0.45) * 0.04;

      // Subtle scale breath (placeholder for wing-flap)
      const s = 1 + Math.sin(t * 3.2) * 0.05;
      this.mesh.scale.set(s, s, 1);

      // Slow sway
      this.mesh.rotation.z = Math.sin(t * 0.35) * 0.07;

      this._rafId = requestAnimationFrame(animate);
    };
    animate();
  }

  _stopAnimation() {
    this._animating = false;
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  }
}
