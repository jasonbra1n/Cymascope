/**
 * CymascopeApp
 * Encapsulates the entire Cymascope visualization logic.
 */
const CymascopeApp = {
  // --- STATE ---
  gl: null,
  program: null,
  audioContext: null,
  analyser: null,
  mediaStreamSource: null,
  isAudioInitialized: false,
  testMode: false,
  testOscillator: null,
  modeTextures: [],
  smoothedWeights: null,
  effectiveModes: null,
  effectiveModeCount: 0,
  colorMapTextureUnit: 0,
  isDarkTheme: false,

  // --- CONSTANTS ---
  CANVAS_ID: 'cymascope-canvas',
  CHLADNI_MODES: [
    { n: 0, m: 1, k: 2.4048 }, { n: 0, m: 2, k: 5.5201 },
    { n: 0, m: 3, k: 8.6537 }, { n: 0, m: 4, k: 11.7915 },
    { n: 1, m: 1, k: 3.8317 }, { n: 1, m: 2, k: 7.0156 },
    { n: 1, m: 3, k: 10.1735 }, { n: 1, m: 4, k: 13.3237 },
    { n: 2, m: 1, k: 5.1356 }, { n: 2, m: 2, k: 8.4172 },
    { n: 2, m: 3, k: 11.6198 }, { n: 2, m: 4, k: 14.7960 },
    { n: 3, m: 1, k: 6.3802 }, { n: 3, m: 2, k: 9.7610 },
    { n: 3, m: 3, k: 13.0152 }, { n: 3, m: 4, k: 16.2235 }
  ],
  WEIGHT_SMOOTHING_ALPHA: 0.15,
  FREQUENCY_SCALE_FACTOR: 100, // Initial value for the frequency scaling
  TUNING_SYSTEM_BASE_FREQ: 440, // A4 = 440Hz by default
  NOTE_NAMES: ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"],

  // --- DOM Elements ---
  tunerOverlay: null,

  // --- SHADER SOURCES ---
  vertexShaderSource: `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_uv = (a_position + 1.0) * 0.5;
    }
  `,

  getFragmentShaderSource(modeCount) {
    return `#define MODE_COUNT ${modeCount}
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D modes[MODE_COUNT];
    uniform float weights[MODE_COUNT];
    uniform sampler2D colorMap;
    uniform float sensitivity;
    
    void main() {
        float sum = 0.0;
        for(int i = 0; i < MODE_COUNT; i++) {
            vec4 tex = texture2D(modes[i], v_uv);
            sum += weights[i] * (tex.r * 2.0 - 1.0);
        }
        float intensity = clamp(abs(sum) * sensitivity, 0.0, 1.0);
        vec3 color = texture2D(colorMap, vec2(intensity, 0.5)).rgb;
        gl_FragColor = vec4(color, 1.0);
    }
    `;
  },

  // --- INITIALIZATION ---
  init() {
    this.tunerOverlay = document.getElementById('tuner-overlay');
    this.initTheme();
    this.initWebGL();
    this.bindUIEvents();
    window.addEventListener('resize', () => this.resizeCanvas());
    this.bindFullscreenEvents();
    requestAnimationFrame(() => this.render());
  },

  initWebGL() {
    const canvas = document.getElementById(this.CANVAS_ID);
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    this.gl = canvas.getContext('webgl', { antialias: false });
    if (!this.gl) {
      alert('WebGL is not supported by your browser. Please use a modern browser like Chrome or Firefox.');
      return;
    }
    this.gl.viewport(0, 0, canvas.width, canvas.height);

    const maxUnits = this.gl.getParameter(this.gl.MAX_TEXTURE_IMAGE_UNITS);
    this.effectiveModeCount = Math.min(this.CHLADNI_MODES.length, maxUnits - 1);
    if (this.effectiveModeCount < this.CHLADNI_MODES.length) {
      console.warn(`Not enough texture units (${maxUnits}). Using ${this.effectiveModeCount} modes instead of ${this.CHLADNI_MODES.length}.`);
    }
    this.effectiveModes = this.CHLADNI_MODES.slice(0, this.effectiveModeCount);
    this.smoothedWeights = new Float32Array(this.effectiveModeCount).fill(0);
    this.colorMapTextureUnit = this.effectiveModeCount;

    const fragSrc = this.getFragmentShaderSource(this.effectiveModeCount);
    this.program = this.createProgram(this.vertexShaderSource, fragSrc);
    if (!this.program) return;
    this.gl.useProgram(this.program);

    this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]), this.gl.STATIC_DRAW);
    const positionLoc = this.gl.getAttribLocation(this.program, 'a_position');
    this.gl.enableVertexAttribArray(positionLoc);
    this.gl.vertexAttribPointer(positionLoc, 2, this.gl.FLOAT, false, 0, 0);

    this.modeTextures = this.effectiveModes.map((mode, i) => {
      const texture = this.createModeTexture(mode.n, mode.k);
      this.gl.activeTexture(this.gl.TEXTURE0 + i);
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
      this.gl.uniform1i(this.gl.getUniformLocation(this.program, `modes[${i}]`), i);
      return texture;
    });

    this.updateColorMap('rainbow');
    this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'sensitivity'), 1.0);
  },

  async initAudio() {
    if (this.isAudioInitialized) return;
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;
      this.mediaStreamSource.connect(this.analyser);
      this.isAudioInitialized = true;
    } catch (err) {
      console.error('Error initializing audio:', err);
      alert('Microphone access was denied. Please allow microphone access to use the audio visualizer.');
    }
  },

  // --- WEBGL HELPERS ---
  createShader(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error((type === this.gl.VERTEX_SHADER ? "Vertex" : "Fragment") + " shader error:", this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }
    return shader;
  },

  createProgram(vertexSrc, fragmentSrc) {
    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexSrc);
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentSrc);
    if (!vertexShader || !fragmentShader) return null;
    const program = this.gl.createProgram();
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error("Program linking error:", this.gl.getProgramInfoLog(program));
      return null;
    }
    return program;
  },

  // --- TEXTURE GENERATION ---
  createColorMapTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 256, 0);
    if (type === 'rainbow') {
      gradient.addColorStop(0, '#FF0000'); gradient.addColorStop(0.17, '#FFFF00');
      gradient.addColorStop(0.34, '#00FF00'); gradient.addColorStop(0.51, '#00FFFF');
      gradient.addColorStop(0.68, '#0000FF'); gradient.addColorStop(0.85, '#FF00FF');
      gradient.addColorStop(1, '#FF0000');
    } else if (type === 'grayscale') {
      gradient.addColorStop(0, 'black'); gradient.addColorStop(1, 'white');
    } else { // heatmap
      gradient.addColorStop(0, 'black'); gradient.addColorStop(0.5, 'red');
      gradient.addColorStop(1, 'yellow');
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 1);
    const texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, canvas);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    return texture;
  },

  createModeTexture(n, k, size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;
    const center = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x - center) / center;
        const dy = (y - center) / center;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r > 1) continue;
        const theta = Math.atan2(dy, dx);
        const u = this.besselJ(n, k * r) * Math.cos(n * theta);
        const value = (u + 1) / 2 * 255;
        const idx = (y * size + x) * 4;
        data[idx] = data[idx + 1] = data[idx + 2] = value;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    const texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, canvas);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    return texture;
  },

  // --- MATH HELPERS ---
  factorial: (n) => n <= 1 ? 1 : n * CymascopeApp.factorial(n - 1),
  besselJ(n, x) {
    let sum = 0;
    let term = Math.pow(x / 2, n) / this.factorial(n);
    sum += term;
    for (let k = 1; Math.abs(term) > 1e-9; k++) {
      term *= -(x * x) / (4 * k * (n + k));
      sum += term;
    }
    return sum;
  },

  // --- RENDER LOOP ---
  render() {
    if (!this.gl) return;
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    let frequencyData;
    if (this.isAudioInitialized && this.analyser) {
      frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(frequencyData);
    } else if (this.testMode) {
      frequencyData = new Uint8Array(1024);
      const time = Date.now() / 1000;
      for (let i = 0; i < frequencyData.length; i++) {
        frequencyData[i] = Math.sin(i * 0.2 + time * 3) * 127 + 128;
      }
    }

    if (frequencyData) {
      const sampleRate = this.audioContext?.sampleRate || 44100;
      const maxFrequency = sampleRate / 2;
      const weights = new Float32Array(this.effectiveModeCount).fill(0);
      let dominantFrequency = 0;
      let maxAmp = 0;

      // Find dominant frequency
      for (let i = 0; i < frequencyData.length; i++) {
        const amp = frequencyData[i];
        if (amp > maxAmp) {
          maxAmp = amp;
          dominantFrequency = i * (maxFrequency / frequencyData.length);
        }
      }

      // Update tuner if visible
      this.updateTuner(dominantFrequency, maxAmp);

      frequencyData.forEach((amp, i) => {
        if (amp === 0) return;
        const frequency = i * (maxFrequency / frequencyData.length);
        // Map frequency to the closest mode
        const modeIndex = this.effectiveModes.reduce((closestIdx, mode, idx) => {
          const currentDist = Math.abs(mode.k - (frequency / this.FREQUENCY_SCALE_FACTOR));
          const closestDist = Math.abs(this.effectiveModes[closestIdx].k - (frequency / this.FREQUENCY_SCALE_FACTOR));
          return currentDist < closestDist ? idx : closestIdx;
        }, 0);
        weights[modeIndex] += amp / 255;
      });

      weights.forEach((w, i) => {
        this.smoothedWeights[i] = this.WEIGHT_SMOOTHING_ALPHA * w + (1 - this.WEIGHT_SMOOTHING_ALPHA) * this.smoothedWeights[i];
      });

      this.gl.uniform1fv(this.gl.getUniformLocation(this.program, 'weights'), this.smoothedWeights);
    }

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    requestAnimationFrame(() => this.render());
  },

  // --- UI & EVENT HANDLERS ---
  bindUIEvents() {
    document.getElementById('fullscreen-button').addEventListener('click', () => this.toggleFullscreen());
    document.getElementById('color-map-select').addEventListener('change', (e) => this.updateColorMap(e.target.value));
    document.getElementById('start-stop-button').addEventListener('click', () => this.toggleAudio());
    document.getElementById('sensitivity-slider').addEventListener('input', (e) => this.updateSensitivity(e.target.value));
    document.getElementById('freq-scale-slider').addEventListener('input', (e) => this.updateFrequencyScale(e.target.value));
    document.getElementById('tuning-system-select').addEventListener('change', (e) => this.updateTuningSystem(e.target.value));
    document.getElementById('tuner-toggle-checkbox').addEventListener('change', (e) => this.toggleTuner(e.target.checked));
    document.getElementById('test-button').addEventListener('click', () => this.toggleTestMode());
    document.getElementById('theme-toggle-button').addEventListener('click', () => this.toggleTheme());
  },

  bindFullscreenEvents() {
    const canvasContainer = document.getElementById('canvas-container');
    // Attach listeners to the element that will be fullscreen, not the document.
    canvasContainer.addEventListener('fullscreenchange', () => this.onFullscreenChange());
    canvasContainer.addEventListener('webkitfullscreenchange', () => this.onFullscreenChange());
    canvasContainer.addEventListener('mozfullscreenchange', () => this.onFullscreenChange());
    canvasContainer.addEventListener('MSFullscreenChange', () => this.onFullscreenChange());
  },

  resizeCanvas() {
    const canvas = document.getElementById(this.CANVAS_ID);
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    if (this.gl) {
      this.gl.viewport(0, 0, canvas.width, canvas.height);
    }
  },

  onFullscreenChange() {
    const controls = document.getElementById('controls');
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
    controls.classList.toggle('controls-hidden', !!isFullscreen);
    // After exiting fullscreen, the container might not have the right size yet.
    // A small delay ensures the layout has settled before we resize the canvas.
    // This also triggers a redraw, which helps fix rendering glitches.
    setTimeout(() => this.resizeCanvas(), 50);
  },

  initTheme() {
    const savedTheme = localStorage.getItem('cymascope-theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    // Saved theme takes precedence. If none, use system preference.
    this.isDarkTheme = savedTheme === 'dark' || (savedTheme === null && prefersDark);
    document.documentElement.classList.toggle('dark-theme', this.isDarkTheme);
  },

  toggleTheme(isDark = !this.isDarkTheme) {
    this.isDarkTheme = isDark;
    document.documentElement.classList.toggle('dark-theme', this.isDarkTheme);
    localStorage.setItem('cymascope-theme', this.isDarkTheme ? 'dark' : 'light');
  },

  updateColorMap(type) {
    const colorMap = this.createColorMapTexture(type);
    this.gl.activeTexture(this.gl.TEXTURE0 + this.colorMapTextureUnit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, colorMap);
    this.gl.uniform1i(this.gl.getUniformLocation(this.program, 'colorMap'), this.colorMapTextureUnit);
  },

  updateSensitivity(value) {
    if (this.program) {
      this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'sensitivity'), parseFloat(value));
    }
  },

  updateFrequencyScale(value) {
    this.FREQUENCY_SCALE_FACTOR = parseFloat(value);
  },

  updateTuningSystem(value) {
    this.TUNING_SYSTEM_BASE_FREQ = parseFloat(value);
  },

  toggleTuner(isVisible) {
    this.tunerOverlay.classList.toggle('hidden', !isVisible);
  },

  updateTuner(freq, amp) {
    if (!this.tunerOverlay.classList.contains('hidden') && amp > 20) { // Threshold to avoid noise
      const noteData = this.frequencyToNote(freq);
      document.getElementById('tuner-note').textContent = noteData.name + noteData.octave;
      document.getElementById('tuner-freq').textContent = `${freq.toFixed(1)} Hz`;
    }
  },

  frequencyToNote(frequency) {
    const noteNum = 12 * (Math.log(frequency / this.TUNING_SYSTEM_BASE_FREQ) / Math.log(2));
    const roundedNoteNum = Math.round(noteNum) + 9; // +9 to shift from C to A
    const octave = Math.floor(roundedNoteNum / 12) + 4; // A4 is our reference
    const noteIndex = roundedNoteNum % 12;
    return { name: this.NOTE_NAMES[noteIndex], octave: octave };
  },

  async toggleAudio() {
    const button = document.getElementById('start-stop-button');
    if (!this.isAudioInitialized) {
      await this.initAudio();
      if (this.isAudioInitialized) { // Check if init was successful
        button.textContent = 'Stop Audio';
      }
    } else {
      this.audioContext.close().then(() => {
        this.audioContext = null;
        this.analyser = null;
        this.mediaStreamSource = null;
        this.isAudioInitialized = false;
        button.textContent = 'Start Audio';
        this.smoothedWeights.fill(0);
      });
    }
  },

  toggleFullscreen() {
    const canvasContainer = document.getElementById('canvas-container');
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
    if (!isFullscreen) {
      canvasContainer.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen();
    }
  },

  toggleTestMode() {
    this.testMode = !this.testMode;
    const button = document.getElementById('test-button');
    button.classList.toggle('test-active', this.testMode);
    button.textContent = this.testMode ? 'STOP TEST' : 'TEST VISUALIZATION';

    if (this.testMode) {
      // If audio context doesn't exist, create one for the oscillator
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      // Create and start the test oscillator
      if (!this.testOscillator) {
        this.testOscillator = this.audioContext.createOscillator();
        this.testOscillator.type = 'sine';
        this.testOscillator.frequency.setValueAtTime(440, this.audioContext.currentTime); // A4 note
        const gainNode = this.audioContext.createGain();
        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime); // Keep volume low
        this.testOscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        this.testOscillator.start();
      }
    } else {
      // Stop and disconnect the oscillator
      if (this.testOscillator) {
        this.testOscillator.stop();
        this.testOscillator.disconnect();
        this.testOscillator = null;
      }
    }
  }
};

// --- Start the application ---
document.addEventListener('DOMContentLoaded', () => {
  CymascopeApp.init();
});

/**
 * Listen for theme changes from the parent LAB Digital Workshop application.
 */
window.addEventListener('message', (event) => {
    // Optional: Add a security check for the origin
    // if (event.origin !== 'https://lab.jasonbrain.com') return;

    if (event.data && event.data.type === 'themeChange') {
        this.toggleTheme(event.data.theme === 'dark-theme');
    }
});

// On load, request the current theme from the parent to sync up.
window.parent.postMessage({ type: 'requestTheme' }, '*');