/**
 * butterfly-ar.js
 * CSS-animated butterfly overlay — no Three.js/WebGL dependency.
 * Swap the textContent for an <img> or SVG when the real asset is ready.
 */

export class ButterflyAR {
  constructor() {
    this.el = null;
  }

  attach(containerEl) {
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.id = 'butterfly-ar';
      this.el.textContent = '蝶';
    }
    if (!this.el.parentNode) containerEl.appendChild(this.el);
  }

  detach() {
    if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }
}
