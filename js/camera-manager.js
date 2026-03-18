/**
 * camera-manager.js
 * Handles camera access and simulated image target tracking.
 * 
 * FUTURE: Replace simulateTargetTracking() with real 8th Wall / MindAR
 * image target detection. The interface (onTargetFound, onTargetLost)
 * remains the same.
 */

export class CameraManager {
  constructor(viewportEl) {
    this.viewport = viewportEl;
    this.videoEl = null;
    this.stream = null;
    this.isTracking = false;
    this._onTargetFound = null;
    this._onTargetLost = null;
  }

  /**
   * Request camera access and render to viewport
   */
  async init() {
    this.videoEl = document.createElement('video');
    this.videoEl.setAttribute('autoplay', '');
    this.videoEl.setAttribute('playsinline', '');
    this.videoEl.setAttribute('muted', '');
    this.viewport.appendChild(this.videoEl);

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      this.videoEl.srcObject = this.stream;
      await this.videoEl.play();
      console.log('[CameraManager] Camera active');
      return true;

    } catch (err) {
      console.warn('[CameraManager] Camera access denied or unavailable:', err.message);
      // Fallback: show a dark viewport (works for exhibition preview)
      this.viewport.style.background = 
        'radial-gradient(ellipse at center, #1a1a22 0%, #0a0a0c 100%)';
      return false;
    }
  }

  /**
   * Simulate image target detection.
   * In a real implementation, this would be replaced with:
   *   - 8th Wall Image Target events
   *   - MindAR target tracking callbacks
   *   - WebXR hit-test results
   * 
   * The simulated version auto-triggers after a short delay
   * to allow testing the full overlay flow.
   */
  simulateTargetTracking({ delay = 1500 } = {}) {
    console.log('[CameraManager] Simulating target tracking...');

    setTimeout(() => {
      this.isTracking = true;
      if (this._onTargetFound) {
        this._onTargetFound({
          targetId: 'painting-hwajeopdo',
          // Simulated target position (center of viewport)
          position: { x: 0, y: 0, z: -0.5 },
          // Simulated target dimensions (percentage of viewport)
          dimensions: { width: 80, height: 70 }
        });
      }
    }, delay);
  }

  /**
   * Register callbacks for target events
   * Compatible with future real tracking implementations
   */
  onTargetFound(callback) {
    this._onTargetFound = callback;
  }

  onTargetLost(callback) {
    this._onTargetLost = callback;
  }

  /**
   * Stop camera and clean up
   */
  destroy() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    if (this.videoEl) {
      this.videoEl.remove();
    }
  }
}
