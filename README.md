# SELECT PERCEPTION ENGINE

**Speculative AI Perception Instrument**  
*Bin Youn, 2026*

Every model sees a different world.  
Every model makes different mistakes.

---

## Concept

SELECT PERCEPTION ENGINE is an experimental WebAR artwork that reveals how AI models function as cultural lenses. A traditional Korean butterfly and flower painting (화접도, Hwajeopdo) is interpreted through six fictional perception engines, each trained on radically different datasets. The same image becomes a cosmological symbol, a biological specimen, a generic "asian art" object, an ecological network, or a museum artifact, depending on which model does the seeing.

The work engages: AI bias, machine vision, dataset epistemology, cultural interpretation, and Zhuangzi's Butterfly Dream (the dissolution of boundary between perceiver and perceived).

---

## Project Structure

```
select-perception-engine/
├── index.html                          # Main entry point
├── css/
│   └── style.css                       # Full UI styling
├── js/
│   ├── app.js                          # Main application (boot + coordination)
│   ├── camera-manager.js               # Camera access + target tracking
│   ├── overlay-renderer.js             # Detection box rendering
│   └── ui-controller.js                # Screens, transitions, HUD
├── config/
│   └── perception-engines.json         # DATA-DRIVEN engine definitions
├── assets/                             # Place target images, icons here
└── README.md
```

---

## Quick Start

1. Serve the project with any local server:
   ```bash
   # Python
   python3 -m http.server 8080

   # Node
   npx serve .

   # PHP
   php -S localhost:8080
   ```

2. Open `https://localhost:8080` on a mobile device (HTTPS required for camera access).

3. Select a perception engine. Detection overlays will appear.

---

## How the Data-Driven System Works

All perception engines are defined in `config/perception-engines.json`. To add, remove, or modify engines, edit only this file. The UI, overlays, and transitions are generated automatically from the config.

### Engine Schema

```json
{
  "id": "unique-id",
  "name": "DISPLAY NAME",
  "tagline": "Short description",
  "dataset": "Training dataset name",
  "datasetSize": "Dataset scale",
  "lensColor": "#hex",
  "lensColorAlt": "#hex-lighter",
  "scanlineStyle": "horizontal|vertical|grid|diagonal|radial|none",
  "transitionGlyph": "蝶",
  "description": "Longer description for exhibition text",
  "detections": [
    {
      "id": "det-xx-001",
      "label": "What the model sees",
      "category": "CATEGORY_TAG",
      "confidence": 0.72,
      "boundingBox": { "x": 35, "y": 20, "w": 30, "h": 35 },
      "metadata": "Additional classification data",
      "error": "Model error or bias note (null if none)"
    }
  ]
}
```

### Adding a Custom Engine

1. Open `config/perception-engines.json`
2. Add a new object to the `engines` array following the schema above
3. Choose a unique `id`, `lensColor`, `scanlineStyle`, and `transitionGlyph`
4. Define detection objects with bounding boxes (x/y/w/h as percentages of the target image)
5. Reload the page. The engine appears in the landing screen and switcher automatically.

---

## Replacing Simulated Data with Real AI

The current prototype uses pre-written detection data in the JSON config. The architecture is designed for easy API integration:

### Step 1: Add API endpoints to engine config

```json
{
  "id": "foundation-xl",
  "apiEndpoint": "https://your-api.com/v1/detect",
  "apiKey": "ENV_VARIABLE",
  ...
}
```

### Step 2: Modify overlay-renderer.js

The file contains a commented `fetchAndRender()` method template. Uncomment and adapt:

```javascript
async fetchAndRender(engine, targetInfo, imageData) {
  if (engine.apiEndpoint) {
    const response = await fetch(engine.apiEndpoint, {
      method: 'POST',
      body: JSON.stringify({ image: imageData }),
      headers: { 'Content-Type': 'application/json' }
    });
    const result = await response.json();
    engine.detections = this._normalizeAPIResponse(result, engine.id);
  }
  this.renderDetections(engine, targetInfo);
}
```

### Step 3: Capture frame from camera

In `camera-manager.js`, add a method to capture the current video frame as base64:

```javascript
captureFrame() {
  const canvas = document.createElement('canvas');
  canvas.width = this.videoEl.videoWidth;
  canvas.height = this.videoEl.videoHeight;
  canvas.getContext('2d').drawImage(this.videoEl, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.8);
}
```

### Suggested APIs by Engine Type

| Engine Style | Suggested API |
|---|---|
| FOUNDATION-XL | Google Cloud Vision, OpenAI Vision |
| TAXON-VISION | iNaturalist API, PlantNet |
| HOJEOP-K | Custom CLIP with East Asian art dataset |
| GAIA-ECO | Custom ecological classifier |
| ARCHIVE-INDEX | Google Arts & Culture API |

---

## Real Image Target Tracking

The prototype simulates target detection. For real AR tracking:

### Option A: 8th Wall (commercial)
```html
<script src="https://apps.8thwall.com/xrweb?appKey=YOUR_KEY"></script>
```
Replace `simulateTargetTracking()` with 8th Wall's image target events.

### Option B: MindAR (open source, recommended for exhibitions)
```html
<script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js"></script>
```
Compile your Hwajeopdo painting as a `.mind` target file using MindAR's compiler.

### Option C: WebXR Raw API
Use the WebXR Image Tracking API (Chrome 113+) for native browser-level tracking without libraries.

---

## XR Exhibition Optimization

### Hardware
- Dedicated tablets (iPad or Android) on stands, pre-loaded with the URL
- Alternatively: QR code printed alongside the physical painting for visitor phones
- Ensure stable WiFi or serve locally via portable router

### Display Setup
- Print the Hwajeopdo painting at minimum 40cm x 50cm for reliable tracking
- Matte paper (avoid glare that disrupts tracking)
- Even, indirect lighting on the painting surface
- Position tablets at 45cm to 80cm viewing distance from the painting

### Performance
- Test on target devices and optimize detection count per engine if needed
- Consider reducing bounding box animations on lower-end devices
- Use `exhibition.debugMode: true` in config for FPS overlay during setup

### Visitor Flow
- Print a brief wall text explaining the concept
- Consider an "auto-rotate" mode (set `exhibition.autoRotateEngines: true` in config) for unattended display
- Auto-rotate cycles through engines at the interval specified in config

### Accessibility
- All interactive elements use ARIA roles
- Ensure sufficient color contrast against camera feed (the dark gradients help)
- Consider a companion text panel for visitors who cannot use the AR interface

---

## Technical Notes

- **No build step required.** The project uses ES modules natively.
- **HTTPS required** for camera access on mobile browsers.
- **Tested browsers:** Chrome (Android/iOS), Safari (iOS 16.4+), Firefox (Android).
- **Safe area insets** are handled via CSS `env()` for notched devices.

---

## License

This work is part of Bin Youn's artistic research practice. Contact the artist for exhibition, reproduction, or adaptation permissions.
