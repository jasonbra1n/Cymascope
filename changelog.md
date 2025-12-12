# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog,
and this project adheres to Semantic Versioning.

## [0.1.1] - 2025-12-12

### Fixed
- **Fullscreen Mode**: Resolved a persistent bug where the controls overlay would fail to reappear after exiting fullscreen mode on certain browsers. The fix involved refactoring the main layout to use CSS Grid and improving fullscreen event handling.

## [0.1.0] - 2025-12-12

### Added
- **Tuner Overlay**: Added a real-time tuner overlay that displays the dominant frequency and closest musical note.
- **Tuning Systems**: Added a control to switch the tuner's base frequency between A=440Hz and A=432Hz.
- **Frequency Scaling**: Added a "Frequency Scale" slider to give users control over how audio frequencies map to visual patterns.
- **Theme Switching**: Implemented a standalone light/dark theme toggle that saves the user's preference.
- **Theme Sync**: Added logic to sync themes when embedded in a parent application like the LAB Digital Workshop.

### Changed
- **UI Layout**: Migrated the controls panel into a semi-transparent overlay at the bottom of the screen, creating a single-view layout without scrolling.
- **UI Style**: The controls and tuner overlays are now theme-aware, switching between light and dark styles.
- **Header**: Redesigned the header to be more compact and navbar-like.

### Fixed
- **Test Tone**: Restored the audible sine wave tone when activating "TEST VISUALIZATION" mode.
- **Fullscreen Controls**: Fixed a bug where the controls overlay would not reappear after exiting fullscreen mode on certain browsers (e.g., Brave, Safari) due to inconsistent browser API implementations.

### Added
- Initial project structure created from original Blogger script.
- Created `README.md`, `roadmap.md`, `changelog.md`, and `CONTRIBUTING.md`.
- Refactored JavaScript into a modular pattern and separated CSS and JS from `index.html`.