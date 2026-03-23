/**
 * app.js
 * 夢 ENGINE — Main Application
 */

import { CameraManager } from './camera-manager.js';
import { OverlayRenderer } from './overlay-renderer.js';
import { UIController } from './ui-controller.js';
import { ClipEngine } from './clip-engine.js';
import { ButterflyAR } from './butterfly-ar.js';

class MongEngineApp {
  constructor() {
    this.config         = null;
    this.camera         = null;
    this.overlay        = null;
    this.ui             = null;
    this._activeEngine  = null;
    this._clipEngine    = null;
    this._mongLabels    = null;
    this._butterfly     = new ButterflyAR();
    this._cameraStarted = false;
  }

  async init() {
    console.log('[夢] Initializing…');

    this.config = await this._loadConfig();
    if (!this.config) { console.error('[夢] Config load failed.'); return; }

    this.overlay = new OverlayRenderer(document.getElementById('detection-layer'));

    this.ui = new UIController({
      engines: this.config.engines,
      onEngineSelect: (engine) => this._onEngineActivated(engine),
    });
    this.ui.buildLandingScreen();
    this.ui.buildEngineSwitcher();

    this.camera = new CameraManager(document.getElementById('camera-viewport'));

    // Back button
    document.querySelector('.hud-back-btn').addEventListener('click', () => {
      this.overlay.clearDetections();
      this._butterfly.detach();
      this.ui.returnToLanding();
      this._activeEngine = null;
    });

    // Tap anywhere on the viewport to re-analyze
    document.getElementById('camera-viewport').addEventListener('click', () => {
      if (this._activeEngine?.type === 'multi-layer') this._runMongAnalysis();
    });

    // Pre-load CLIP in background
    this._preloadClip();

    console.log('[夢] Ready.');
  }

  // ─── Engine activation ────────────────────────────────────────────────────

  _onEngineActivated(engine) {
    console.log(`[夢] Engine: ${engine.name}`);
    this._activeEngine = engine;
    this.overlay.clearDetections(false);
    this._butterfly.detach();

    if (!this._cameraStarted) {
      this._cameraStarted = true;
      this._startCamera(engine);
    } else {
      this._applyEngine(engine);
    }
  }

  async _startCamera(engine) {
    this._setStatus('STARTING CAMERA…');
    try {
      await this.camera.init();
      this._setStatus('');
      this._applyEngine(engine);
    } catch (err) {
      console.error('[夢] Camera failed:', err);
      this._setStatus('CAMERA UNAVAILABLE');
    }
  }

  _applyEngine(engine) {
    if (engine.type === 'multi-layer') {
      this._butterfly.attach(document.getElementById('ar-hud'));
      // Show precomputed results instantly — no model download needed
      if (engine.precomputedZones && this._mongLabels) {
        this.overlay.renderMultiLayerDetections(engine.precomputedZones, this._mongLabels.layers);
        this._setStatus('TAP TO RE-ANALYZE WITH CLIP', 4000);
      } else {
        this._runMongAnalysis();
      }
    }
    // HUMAN MODE — camera only, no overlays needed
  }

  // ─── 夢 Analysis ──────────────────────────────────────────────────────────

  async _runMongAnalysis() {
    const video = this.camera.getVideo();
    if (!video) return;

    if (!this._clipEngine?.isReady) {
      this._setStatus('夢 — LOADING MODEL…');
      return;
    }

    this._setStatus('夢 — ANALYZING…');
    this.overlay.clearDetections(false);

    try {
      const result = await this._clipEngine.analyze(video, this._mongLabels);
      if (this._activeEngine?.type === 'multi-layer') {
        this.overlay.renderMultiLayerDetections(result.regions, this._mongLabels.layers);
      }
      this._setStatus('TAP TO RE-ANALYZE', 3000);
    } catch (err) {
      console.error('[夢] Analysis failed:', err);
      this._setStatus('ANALYSIS FAILED — TAP TO RETRY');
    }
  }

  async _preloadClip() {
    try {
      const res = await fetch('./config/mong-labels.json');
      this._mongLabels = await res.json();

      this._clipEngine = new ClipEngine();
      await this._clipEngine.load((p) => {
        console.log(`[夢] ${p.stage} ${Math.round(p.progress * 100)}%`);
        if (this._activeEngine?.type === 'multi-layer') {
          this._setStatus(`夢 — ${p.stage}`);
        }
      });

      console.log('[夢] CLIP ready');
      // If 夢 ENGINE already active, run analysis now that models are loaded
      if (this._activeEngine?.type === 'multi-layer') this._runMongAnalysis();
    } catch (err) {
      console.warn('[夢] CLIP pre-load failed:', err);
    }
  }

  // ─── Status display ───────────────────────────────────────────────────────

  _setStatus(text, clearAfterMs = 0) {
    const el = document.getElementById('mong-status');
    if (!el) return;
    el.textContent  = text;
    el.style.opacity = text ? '1' : '0';
    if (clearAfterMs) setTimeout(() => { el.textContent = ''; el.style.opacity = '0'; }, clearAfterMs);
  }

  // ─── Config ───────────────────────────────────────────────────────────────

  async _loadConfig() {
    try {
      const res = await fetch('./config/perception-engines.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('[夢] Config load failed:', err);
      return this._fallbackConfig();
    }
  }

  _fallbackConfig() {
    return {
      meta: { title: '夢 ENGINE' },
      engines: [
        {
          id: 'mong-engine', name: '夢 — Am I the Butterfly?',
          tagline: '호접지몽 · Four cultural lenses',
          dataset: 'CLIP (LAION-400M)', datasetSize: 'Browser inference',
          lensColor: '#d4a017', lensColorAlt: '#e8c040',
          scanlineStyle: 'diagonal', transitionGlyph: '夢',
          type: 'multi-layer', detections: [],
        },
        {
          id: 'human-mode', name: 'HUMAN MODE',
          tagline: 'No AI interpretation',
          dataset: '—', datasetSize: '—',
          lensColor: '#ffffff', lensColorAlt: '#cccccc',
          scanlineStyle: 'none', transitionGlyph: '○',
          detections: [],
        },
      ],
    };
  }
}

document.addEventListener('DOMContentLoaded', () => new MongEngineApp().init());
