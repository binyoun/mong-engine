/**
 * overlay-renderer.js
 * Renders detection overlays (bounding boxes, labels, metadata)
 * for the active perception engine.
 * 
 * FUTURE: To use real AI outputs, modify renderDetections() to accept
 * async data from API calls. The rendering logic stays the same.
 */

export class OverlayRenderer {
  constructor(detectionLayerEl) {
    this.layer = detectionLayerEl;
    this.activeBoxes = [];
    this._animationFrame = null;
  }

  /**
   * Render detections for a given engine
   * @param {Object} engine - Engine config object from perception-engines.json
   * @param {Object} targetInfo - Target tracking info (position, dimensions)
   */
  renderDetections(engine, targetInfo) {
    this.clearDetections();

    if (!engine.detections || engine.detections.length === 0) {
      // HUMAN MODE: no overlays
      return;
    }

    const lensColor = engine.lensColor;

    engine.detections.forEach((det, index) => {
      // Stagger appearance for poetic reveal
      setTimeout(() => {
        const box = this._createDetectionBox(det, lensColor, targetInfo);
        this.layer.appendChild(box);
        this.activeBoxes.push(box);

        // Trigger visibility after DOM insertion
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            box.classList.add('visible');
          });
        });
      }, 200 + (index * 280));
    });
  }

  /**
   * Create a single detection box element
   */
  _createDetectionBox(detection, lensColor, targetInfo) {
    const box = document.createElement('div');
    box.className = 'detection-box';
    box.dataset.detectionId = detection.id;
    box.style.setProperty('--lens-color', lensColor);
    box.style.borderColor = lensColor;

    // Position from bounding box percentages
    // Offset relative to target dimensions
    const offsetX = (100 - targetInfo.dimensions.width) / 2;
    const offsetY = (100 - targetInfo.dimensions.height) / 2;

    const left = offsetX + (detection.boundingBox.x / 100) * targetInfo.dimensions.width;
    const top = offsetY + (detection.boundingBox.y / 100) * targetInfo.dimensions.height;
    const width = (detection.boundingBox.w / 100) * targetInfo.dimensions.width;
    const height = (detection.boundingBox.h / 100) * targetInfo.dimensions.height;

    box.style.left = `${left}%`;
    box.style.top = `${top}%`;
    box.style.width = `${width}%`;
    box.style.height = `${height}%`;

    // Corner bracket colors
    box.style.setProperty('--lens-color', lensColor);

    // Set pseudo-element colors via CSS custom property
    const styleTag = document.createElement('style');
    styleTag.textContent = `
      [data-detection-id="${detection.id}"]::before,
      [data-detection-id="${detection.id}"]::after {
        border-color: ${lensColor};
      }
    `;
    box.appendChild(styleTag);

    // Label
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

    // Metadata
    if (detection.metadata) {
      const meta = document.createElement('div');
      meta.className = 'detection-metadata';
      meta.textContent = detection.metadata;
      box.appendChild(meta);
    }

    // Error / warning
    if (detection.error) {
      const error = document.createElement('div');
      error.className = 'detection-error';
      error.textContent = detection.error;
      box.appendChild(error);
    }

    // Confidence bar
    const confBar = document.createElement('div');
    confBar.className = 'detection-conf-bar';
    confBar.style.width = '0%';
    confBar.style.background = lensColor;
    box.appendChild(confBar);

    // Animate confidence bar after appearance
    setTimeout(() => {
      confBar.style.width = `${detection.confidence * 100}%`;
    }, 400);

    return box;
  }

  /**
   * Clear all current detection overlays
   * @param {boolean} animate - Whether to animate removal
   */
  clearDetections(animate = true) {
    if (animate) {
      this.activeBoxes.forEach((box, i) => {
        setTimeout(() => {
          box.classList.remove('visible');
          setTimeout(() => box.remove(), 400);
        }, i * 60);
      });
    } else {
      this.activeBoxes.forEach(box => box.remove());
    }
    this.activeBoxes = [];
  }

  /**
   * FUTURE API INTEGRATION POINT
   * Replace simulated detections with real API calls.
   * 
   * Example usage:
   * 
   * async fetchAndRender(engine, targetInfo, imageData) {
   *   if (engine.apiEndpoint) {
   *     const response = await fetch(engine.apiEndpoint, {
   *       method: 'POST',
   *       body: JSON.stringify({ image: imageData }),
   *       headers: { 'Content-Type': 'application/json' }
   *     });
   *     const result = await response.json();
   *     engine.detections = this._normalizeAPIResponse(result, engine.id);
   *   }
   *   this.renderDetections(engine, targetInfo);
   * }
   * 
   * _normalizeAPIResponse(apiResult, engineId) {
   *   // Transform API-specific response into standard detection schema
   *   return apiResult.predictions.map((pred, i) => ({
   *     id: `det-${engineId}-${i}`,
   *     label: pred.label,
   *     category: pred.category || 'UNKNOWN',
   *     confidence: pred.score,
   *     boundingBox: {
   *       x: pred.bbox[0], y: pred.bbox[1],
   *       w: pred.bbox[2], h: pred.bbox[3]
   *     },
   *     metadata: pred.metadata || null,
   *     error: pred.confidence < 0.3 ? 'LOW CONFIDENCE WARNING' : null
   *   }));
   * }
   */
}
