# Contributing to Cymascope

First off, thank you for considering contributing to Cymascope! Whether you're a human developer or an AI assistant, your help is appreciated.

## How to Contribute

### Reporting Bugs

- Ensure the bug was not already reported by searching on GitHub under Issues.
- If you're unable to find an open issue addressing the problem, open a new one. Be sure to include a **title and clear description**, as much relevant information as possible, and a **code sample** or an **executable test case** demonstrating the expected behavior that is not occurring.

### Suggesting Enhancements

- Check the roadmap.md to see if your idea is already planned.
- Open a new issue to discuss your enhancement. Please provide a clear description of the enhancement and its potential benefits.

### Pull Requests

1. Fork the repository.
2. Create a new branch (`git checkout -b feature/AmazingFeature`).
3. Make your changes.
4. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
5. Push to the branch (`git push origin feature/AmazingFeature`).
6. Open a Pull Request.

## Styleguides

- **JavaScript**: Follow a modular pattern. Avoid polluting the global namespace. Use `const` for variables that are not reassigned.
- **Code Comments**: Add comments to explain complex logic, especially in shaders and mathematical functions.
- **Commit Messages**: Write clear and concise commit messages (e.g., "feat: Add grayscale color map", "fix: Correct audio context handling").

## For AI Assistants

- When asked to review or modify code, please adhere to the styleguides mentioned above.
- When adding new features, please consider the existing architecture and patterns.
- If you suggest creating new files, provide their full content.
- Please provide changes in a diff format against the latest version of the files in the context.