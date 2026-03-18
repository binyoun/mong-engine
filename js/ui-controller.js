/**
 * ui-controller.js
 * Manages the full UI flow: landing screen, engine selection,
 * AR HUD, model switching, and lens transitions.
 */

export class UIController {
  constructor({ engines, onEngineSelect }) {
    this.engines = engines;
    this.onEngineSelect = onEngineSelect;
    this.activeEngineId = null;

    // Cache DOM elements
    this.landingScreen = document.getElementById('landing-screen');
    this.arHud = document.getElementById('ar-hud');
    this.hudTopBar = document.getElementById('hud-top-bar');
    this.hudBottomBar = document.getElementById('hud-bottom-bar');
    this.lensTransition = document.getElementById('lens-transition');
    this.engineList = document.getElementById('engine-list');
    this.engineSwitcher = document.getElementById('engine-switcher');
  }

  /**
   * Build the landing screen engine selection list
   */
  buildLandingScreen() {
    this.engineList.innerHTML = '';

    this.engines.forEach(engine => {
      const btn = document.createElement('button');
      btn.className = 'engine-option';
      btn.style.setProperty('--engine-color', engine.lensColor);
      btn.dataset.engineId = engine.id;

      btn.innerHTML = `
        <div class="engine-indicator" style="background: ${engine.lensColor}"></div>
        <div class="engine-info">
          <div class="engine-name">${engine.name}</div>
          <div class="engine-tagline">${engine.tagline}</div>
        </div>
      `;

      btn.addEventListener('click', () => this._handleEngineSelect(engine.id));
      this.engineList.appendChild(btn);
    });
  }

  /**
   * Build the bottom HUD engine switcher (quick-switch buttons)
   */
  buildEngineSwitcher() {
    this.engineSwitcher.innerHTML = '';

    this.engines.forEach(engine => {
      const btn = document.createElement('button');
      btn.className = 'engine-switcher-btn';
      btn.dataset.engineId = engine.id;
      btn.style.setProperty('--lens-color', engine.lensColor);

      // Use abbreviated names for switcher
      const shortName = engine.id === 'human-mode' ? 'HUMAN'
        : engine.name.split(' ')[0].replace(/[-.]/g, '');
      btn.textContent = shortName;

      btn.addEventListener('click', () => this._handleEngineSelect(engine.id));
      this.engineSwitcher.appendChild(btn);
    });
  }

  /**
   * Handle engine selection from either landing or switcher
   */
  _handleEngineSelect(engineId) {
    const engine = this.engines.find(e => e.id === engineId);
    if (!engine) return;

    const isFirstSelection = this.activeEngineId === null;
    const isSameEngine = this.activeEngineId === engineId;
    if (isSameEngine) return;

    this.activeEngineId = engineId;

    // Update CSS custom properties for lens color
    document.documentElement.style.setProperty('--lens-color', engine.lensColor);
    document.documentElement.style.setProperty('--lens-color-alt', engine.lensColorAlt);
    document.documentElement.style.setProperty('--lens-glow', 
      engine.lensColor + '20');

    if (isFirstSelection) {
      // First selection: hide landing, show AR HUD
      this._transitionToAR(engine);
    } else {
      // Subsequent: lens transition effect
      this._playLensTransition(engine, () => {
        this._updateHUD(engine);
        this.onEngineSelect(engine);
      });
    }

    // Update switcher active states
    this._updateSwitcherActive(engineId);
  }

  /**
   * Transition from landing screen to AR view
   */
  _transitionToAR(engine) {
    this.landingScreen.classList.add('hidden');

    setTimeout(() => {
      this.arHud.classList.add('active');
      this._updateHUD(engine);
      this._playLensTransition(engine, () => {
        this.onEngineSelect(engine);
      });
    }, 400);
  }

  /**
   * Play the lens transition effect (like changing optical glass)
   */
  _playLensTransition(engine, onComplete) {
    const glass = this.lensTransition.querySelector('.lens-glass');
    const scanline = this.lensTransition.querySelector('.lens-scanline');
    const glyph = this.lensTransition.querySelector('.transition-glyph');

    // Update lens glass gradient
    glass.style.background = `radial-gradient(
      ellipse at center,
      transparent 30%,
      ${engine.lensColor}12 60%,
      rgba(0, 0, 0, 0.5) 100%
    )`;

    // Set scanline style
    scanline.className = 'lens-scanline';
    if (engine.scanlineStyle && engine.scanlineStyle !== 'none') {
      // Force reflow to restart animation
      void scanline.offsetWidth;
      scanline.classList.add(engine.scanlineStyle);
    }

    // Set transition glyph
    glyph.textContent = engine.transitionGlyph || '';
    glyph.style.color = engine.lensColor;
    glyph.style.textShadow = `0 0 40px ${engine.lensColor}`;
    // Force animation restart
    glyph.style.animation = 'none';
    void glyph.offsetWidth;
    glyph.style.animation = '';

    // Activate overlay
    this.lensTransition.classList.add('active');

    // Deactivate after transition
    setTimeout(() => {
      this.lensTransition.classList.remove('active');
      if (onComplete) onComplete();
    }, 1000);
  }

  /**
   * Update HUD labels with current engine info
   */
  _updateHUD(engine) {
    const engineLabel = this.hudTopBar.querySelector('.hud-engine-label');
    const datasetLabel = this.hudTopBar.querySelector('.hud-dataset-label');

    engineLabel.textContent = engine.name;
    engineLabel.style.color = engine.lensColor;

    if (engine.dataset && engine.dataset !== '—') {
      datasetLabel.textContent = `DATASET: ${engine.dataset} (${engine.datasetSize})`;
    } else {
      datasetLabel.textContent = '';
    }
  }

  /**
   * Update active state on engine switcher buttons
   */
  _updateSwitcherActive(activeId) {
    const btns = this.engineSwitcher.querySelectorAll('.engine-switcher-btn');
    btns.forEach(btn => {
      const isActive = btn.dataset.engineId === activeId;
      btn.classList.toggle('active', isActive);
      if (isActive) {
        const engine = this.engines.find(e => e.id === activeId);
        btn.style.borderColor = engine.lensColor;
        btn.style.color = engine.lensColor;
      } else {
        btn.style.borderColor = '';
        btn.style.color = '';
      }
    });
  }

  /**
   * Return to landing screen
   */
  returnToLanding() {
    this.arHud.classList.remove('active');
    this.activeEngineId = null;

    setTimeout(() => {
      this.landingScreen.classList.remove('hidden');
    }, 300);
  }
}
