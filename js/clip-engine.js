/**
 * clip-engine.js
 * 夢 ENGINE — CLIP-only browser inference.
 * Analyzes the live camera frame through pre-defined zones.
 */

const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js';
const CLIP_MODEL       = 'Xenova/clip-vit-base-patch32';

export class ClipEngine {
  constructor() {
    this.classifier = null;
    this.isReady    = false;
    this._loading   = false;
  }

  async load(onProgress = () => {}) {
    if (this.isReady || this._loading) return;
    this._loading = true;

    try {
      onProgress({ stage: 'Loading Transformers.js…', progress: 0.02 });
      const { pipeline, env } = await import(TRANSFORMERS_CDN);
      env.allowLocalModels = false;

      onProgress({ stage: 'Loading CLIP model…', progress: 0.08 });
      this.classifier = await pipeline('zero-shot-image-classification', CLIP_MODEL, {
        progress_callback: (p) => {
          if (p.status === 'progress') {
            onProgress({ stage: 'CLIP — downloading', progress: 0.08 + p.progress * 0.92 });
          }
        }
      });

      this.isReady  = true;
      this._loading = false;
      onProgress({ stage: 'Ready', progress: 1 });
    } catch (err) {
      this._loading = false;
      throw err;
    }
  }

  /**
   * Analyze pre-defined zones of the current camera frame.
   * @param {HTMLVideoElement} videoEl
   * @param {Object} labels - parsed mong-labels.json
   */
  async analyze(videoEl, labels) {
    if (!this.isReady) throw new Error('[MONG] CLIP not loaded yet');

    const w = videoEl.videoWidth  || videoEl.clientWidth  || 640;
    const h = videoEl.videoHeight || videoEl.clientHeight || 480;

    // Capture current frame
    const frame = document.createElement('canvas');
    frame.width  = w;
    frame.height = h;
    frame.getContext('2d').drawImage(videoEl, 0, 0, w, h);

    const layerKeys = Object.keys(labels.layers);
    const regions   = [];

    for (const zone of labels.zones) {
      const sub     = this._cropCanvas(frame, zone);
      const blobUrl = await this._canvasToBlobUrl(sub);
      const layers  = await this._runClip(blobUrl, labels, layerKeys);
      URL.revokeObjectURL(blobUrl);

      regions.push({
        id:          zone.id,
        boundingBox: { x: zone.x, y: zone.y, w: zone.w, h: zone.h },
        layers,
      });
    }

    return { regions };
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  async _runClip(blobUrl, labels, layerKeys) {
    const allCandidates  = [];
    const candidateLayer = {};
    for (const key of layerKeys) {
      for (const cand of labels.candidates[key]) {
        allCandidates.push(cand);
        candidateLayer[cand] = key;
      }
    }

    let results = [];
    try {
      results = await this.classifier(blobUrl, allCandidates);
    } catch (e) {
      console.warn('[MONG] CLIP inference failed:', e.message);
    }

    const layerBest = {};
    for (const r of results) {
      const lk = candidateLayer[r.label];
      if (!layerBest[lk] || r.score > layerBest[lk].score) layerBest[lk] = r;
    }

    const out = {};
    for (const key of layerKeys) {
      const best = layerBest[key];
      out[key] = { label: best ? best.label : '—', confidence: best ? best.score : 0 };
    }
    return out;
  }

  _cropCanvas(canvas, bb) {
    const px = Math.max(0, Math.floor((bb.x / 100) * canvas.width));
    const py = Math.max(0, Math.floor((bb.y / 100) * canvas.height));
    const pw = Math.min(Math.ceil((bb.w / 100) * canvas.width),  canvas.width  - px);
    const ph = Math.min(Math.ceil((bb.h / 100) * canvas.height), canvas.height - py);

    const out = document.createElement('canvas');
    out.width  = Math.max(1, pw);
    out.height = Math.max(1, ph);
    out.getContext('2d').drawImage(canvas, px, py, pw, ph, 0, 0, pw, ph);
    return out;
  }

  _canvasToBlobUrl(canvas) {
    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(URL.createObjectURL(blob)), 'image/jpeg', 0.92);
    });
  }
}
