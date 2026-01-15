/**
 * Simple Project Detector
 * Quickly identifies project type and basic information
 */

const fs = require('fs').promises;
const path = require('path');

class SimpleProjectDetector {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
  }

  /**
   * Detect basic project information
   */
  async detect() {
    const info = {
      name: path.basename(this.projectRoot),
      language: 'unknown',
      type: 'generic'
    };

    // Check for common project files
    const checks = [
      { file: 'package.json', detector: this.detectNodejs },
      { file: 'pyproject.toml', detector: this.detectPython },
      { file: 'go.mod', detector: this.detectGo },
      { file: 'Cargo.toml', detector: this.detectRust },
      { file: 'pom.xml', detector: this.detectJava },
      { file: 'project.json', detector: this.detectCSharp },
      { file: 'composer.json', detector: this.detectPHP },
      { file: 'Gemfile', detector: this.detectRuby }
    ];

    for (const check of checks) {
      try {
        await fs.access(path.join(this.projectRoot, check.file));
        const result = await check.detector.bind(this)();
        if (result) {
          Object.assign(info, result);
          break;
        }
      } catch (error) {
        // Continue to next check
      }
    }

    return info;
  }

  /**
   * Detect Node.js/JavaScript projects
   */
  async detectNodejs() {
    try {
      const packageJson = await fs.readFile(path.join(this.projectRoot, 'package.json'), 'utf8');
      const pkg = JSON.parse(packageJson);

      let language = 'javascript';
      if (pkg.dependencies?.typescript) {
        language = 'typescript';
      }

      return {
        language,
        type: 'node',
        framework: this.detectFramework(pkg.dependencies)
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Detect Python projects
   */
  async detectPython() {
    try {
      const pyproject = await fs.readFile(path.join(this.projectRoot, 'pyproject.toml'), 'utf8');
      return {
        language: 'python',
        type: 'python',
        framework: this.detectPythonFramework(pyproject)
      };
    } catch (error) {
      try {
        await fs.access(path.join(this.projectRoot, 'setup.py'));
        return { language: 'python', type: 'python' };
      } catch {
        return null;
      }
    }
  }

  /**
   * Detect Go projects
   */
  async detectGo() {
    return { language: 'go', type: 'go' };
  }

  /**
   * Detect Rust projects
   */
  async detectRust() {
    try {
      const cargo = await fs.readFile(path.join(this.projectRoot, 'Cargo.toml'), 'utf8');
      return {
        language: 'rust',
        type: 'rust',
        framework: this.detectRustFramework(cargo)
      };
    } catch {
      return null;
    }
  }

  /**
   * Detect Java projects
   */
  async detectJava() {
    return { language: 'java', type: 'java' };
  }

  /**
   * Detect C# projects
   */
  async detectCSharp() {
    return { language: 'csharp', type: 'csharp' };
  }

  /**
   * Detect PHP projects
   */
  async detectPHP() {
    try {
      const composer = await fs.readFile(path.join(this.projectRoot, 'composer.json'), 'utf8');
      return {
        language: 'php',
        type: 'php',
        framework: this.detectPHPFramework(composer)
      };
    } catch {
      return null;
    }
  }

  /**
   * Detect Ruby projects
   */
  async detectRuby() {
    try {
      const gemfile = await fs.readFile(path.join(this.projectRoot, 'Gemfile'), 'utf8');
      return {
        language: 'ruby',
        type: 'ruby',
        framework: this.detectRubyFramework(gemfile)
      };
    } catch {
      return null;
    }
  }

  /**
   * Detect JavaScript framework
   */
  detectFramework(deps) {
    if (!deps) return 'none';

    if (deps.react) return 'react';
    if (deps.vue) return 'vue';
    if (deps.angular) return 'angular';
    if (deps.next) return 'next';
    if (deps.nuxt) return 'nuxt';

    return 'node';
  }

  /**
   * Detect Python framework
   */
  detectPythonFramework(content) {
    if (content.includes('Django')) return 'django';
    if (content.includes('Flask')) return 'flask';
    if (content.includes('FastAPI')) return 'fastapi';
    return 'python';
  }

  /**
   * Detect Rust framework
   */
  detectRustFramework(content) {
    if (content.includes('actix-web')) return 'actix-web';
    if (content.includes('rocket')) return 'rocket';
    if (content.includes('axum')) return 'axum';
    return 'rust';
  }

  /**
   * Detect PHP framework
   */
  detectPHPFramework(content) {
    if (content.includes('laravel')) return 'laravel';
    if (content.includes('symfony')) return 'symfony';
    if (content.includes('wordpress')) return 'wordpress';
    return 'php';
  }

  /**
   * Detect Ruby framework
   */
  detectRubyFramework(content) {
    if (content.includes('rails')) return 'rails';
    if (content.includes('sinatra')) return 'sinatra';
    return 'ruby';
  }
}

module.exports = SimpleProjectDetector;