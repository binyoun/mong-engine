/**
 * app.js
 * SELECT PERCEPTION ENGINE — Main Application
 * 
 * Initializes camera, loads engine config, and coordinates
 * the perception engine selection flow.
 */

import { CameraManager } from './camera-manager.js';
import { OverlayRenderer } from './overlay-renderer.js';
import { UIController } from './ui-controller.js';
import { ClipEngine } from './clip-engine.js';
import { ButterflyAR } from './butterfly-ar.js';

class PerceptionEngineApp {
  constructor() {
    this.config      = null;
    this.camera      = null;
    this.overlay     = null;
    this.ui          = null;
    this.targetInfo  = null;
    this._activeEngine = null;
    this._clipEngine    = null;
    this._mongLabels    = null;
    this._butterfly     = new ButterflyAR();
    this._cameraStarted = false;
  }

  /**
   * Boot the application
   */
  async init() {
    console.log('[SPE] SELECT PERCEPTION ENGINE — Initializing...');

    // 1. Load perception engine config
    this.config = await this._loadConfig();
    if (!this.config) {
      console.error('[SPE] Failed to load config. Halting.');
      return;
    }
    console.log(`[SPE] Loaded ${this.config.engines.length} perception engines`);

    // 2. Initialize overlay renderer
    this.overlay = new OverlayRenderer(document.getElementById('detection-layer'));

    // 3. Initialize UI — does NOT depend on camera, build immediately
    this.ui = new UIController({
      engines: this.config.engines,
      onEngineSelect: (engine) => this._onEngineActivated(engine)
    });

    this.ui.buildLandingScreen();
    this.ui.buildEngineSwitcher();

    // 4. Set up camera object but don't start yet —
    //    camera.start() is called on first engine selection (requires user gesture on mobile)
    this.camera = new CameraManager(document.getElementById('camera-viewport'));

    // 5. Set up back button
    document.querySelector('.hud-back-btn').addEventListener('click', () => {
      this.overlay.clearDetections();
      this.ui.returnToLanding();
    });

    // 6. Wire tracking callbacks (safe to register before start())
    const scanPrompt = document.getElementById('scanning-prompt');

    this.camera.onTargetFound((target) => {
      console.log(`[SPE] Target found: ${target.targetId}`);
      this.targetInfo = target;
      if (scanPrompt) scanPrompt.style.display = 'none';
      if (this._activeEngine) {
        if (this._activeEngine.type === 'multi-layer') {
          this._runMongAnalysis();
        } else {
          this.overlay.renderDetections(this._activeEngine, target);
        }
      }
    });

    this.camera.onTargetLost(() => {
      console.log('[SPE] Target lost');
      this.targetInfo = null;
      this.overlay.clearDetections(false);
      if (scanPrompt && this._activeEngine) scanPrompt.style.display = 'block';
    });

    // Per-frame position update — keeps boxes locked to the painting as camera moves
    this.camera.onTargetUpdate((target) => {
      this.targetInfo = target;
      this.overlay.repositionBoxes(target);
    });

    // Pre-load 夢 ENGINE models in background (only if config includes it)
    const hasMong = this.config.engines.some(e => e.type === 'multi-layer');
    if (hasMong) {
      this._preloadMong();
    }

    console.log('[SPE] Ready. Point camera at the painting.');
  }

  /**
   * Pre-load ClipEngine and mong-labels.json silently in the background.
   */
  async _preloadMong() {
    try {
      const res = await fetch('./config/mong-labels.json');
      this._mongLabels = await res.json();

      this._clipEngine = new ClipEngine();
      this._clipEngine.load((prog) => {
        console.log(`[MONG] ${prog.stage} — ${Math.round(prog.progress * 100)}%`);
        this._updateMongStatus(prog);
      });
    } catch (err) {
      console.warn('[MONG] Pre-load failed:', err);
    }
  }

  /**
   * Show/hide the 夢 loading status label.
   */
  _updateMongStatus(prog) {
    let el = document.getElementById('mong-status');
    if (!el) return;
    if (prog.progress >= 1) {
      el.textContent = '夢 ENGINE READY';
      setTimeout(() => { el.style.opacity = '0'; }, 2000);
    } else {
      el.style.opacity = '1';
      el.textContent = `夢 — ${prog.stage} ${Math.round(prog.progress * 100)}%`;
    }
  }

  /**
   * Called when a perception engine is activated
   */
  _onEngineActivated(engine) {
    console.log(`[SPE] Engine activated: ${engine.name}`);
    this._activeEngine = engine;
    this.overlay.clearDetections(false);

    // Start camera on first engine selection (user gesture satisfies mobile permission)
    if (!this._cameraStarted) {
      this._cameraStarted = true;
      this.camera.init()
        .then(() => {
          console.log('[SPE] Camera active');
          if (this._activeEngine?.type === 'multi-layer' && this.camera.anchor) {
            this._butterfly.attach(this.camera.anchor.group);
          }
        })
        .catch(err => console.error('[SPE] Camera failed:', err));
    }

    if (engine.type === 'multi-layer') {
      // Attach AR butterfly to painting anchor
      if (this.camera.anchor) this._butterfly.attach(this.camera.anchor.group);

      if (this.targetInfo) {
        setTimeout(() => this._runMongAnalysis(), 300);
      } else {
        const scanPrompt = document.getElementById('scanning-prompt');
        if (scanPrompt) scanPrompt.style.display = 'block';
      }
      return;
    }

    // Leaving 夢 ENGINE — detach butterfly
    this._butterfly.detach();

    // Standard engine path
    if (this.targetInfo) {
      setTimeout(() => {
        this.overlay.renderDetections(engine, this.targetInfo);
      }, 300);
    } else {
      const scanPrompt = document.getElementById('scanning-prompt');
      if (scanPrompt) scanPrompt.style.display = 'block';
    }
  }

  /**
   * Run 夢 ENGINE analysis on the currently tracked painting.
   */
  async _runMongAnalysis() {
    if (!this._clipEngine || !this._mongLabels || !this.targetInfo) return;

    if (!this._clipEngine.isReady) {
      // Show that models are still loading
      const statusEl = document.getElementById('mong-status');
      if (statusEl) {
        statusEl.style.opacity = '1';
        statusEl.textContent = '夢 — loading models…';
      }
      return;
    }

    console.log('[MONG] Starting analysis…');
    const statusEl = document.getElementById('mong-status');
    if (statusEl) {
      statusEl.style.opacity = '1';
      statusEl.textContent = '夢 — analyzing…';
    }

    try {
      const result = await this._clipEngine.analyze(this.targetInfo, this._mongLabels);
      // Only render if this engine is still active
      if (this._activeEngine && this._activeEngine.type === 'multi-layer' && this.targetInfo) {
        this.overlay.renderMultiLayerDetections(
          result.regions,
          this._mongLabels.layers,
          this.targetInfo
        );
      }
      if (statusEl) statusEl.style.opacity = '0';
    } catch (err) {
      console.error('[MONG] Analysis failed:', err);
      if (statusEl) {
        statusEl.textContent = '夢 — analysis failed';
        setTimeout(() => { statusEl.style.opacity = '0'; }, 3000);
      }
    }
  }

  /**
   * Load the perception engine configuration
   */
  async _loadConfig() {
    try {
      const response = await fetch('./config/perception-engines.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      console.error('[SPE] Config load failed:', err);
      // Fallback: return embedded minimal config
      return this._getFallbackConfig();
    }
  }

  /**
   * Minimal fallback config if JSON fails to load
   * (useful for local file:// testing)
   */
  _getFallbackConfig() {
    return {
      meta: { title: 'SELECT PERCEPTION ENGINE' },
      engines: [
        {
          id: 'foundation-xl',
          name: 'FOUNDATION-XL',
          tagline: 'General AI perception model',
          dataset: 'WebCrawl-En',
          datasetSize: '2.1B pairs',
          lensColor: '#7b8cff',
          lensColorAlt: '#a0adff',
          scanlineStyle: 'diagonal',
          transitionGlyph: '▣',
          description: 'Large-scale general model',
          detections: [
            {
              id: 'fb-001', label: 'butterfly', category: 'OBJECT',
              confidence: 0.96,
              boundingBox: { x: 36, y: 21, w: 28, h: 33 },
              metadata: 'Standard detection', error: null
            },
            {
              id: 'fb-002', label: 'flower', category: 'OBJECT',
              confidence: 0.98,
              boundingBox: { x: 12, y: 46, w: 38, h: 38 },
              metadata: 'Standard detection', error: null
            }
          ]
        },
        {
          id: 'human-mode',
          name: 'HUMAN MODE',
          tagline: 'No AI interpretation',
          dataset: '—', datasetSize: '—',
          lensColor: '#ffffff', lensColorAlt: '#cccccc',
          scanlineStyle: 'none', transitionGlyph: '○',
          description: 'Unmediated view',
          detections: []
        }
      ],
      exhibition: { debugMode: false }
    };
  }
}

// ---- BOOT ----
document.addEventListener('DOMContentLoaded', () => {
  const app = new PerceptionEngineApp();
  app.init();
});
