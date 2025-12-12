# Project Roadmap: Cymascope

This document outlines the planned features and development goals for the Cymascope project.

## Phase 1: Core Refinements (Current)

- [x] Initial commit from Blogger script.
- [x] Separate HTML, CSS, and JavaScript into individual files.
- [x] Refactor JavaScript to use a main application object/module instead of global variables.
- [x] Establish project structure with `README.md`, `CHANGELOG.md`, and `CONTRIBUTING.md`.
- [x] Improve UI/UX with better layout and responsive design for controls.
- [ ] Add more robust error handling and user feedback (e.g., for microphone permissions).

## Phase 2: Feature Enhancements

- [ ] **More Visualization Modes**:
  - Add different geometries (e.g., square, triangular membranes).
  - Implement different visualization algorithms beyond mode summation.
  - **Simulate Resonance Effects**:
    - Implement a system to define "special" resonant frequencies (e.g., 432 Hz).
    - When a detected audio frequency matches a resonant frequency, enhance the clarity, stability, and intensity of the corresponding visual pattern.
- [ ] **Advanced Audio Controls**:
  - Allow users to select audio input device.
  - Add a file input to visualize pre-recorded audio files.
  - Implement frequency range selection to focus on specific parts of the spectrum (e.g., bass, mids, treble).
- [ ] **UI/UX Polish**:
  - **Tuner Overlay**:
    - [x] Add an option to display a real-time tuner overlay on the visualization.
    - [x] Allow selection of tuning systems (e.g., A4=440Hz, A4=432Hz).
    - [x] The overlay should display the dominant incoming frequency and the closest musical note.
    - [ ] The resonance simulation should be linked to the notes of the selected tuning system.
  - Add ability to save and load presets (color map, sensitivity, etc.).
  - Create a more modern UI for the controls panel.
  - Add an "About" or "Help" section explaining the controls and the science.

## Phase 3: Performance and Optimization

- [ ] **Performance Tuning**: Profile and optimize WebGL and JavaScript performance for lower-end devices.
- [ ] **Code Quality**:
  - Introduce a build step (e.g., Vite, Webpack) for module bundling and minification.
  - Add linting (ESLint) and formatting (Prettier) to maintain code consistency.
- [ ] **WebAssembly**: Explore using WebAssembly (Rust or C++) for performance-critical calculations like the Bessel functions or FFT analysis.