/**
 * clip-engine.js
 * 夢 ENGINE (Am I the Butterfly?)
 *
 * CLIP-only browser inference — no YOLO.
 * Regions are pre-defined zones in mong-labels.json.
 * One model download (~150MB, cached after first load).
 */

const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js';
const CLIP_MODEL       = 'Xenova/clip-vit-base-patch32';

export class ClipEngine {
  constructor() {
    this.classifier = null;
    this.isReady    = false;
    this._loading   = false;
  }

  /**
   * Load CLIP model. Call early to pre-warm.
   * @param {Function} onProgress - ({ stage: string, progress: 0-1 })
   */
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
   * Analyze pre-defined painting zones through 4 cultural lenses.
   *
   * @param {Object} targetInfo - { dimensions: { x, y, width, height } } in viewport %
   * @param {Object} labels     - Parsed mong-labels.json (needs .zones and .candidates)
   * @returns {Object}          - { regions: [ { id, boundingBox, layers } ] }
   */
  async analyze(targetInfo, labels) {
    if (!this.isReady) throw new Error('[MONG] CLIP not loaded yet');

    const video = document.querySelector('#camera-viewport video');
    if (!video || !video.videoWidth) throw new Error('[MONG] Camera video not available');

    const dims = targetInfo.dimensions;
    const vw   = video.videoWidth;
    const vh   = video.videoHeight;
    const cw   = video.clientWidth  || window.innerWidth;
    const ch   = video.clientHeight || window.innerHeight;

    const paintingCanvas = this._cropVideoCover(video, dims, vw, vh, cw, ch);
    const layerKeys      = Object.keys(labels.layers);
    const regions        = [];

    for (const zone of labels.zones) {
      const subCanvas  = this._cropCanvas(paintingCanvas, zone);
      const blobUrl    = await this._canvasToBlobUrl(subCanvas);
      const layers     = await this._runClip(blobUrl, labels, layerKeys);
      URL.revokeObjectURL(blobUrl);

      regions.push({
        id:          zone.id,
        boundingBox: { x: zone.x, y: zone.y, w: zone.w, h: zone.h },
        layers,
      });
    }

    return { regions };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

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

  /** Crop video frame to a CSS-viewport-% rect, accounting for object-fit:cover. */
  _cropVideoCover(video, dims, vw, vh, cw, ch) {
    const scale    = Math.max(cw / vw, ch / vh);
    const displayW = vw * scale;
    const displayH = vh * scale;
    const offsetX  = (cw - displayW) / 2;
    const offsetY  = (ch - displayH) / 2;

    const cssPx = (dims.x / 100) * cw;
    const cssPy = (dims.y / 100) * ch;
    const csPw  = (dims.width  / 100) * cw;
    const csPh  = (dims.height / 100) * ch;

    const vPixX = Math.max(0, Math.floor((cssPx - offsetX) / scale));
    const vPixY = Math.max(0, Math.floor((cssPy - offsetY) / scale));
    const vPixW = Math.min(Math.ceil(csPw / scale), vw - vPixX);
    const vPixH = Math.min(Math.ceil(csPh / scale), vh - vPixY);

    const canvas    = document.createElement('canvas');
    canvas.width    = Math.max(1, vPixW);
    canvas.height   = Math.max(1, vPixH);
    canvas.getContext('2d').drawImage(video, vPixX, vPixY, vPixW, vPixH, 0, 0, vPixW, vPixH);
    return canvas;
  }

  /** Crop a canvas by painting-relative % bounding box. */
  _cropCanvas(canvas, bb) {
    const px = Math.max(0, Math.floor((bb.x / 100) * canvas.width));
    const py = Math.max(0, Math.floor((bb.y / 100) * canvas.height));
    const pw = Math.min(Math.ceil((bb.w / 100) * canvas.width),  canvas.width  - px);
    const ph = Math.min(Math.ceil((bb.h / 100) * canvas.height), canvas.height - py);

    const out    = document.createElement('canvas');
    out.width    = Math.max(1, pw);
    out.height   = Math.max(1, ph);
    out.getContext('2d').drawImage(canvas, px, py, pw, ph, 0, 0, pw, ph);
    return out;
  }

  _canvasToBlobUrl(canvas) {
    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(URL.createObjectURL(blob)), 'image/jpeg', 0.92);
    });
  }
}
