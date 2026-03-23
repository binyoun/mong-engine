/**
 * clip-engine.js
 * 夢 ENGINE (Am I the Butterfly?)
 *
 * Runs YOLO object detection + CLIP zero-shot classification
 * entirely in the browser via Transformers.js.
 * No server required. Models are cached after first download (~160MB total).
 */

const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js';
const YOLO_MODEL       = 'Xenova/yolov8n';
const CLIP_MODEL       = 'Xenova/clip-vit-base-patch32';
const YOLO_THRESHOLD   = 0.25;

export class ClipEngine {
  constructor() {
    this.detector   = null;
    this.classifier = null;
    this.isReady    = false;
    this._loading   = false;
  }

  /**
   * Load YOLO + CLIP models. Call early to pre-warm.
   * @param {Function} onProgress - ({ stage: string, progress: 0-1 })
   */
  async load(onProgress = () => {}) {
    if (this.isReady || this._loading) return;
    this._loading = true;

    try {
      onProgress({ stage: 'Loading Transformers.js…', progress: 0.02 });
      const { pipeline, env } = await import(TRANSFORMERS_CDN);
      env.allowLocalModels = false;

      onProgress({ stage: 'Loading YOLO detector…', progress: 0.08 });
      this.detector = await pipeline('object-detection', YOLO_MODEL, {
        progress_callback: (p) => {
          if (p.status === 'progress') {
            onProgress({ stage: 'YOLO — downloading model', progress: 0.08 + p.progress * 0.22 });
          }
        }
      });

      onProgress({ stage: 'Loading CLIP model…', progress: 0.30 });
      this.classifier = await pipeline('zero-shot-image-classification', CLIP_MODEL, {
        progress_callback: (p) => {
          if (p.status === 'progress') {
            onProgress({ stage: 'CLIP — downloading model', progress: 0.30 + p.progress * 0.68 });
          }
        }
      });

      this.isReady = true;
      this._loading = false;
      onProgress({ stage: 'Ready', progress: 1 });
    } catch (err) {
      this._loading = false;
      throw err;
    }
  }

  /**
   * Analyze the tracked painting through 4 cultural lenses.
   *
   * @param {Object} targetInfo  - { dimensions: { x, y, width, height } } in viewport %
   * @param {Object} labels      - Parsed mong-labels.json
   * @returns {Object}           - { regions: [ { id, yoloLabel, yoloScore, boundingBox, layers } ] }
   */
  async analyze(targetInfo, labels) {
    if (!this.isReady) throw new Error('[MONG] Models not loaded yet');

    const video = document.querySelector('#camera-viewport video');
    if (!video || !video.videoWidth) throw new Error('[MONG] Camera video not available');

    const dims   = targetInfo.dimensions;
    const vw     = video.videoWidth;
    const vh     = video.videoHeight;
    const cw     = video.clientWidth  || window.innerWidth;
    const ch     = video.clientHeight || window.innerHeight;

    // Map CSS viewport % → video pixel coords (accounting for object-fit: cover)
    const paintingCanvas = this._cropVideoCover(video, dims, vw, vh, cw, ch);

    // Run YOLO
    const blobUrl = await this._canvasToBlobUrl(paintingCanvas);
    let yoloResults = [];
    try {
      yoloResults = await this.detector(blobUrl, { threshold: YOLO_THRESHOLD });
    } catch (e) {
      console.warn('[MONG] YOLO failed, using fallback:', e.message);
    } finally {
      URL.revokeObjectURL(blobUrl);
    }

    const filtered = this._nms(yoloResults, 0.5);
    const layerKeys = Object.keys(labels.layers);
    const regions = [];

    for (let i = 0; i < filtered.length; i++) {
      const det = filtered[i];

      // YOLO box → painting-relative %
      const bb = {
        x: Math.max(0, (det.box.xmin / paintingCanvas.width)  * 100),
        y: Math.max(0, (det.box.ymin / paintingCanvas.height) * 100),
        w: Math.min(100, ((det.box.xmax - det.box.xmin) / paintingCanvas.width)  * 100),
        h: Math.min(100, ((det.box.ymax - det.box.ymin) / paintingCanvas.height) * 100),
      };

      // Crop sub-region for CLIP
      const subCanvas  = this._cropCanvas(paintingCanvas, bb);
      const subBlobUrl = await this._canvasToBlobUrl(subCanvas);

      const layerResults = await this._runClip(subBlobUrl, labels, layerKeys);
      URL.revokeObjectURL(subBlobUrl);

      regions.push({
        id:           `mong-${i}`,
        yoloLabel:    det.label,
        yoloScore:    det.score,
        boundingBox:  bb,
        layers:       layerResults,
      });
    }

    // If YOLO detected nothing, fall back to whole-painting CLIP
    if (regions.length === 0) {
      const wholeBlobUrl  = await this._canvasToBlobUrl(paintingCanvas);
      const layerResults  = await this._runClip(wholeBlobUrl, labels, layerKeys);
      URL.revokeObjectURL(wholeBlobUrl);

      regions.push({
        id:          'mong-whole',
        yoloLabel:   'painting',
        yoloScore:   1.0,
        boundingBox: { x: 8, y: 8, w: 84, h: 84 },
        layers:      layerResults,
      });
    }

    return { regions };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Run CLIP zero-shot classification and return best match per layer.
   * @returns {Object} { western: { label, confidence }, korean: ..., ... }
   */
  async _runClip(blobUrl, labels, layerKeys) {
    const allCandidates = [];
    const candidateLayer = {};
    for (const key of layerKeys) {
      for (const cand of labels.candidates[key]) {
        allCandidates.push(cand);
        candidateLayer[cand] = key;
      }
    }

    let clipResults = [];
    try {
      clipResults = await this.classifier(blobUrl, allCandidates);
    } catch (e) {
      console.warn('[MONG] CLIP failed:', e.message);
    }

    const layerBest = {};
    for (const r of clipResults) {
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

  /**
   * Crop a video frame to a CSS-viewport-% rect, accounting for object-fit:cover.
   */
  _cropVideoCover(video, dims, vw, vh, cw, ch) {
    // Compute how the video is letterboxed/cropped under object-fit:cover
    const scaleX = cw / vw;
    const scaleY = ch / vh;
    const scale  = Math.max(scaleX, scaleY);
    const displayW = vw * scale;
    const displayH = vh * scale;
    const offsetX  = (cw - displayW) / 2;  // negative = the video is cropped
    const offsetY  = (ch - displayH) / 2;

    // Convert CSS viewport % → CSS pixels
    const cssPx = (dims.x / 100) * cw;
    const cssPy = (dims.y / 100) * ch;
    const csPw  = (dims.width  / 100) * cw;
    const csPh  = (dims.height / 100) * ch;

    // CSS pixels → video pixels
    const vPixX = Math.max(0, Math.floor((cssPx - offsetX) / scale));
    const vPixY = Math.max(0, Math.floor((cssPy - offsetY) / scale));
    const vPixW = Math.min(Math.ceil(csPw / scale), vw - vPixX);
    const vPixH = Math.min(Math.ceil(csPh / scale), vh - vPixY);

    const canvas = document.createElement('canvas');
    canvas.width  = Math.max(1, vPixW);
    canvas.height = Math.max(1, vPixH);
    canvas.getContext('2d').drawImage(video, vPixX, vPixY, vPixW, vPixH, 0, 0, vPixW, vPixH);
    return canvas;
  }

  /**
   * Crop a canvas by painting-relative % bounding box.
   */
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

  /** Simple greedy NMS to deduplicate YOLO detections. */
  _nms(detections, iouThreshold) {
    const sorted     = [...detections].sort((a, b) => b.score - a.score);
    const keep       = [];
    const suppressed = new Set();
    for (let i = 0; i < sorted.length; i++) {
      if (suppressed.has(i)) continue;
      keep.push(sorted[i]);
      for (let j = i + 1; j < sorted.length; j++) {
        if (!suppressed.has(j) && this._iou(sorted[i].box, sorted[j].box) > iouThreshold) {
          suppressed.add(j);
        }
      }
    }
    return keep;
  }

  _iou(a, b) {
    const ix1 = Math.max(a.xmin, b.xmin), iy1 = Math.max(a.ymin, b.ymin);
    const ix2 = Math.min(a.xmax, b.xmax), iy2 = Math.min(a.ymax, b.ymax);
    if (ix2 <= ix1 || iy2 <= iy1) return 0;
    const inter = (ix2 - ix1) * (iy2 - iy1);
    const aArea = (a.xmax - a.xmin) * (a.ymax - a.ymin);
    const bArea = (b.xmax - b.xmin) * (b.ymax - b.ymin);
    return inter / (aArea + bArea - inter);
  }
}
