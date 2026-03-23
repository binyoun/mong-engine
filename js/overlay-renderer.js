/**
 * overlay-renderer.js
 * Renders detection overlays for standard and multi-layer engines.
 * Bounding box coordinates are viewport % — no AR tracking needed.
 */

export class OverlayRenderer {
  constructor(detectionLayerEl) {
    this.layer       = detectionLayerEl;
    this.activeBoxes = [];
    this._activeEngine = null;
  }

  /**
   * Render standard engine detections (static engines with predefined boxes).
   */
  renderDetections(engine, targetInfo) {
    this.clearDetections();
    this._activeEngine = engine;

    if (!engine.detections || engine.detections.length === 0) return;

    const lensColor = engine.lensColor;

    engine.detections.forEach((det, index) => {
      setTimeout(() => {
        const box = this._createDetectionBox(det, lensColor, targetInfo);
        this.layer.appendChild(box);
        this.activeBoxes.push({ el: box, detection: det });
        requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add('visible')));
      }, 200 + index * 280);
    });
  }

  /**
   * Render 4-layer CLIP detections from 夢 ENGINE.
   * Bounding boxes are viewport % — applied directly.
   */
  renderMultiLayerDetections(regions, layerDefs) {
    this.clearDetections();

    const layerKeys = Object.keys(layerDefs);
    const labelPos  = {
      western:    { vAnchor: 'above', hAnchor: 'left'  },
      korean:     { vAnchor: 'below', hAnchor: 'right' },
      vietnamese: { vAnchor: 'below', hAnchor: 'left'  },
      chinese:    { vAnchor: 'above', hAnchor: 'right' },
    };

    regions.forEach((region, ri) => {
      layerKeys.forEach((layerKey, li) => {
        const layerDef  = layerDefs[layerKey];
        const layerData = region.layers[layerKey];
        const delay     = ri * 400 + li * 120;

        setTimeout(() => {
          const box = this._createMultiLayerBox(
            region, layerKey, layerDef, layerData,
            labelPos[layerKey] || labelPos.western
          );
          this.layer.appendChild(box);
          this.activeBoxes.push({ el: box, detection: { boundingBox: region.boundingBox } });
          requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add('visible')));
        }, delay);
      });
    });
  }

  clearDetections(animate = true) {
    if (animate) {
      this.activeBoxes.forEach(({ el }, i) => {
        setTimeout(() => {
          el.classList.remove('visible');
          setTimeout(() => el.remove(), 400);
        }, i * 60);
      });
    } else {
      this.activeBoxes.forEach(({ el }) => el.remove());
    }
    this.activeBoxes = [];
    this._activeEngine = null;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _createMultiLayerBox(region, layerKey, layerDef, layerData, labelPos) {
    const color = layerDef.color;
    const bb    = region.boundingBox;

    const box = document.createElement('div');
    box.className = `detection-box multi-layer layer-${layerKey}`;
    box.dataset.detectionId = `${region.id}-${layerKey}`;
    box.style.borderColor = color;
    box.style.setProperty('--lens-color', color);
    box.style.left   = `${bb.x}%`;
    box.style.top    = `${bb.y}%`;
    box.style.width  = `${bb.w}%`;
    box.style.height = `${bb.h}%`;

    // Corner bracket color via injected style
    const styleTag = document.createElement('style');
    styleTag.textContent = `
      [data-detection-id="${region.id}-${layerKey}"]::before,
      [data-detection-id="${region.id}-${layerKey}"]::after { border-color: ${color}; }
    `;
    box.appendChild(styleTag);

    // Layer prefix badge
    const badge = document.createElement('span');
    badge.className = 'layer-badge';
    badge.textContent = layerDef.prefix;
    badge.style.color = color;
    badge.style.borderColor = color;
    box.appendChild(badge);

    // Label
    const rawLabel  = layerData ? layerData.label : '—';
    const shortLabel = rawLabel.length > 42 ? rawLabel.slice(0, 42) + '…' : rawLabel;
    const confPct   = layerData ? Math.round(layerData.confidence * 100) : 0;

    const label = document.createElement('div');
    label.className = `detection-label label-v-${labelPos.vAnchor} label-h-${labelPos.hAnchor}`;

    const labelText = document.createElement('span');
    labelText.className = 'detection-label-text';
    labelText.textContent = shortLabel;
    labelText.style.color = color;

    const conf = document.createElement('span');
    conf.className = 'detection-confidence';
    conf.textContent = `${confPct}%`;

    label.appendChild(labelText);
    label.appendChild(conf);
    box.appendChild(label);

    return box;
  }

  _createDetectionBox(detection, lensColor, targetInfo) {
    const box = document.createElement('div');
    box.className = 'detection-box';
    box.dataset.detectionId = detection.id;
    box.style.setProperty('--lens-color', lensColor);
    box.style.borderColor = lensColor;

    const pos = this._calcPosition(detection.boundingBox, targetInfo.dimensions);
    box.style.left   = `${pos.left}%`;
    box.style.top    = `${pos.top}%`;
    box.style.width  = `${pos.width}%`;
    box.style.height = `${pos.height}%`;

    const styleTag = document.createElement('style');
    styleTag.textContent = `
      [data-detection-id="${detection.id}"]::before,
      [data-detection-id="${detection.id}"]::after { border-color: ${lensColor}; }
    `;
    box.appendChild(styleTag);

    const label = document.createElement('div');
    label.className = 'detection-label';

    const labelText = document.createElement('span');
    labelText.className = 'detection-label-text';
    labelText.textContent = detection.label;
    labelText.style.color = lensColor;

    const confidence = document.createElement('span');
    confidence.className = 'detection-confidence';
    confidence.textContent = `${Math.round(detection.confidence * 100)}%`;

    label.appendChild(labelText);
    label.appendChild(confidence);
    box.appendChild(label);

    if (detection.metadata) {
      const meta = document.createElement('div');
      meta.className = 'detection-metadata';
      meta.textContent = detection.metadata;
      box.appendChild(meta);
    }

    if (detection.error) {
      const error = document.createElement('div');
      error.className = 'detection-error';
      error.textContent = detection.error;
      box.appendChild(error);
    }

    const confBar = document.createElement('div');
    confBar.className = 'detection-conf-bar';
    confBar.style.width = '0%';
    confBar.style.background = lensColor;
    box.appendChild(confBar);
    setTimeout(() => { confBar.style.width = `${detection.confidence * 100}%`; }, 400);

    return box;
  }

  _calcPosition(boundingBox, targetDimensions) {
    const td = targetDimensions;
    const originX = td.x !== undefined ? td.x : (100 - td.width)  / 2;
    const originY = td.y !== undefined ? td.y : (100 - td.height) / 2;
    return {
      left:   originX + (boundingBox.x / 100) * td.width,
      top:    originY + (boundingBox.y / 100) * td.height,
      width:  (boundingBox.w / 100) * td.width,
      height: (boundingBox.h / 100) * td.height,
    };
  }
}
