#!/usr/bin/env node

/**
 * PRISM Debug Utility
 * Helps diagnose and troubleshoot the PRISM daemon
 */

const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const SimpleProjectDetector = require('./simple-project-detector');

class DebugUtils {
  constructor() {
    this.results = {
      environment: {},
      fileSystem: {},
      network: {},
      project: {},
      errors: []
    };
  }

  /**
   * Run all diagnostic checks
   */
  async runDiagnostics() {
    console.log('🔍 Running PRISM diagnostics...\n');

    await this.checkEnvironment();
    await this.checkFileSystem();
    await this.checkNetwork();
    await this.checkProject();

    this.printResults();
    return this.results;
  }

  /**
   * Check environment variables and Node.js version
   */
  async checkEnvironment() {
    console.log('📋 Environment Check:');

    try {
      // Check Node.js version
      const nodeVersion = process.version;
      console.log(`  ✅ Node.js: ${nodeVersion}`);
      this.results.environment.nodeVersion = nodeVersion;

      // Check environment variables
      const envVars = ['PORT', 'PROJECT_ROOT', 'CACHE_DIR', 'INDEX_DIR'];
      for (const env of envVars) {
        const value = process.env[env];
        if (value) {
          console.log(`  ✅ ${env}: ${value}`);
        } else {
          console.log(`  ⚠️  ${env}: not set`);
        }
        this.results.environment[env] = value || 'not set';
      }

    } catch (error) {
      this.results.errors.push(`Environment check failed: ${error.message}`);
      console.log(`  ❌ Error: ${error.message}`);
    }

    console.log();
  }

  /**
   * Check file system access
   */
  async checkFileSystem() {
    console.log('📁 File System Check:');

    const checks = [
      { path: process.cwd(), name: 'Current directory' },
      { path: './daemon', name: 'Daemon directory' },
      { path: './daemon/server.js', name: 'Server file' },
      { path: './daemon/simple-project-detector.js', name: 'Detector file' }
    ];

    for (const check of checks) {
      try {
        await fs.access(check.path);
        console.log(`  ✅ ${check.name}: ${check.path}`);
        this.results.fileSystem[check.name] = check.path;
      } catch (error) {
        console.log(`  ❌ ${check.name}: ${check.path} - ${error.message}`);
        this.results.errors.push(`File access error: ${check.path}`);
      }
    }

    // Check for cache and index directories
    const dirs = ['cache', 'index'];
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
        console.log(`  ✅ Created directory: ${dir}`);
      } catch (error) {
        console.log(`  ⚠️  Directory check: ${dir} - ${error.message}`);
      }
    }

    console.log();
  }

  /**
   * Check if ports are available
   */
  async checkNetwork() {
    console.log('🌐 Network Check:');

    const port = process.env.PORT || 8080;

    // Check if port is available by trying to bind to it
    const isPortAvailable = await this.isPortAvailable(port);

    if (isPortAvailable) {
      console.log(`  ✅ Port ${port} is available`);
      this.results.network.port = port;
      this.results.network.available = true;
    } else {
      console.log(`  ⚠️  Port ${port} is already in use`);
      this.results.network.port = port;
      this.results.network.available = false;
    }

    console.log();
  }

  /**
   * Check project detection
   */
  async checkProject() {
    console.log('📂 Project Detection Check:');

    try {
      const detector = new SimpleProjectDetector(process.cwd());
      const projectInfo = await detector.detect();

      console.log(`  ✅ Project name: ${projectInfo.name}`);
      console.log(`  ✅ Language: ${projectInfo.language}`);
      console.log(`  ✅ Type: ${projectInfo.type}`);
      if (projectInfo.framework) {
        console.log(`  ✅ Framework: ${projectInfo.framework}`);
      }

      this.results.project = projectInfo;

    } catch (error) {
      console.log(`  ❌ Project detection failed: ${error.message}`);
      this.results.errors.push(`Project detection error: ${error.message}`);
    }

    console.log();
  }

  /**
   * Check if a port is available
   */
  isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = http.createServer();
      server.listen(port, () => {
        server.once('close', () => resolve(true));
        server.close();
      });
      server.on('error', () => resolve(false));
    });
  }

  /**
   * Print diagnostic results summary
   */
  printResults() {
    console.log('📊 Diagnostic Results Summary:\n');

    const errorCount = this.results.errors.length;
    if (errorCount === 0) {
      console.log('✅ All checks passed! PRISM should work correctly.');
    } else {
      console.log(`❌ Found ${errorCount} issue(s):`);
      this.results.errors.forEach(error => {
        console.log(`  • ${error}`);
      });
    }

    console.log('\n💡 Troubleshooting Tips:');
    if (errorCount > 0) {
      console.log('1. Check the error messages above');
      console.log('2. Ensure all required files exist');
      console.log('3. Verify environment variables are set correctly');
      console.log('4. Make sure the port is not already in use');
    } else {
      console.log('Try running: node daemon/server.js');
      console.log('Then visit: http://localhost:8080/health');
    }
  }
}

// Run diagnostics if this file is executed directly
if (require.main === module) {
  const debug = new DebugUtils();
  debug.runDiagnostics().catch(console.error);
}

module.exports = DebugUtils;