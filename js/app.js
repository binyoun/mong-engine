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

class PerceptionEngineApp {
  constructor() {
    this.config = null;
    this.camera = null;
    this.overlay = null;
    this.ui = null;
    this.targetInfo = null;
    this._activeEngine = null;
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

    // 2. Initialize camera
    this.camera = new CameraManager(document.getElementById('camera-viewport'));
    const cameraReady = await this.camera.init();
    console.log(`[SPE] Camera: ${cameraReady ? 'active' : 'fallback mode'}`);

    // 3. Initialize overlay renderer
    this.overlay = new OverlayRenderer(document.getElementById('detection-layer'));

    // 4. Initialize UI
    this.ui = new UIController({
      engines: this.config.engines,
      onEngineSelect: (engine) => this._onEngineActivated(engine)
    });

    this.ui.buildLandingScreen();
    this.ui.buildEngineSwitcher();

    // 5. Set up back button
    document.querySelector('.hud-back-btn').addEventListener('click', () => {
      this.overlay.clearDetections();
      this.ui.returnToLanding();
    });

    // 6. Real MindAR image target tracking
    const scanPrompt = document.getElementById('scanning-prompt');

    this.camera.onTargetFound((target) => {
      console.log(`[SPE] Target found: ${target.targetId}`);
      this.targetInfo = target;
      if (scanPrompt) scanPrompt.style.display = 'none';
      // If an engine is already active when the painting comes into view, render it
      if (this._activeEngine) {
        this.overlay.renderDetections(this._activeEngine, target);
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

    console.log('[SPE] Ready. Point camera at the painting.');
  }

  /**
   * Called when a perception engine is activated
   */
  _onEngineActivated(engine) {
    console.log(`[SPE] Engine activated: ${engine.name}`);
    this._activeEngine = engine;
    this.overlay.clearDetections(false);

    // Only render if the painting is currently tracked
    if (this.targetInfo) {
      setTimeout(() => {
        this.overlay.renderDetections(engine, this.targetInfo);
      }, 300);
    }
    // If painting not visible yet, show scanning prompt — boxes appear when onTargetFound fires
    if (!this.targetInfo) {
      const scanPrompt = document.getElementById('scanning-prompt');
      if (scanPrompt) scanPrompt.style.display = 'block';
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
