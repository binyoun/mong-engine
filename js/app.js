/**
 * app.js
 * 夢 ENGINE — 호접지몽 (胡蝶之夢)
 *
 * Camera opens immediately.
 * After 33 seconds (三十三天 — the 33 Heavens of Buddhist cosmology),
 * the AI's interpretation reveals itself over the painting.
 * Tap to toggle between seeing and not seeing.
 */

import { CameraManager }  from './camera-manager.js';
import { OverlayRenderer } from './overlay-renderer.js';
import { ClipEngine }      from './clip-engine.js';
import { ButterflyAR }     from './butterfly-ar.js';

const REVEAL_DELAY_MS = 33000; // 三十三天

class MongEngineApp {
  constructor() {
    this.camera       = new CameraManager(document.getElementById('camera-viewport'));
    this.overlay      = new OverlayRenderer(document.getElementById('detection-layer'));
    this.butterfly    = new ButterflyAR();
    this._clipEngine  = null;
    this._labels      = null;
    this._config      = null;
    this._revealed    = false;
    this._visible     = false;  // overlays currently showing
  }

  async init() {
    // Load config + labels in parallel
    [this._config, this._labels] = await Promise.all([
      this._fetchJSON('./config/perception-engines.json'),
      this._fetchJSON('./config/mong-labels.json'),
    ]);

    // Start camera immediately — requires user gesture on mobile,
    // so we attach a one-time tap listener first
    await this._waitForFirstTap();
    await this._startCamera();

    // Start 33-second countdown
    this._startCountdown();

    // Tap to toggle after reveal
    document.addEventListener('click', () => this._onTap());

    // Pre-load CLIP in background for live re-analysis
    this._preloadClip();
  }

  // ─── Camera ───────────────────────────────────────────────────────────────

  _waitForFirstTap() {
    // Show a minimal prompt so the viewer knows to tap
    this._setStatus('TAP TO BEGIN');
    return new Promise(resolve => {
      document.addEventListener('click', resolve, { once: true });
    });
  }

  async _startCamera() {
    this._setStatus('');
    try {
      await this.camera.init();
    } catch (err) {
      console.error('[夢] Camera failed:', err);
      this._setStatus('CAMERA UNAVAILABLE');
    }
  }

  // ─── 33-second countdown ──────────────────────────────────────────────────

  _startCountdown() {
    const bar = document.getElementById('reveal-bar');
    if (bar) {
      // Trigger CSS transition: width goes from 100% → 0% over 33s
      requestAnimationFrame(() => {
        bar.style.transition = `width ${REVEAL_DELAY_MS}ms linear`;
        bar.style.width = '0%';
      });
    }

    setTimeout(() => {
      this._revealed = true;
      this._show();
    }, REVEAL_DELAY_MS);
  }

  // ─── Reveal / toggle ──────────────────────────────────────────────────────

  _onTap() {
    if (!this._revealed) return;  // ignore taps before reveal
    if (this._visible) {
      this._hide();
    } else {
      // Re-analyze if CLIP is ready, otherwise show precomputed
      if (this._clipEngine?.isReady) {
        this._runClipAnalysis();
      } else {
        this._show();
      }
    }
  }

  _show() {
    this._visible = true;
    this.butterfly.attach(document.getElementById('detection-layer').parentElement);
    this._showPrecomputed();
  }

  _hide() {
    this._visible = false;
    this.butterfly.detach();
    this.overlay.clearDetections(false);
  }

  _showPrecomputed() {
    const engine = this._config?.engines.find(e => e.type === 'multi-layer');
    if (engine?.precomputedZones && this._labels) {
      this.overlay.clearDetections(false);
      this.overlay.renderMultiLayerDetections(engine.precomputedZones, this._labels.layers);
    }
  }

  // ─── CLIP live analysis ───────────────────────────────────────────────────

  async _runClipAnalysis() {
    const video = this.camera.getVideo();
    if (!video) return;

    this._setStatus('夢 — ANALYZING…');
    this.overlay.clearDetections(false);
    this.butterfly.attach(document.getElementById('detection-layer').parentElement);
    this._visible = true;

    try {
      const result = await this._clipEngine.analyze(video, this._labels);
      this.overlay.renderMultiLayerDetections(result.regions, this._labels.layers);
      this._setStatus('', 0);
    } catch (err) {
      console.error('[夢] Analysis failed:', err);
      this._setStatus('');
      this._showPrecomputed();
    }
  }

  async _preloadClip() {
    try {
      this._clipEngine = new ClipEngine();
      await this._clipEngine.load((p) => {
        console.log(`[夢] ${p.stage} ${Math.round(p.progress * 100)}%`);
      });
      console.log('[夢] CLIP ready — tap to re-analyze with live inference');
    } catch (err) {
      console.warn('[夢] CLIP pre-load failed:', err);
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  _setStatus(text) {
    const el = document.getElementById('mong-status');
    if (!el) return;
    el.textContent   = text;
    el.style.opacity = text ? '1' : '0';
  }

  async _fetchJSON(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`[夢] Failed to load ${url}:`, err);
      return null;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => new MongEngineApp().init());
