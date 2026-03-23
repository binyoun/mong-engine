/**
 * camera-manager.js
 * Plain getUserMedia camera — no MindAR dependency.
 * The viewer frames the painting themselves.
 */

export class CameraManager {
  constructor(viewportEl) {
    this.viewport = viewportEl;
    this.videoEl  = null;
    this._stream  = null;
  }

  async init() {
    this.videoEl = document.createElement('video');
    this.videoEl.setAttribute('autoplay', '');
    this.videoEl.setAttribute('playsinline', '');  // Required on iOS
    this.videoEl.setAttribute('muted', '');
    this.videoEl.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
    this.viewport.appendChild(this.videoEl);

    this._stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });

    this.videoEl.srcObject = this._stream;
    await new Promise((resolve, reject) => {
      this.videoEl.onloadedmetadata = resolve;
      this.videoEl.onerror = reject;
    });
    await this.videoEl.play();
    return true;
  }

  getVideo() { return this.videoEl; }

  destroy() {
    if (this._stream) this._stream.getTracks().forEach(t => t.stop());
  }
}
