#!/usr/bin/env node

/**
 * PRISM Auto-Setup Script
 * Provides zero-friction installation and configuration
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

class AutoSetup {
  constructor() {
    this.pluginRoot = process.cwd();
    this.projectRoot = process.env.PROJECT_ROOT || process.cwd();
    this.osType = os.platform();
    this.arch = os.arch();
    this.isWindows = this.osType === 'win32';
    this.isMac = this.osType === 'darwin';
    this.isLinux = this.osType === 'linux';
  }

  /**
   * Main setup process
   */
  async setup() {
    console.log('🚀 PRISM Auto-Setup Starting...');
    console.log(`Platform: ${this.osType} ${this.arch}`);
    console.log(`Plugin Root: ${this.pluginRoot}`);
    console.log(`Project Root: ${this.projectRoot}`);

    try {
      // 1. Check requirements
      await this.checkRequirements();

      // 2. Create necessary directories
      await this.setupDirectories();

      // 3. Detect project type
      const projectInfo = await this.detectProject();

      // 4. Configure MCP server
      await this.configureMCP(projectInfo);

      // 5. Update plugin manifest
      await this.updateManifest(projectInfo);

      // 6. Run platform-specific setup
      await this.platformSpecificSetup(projectInfo);

      // 7. Create verification script
      await this.createVerificationScript();

      console.log('✅ PRISM Setup Complete!');
      console.log('🎯 Auto-detection Summary:');
      console.log(`   - Language: ${projectInfo.language}`);
      console.log(`   - Framework: ${projectInfo.framework || 'None'}`);
      console.log(`   - Package Manager: ${projectInfo.packageManager || 'None'}`);
      console.log(`   - Build Tools: ${projectInfo.buildTools.join(', ') || 'None'}`);

      console.log('\n🔧 Next Steps:');
      console.log('   1. Restart Claude Code to load the plugin');
      console.log('   2. Run "prism verify" to check installation');
      console.log('   3. Use "prism index" to start indexing your project');

    } catch (error) {
      console.error('❌ Setup Failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Check system requirements
   */
  async checkRequirements() {
    console.log('📋 Checking requirements...');

    // Check Node.js
    try {
      const nodeVersion = execSync('node --version', { encoding: 'utf8' });
      console.log(`✅ Node.js: ${nodeVersion.trim()}`);

      const majorVersion = parseInt(nodeVersion.trim().replace('v', '').split('.')[0]);
      if (majorVersion < 14) {
        throw new Error('Node.js version 14 or higher is required');
      }
    } catch (error) {
      throw new Error('Node.js is required. Please install Node.js 14+');
    }

    // Check if we have write permissions
    try {
      await fs.access(this.pluginRoot, fs.constants.W_OK);
    } catch (error) {
      throw new Error(`No write permissions for: ${this.pluginRoot}`);
    }

    console.log('✅ All requirements met');
  }

  /**
   * Create necessary directories
   */
  async setupDirectories() {
    console.log('📁 Creating directories...');

    const dirs = [
      'cache',
      'index',
      'logs',
      'temp'
    ];

    for (const dir of dirs) {
      const dirPath = path.join(this.pluginRoot, dir);
      try {
        await fs.mkdir(dirPath, { recursive: true });
        console.log(`   Created: ${dir}`);
      } catch (error) {
        console.warn(`⚠️  Warning: Could not create ${dir}: ${error.message}`);
      }
    }

    // Create .gitignore for cache directories
    const gitignorePath = path.join(this.pluginRoot, '.gitignore');
    const gitignoreContent = `
# PRISM cache and temporary files
cache/
index/
logs/
temp/
*.log
*.tmp
.DS_Store
Thumbs.db
`;

    try {
      await fs.writeFile(gitignorePath, gitignoreContent.trim() + '\n');
      console.log('   Created: .gitignore');
    } catch (error) {
      console.warn(`⚠️  Warning: Could not create .gitignore: ${error.message}`);
    }
  }

  /**
   * Detect project type
   */
  async detectProject() {
    console.log('🔍 Detecting project type...');

    const ProjectDetector = require('../daemon/project-detector');
    const detector = new ProjectDetector(this.projectRoot);
    const projectInfo = await detector.detectAll();

    // Add additional metadata
    projectInfo.osType = this.osType;
    projectInfo.arch = this.arch;
    projectInfo.packageManager = await this.detectPackageManager();
    projectInfo.installDate = new Date().toISOString();

    console.log(`   Detected: ${projectInfo.language}/${projectInfo.framework || 'none'}`);

    return projectInfo;
  }

  /**
   * Detect package manager
   */
  async detectPackageManager() {
    const files = await fs.readdir(this.projectRoot);

    if (files.includes('package-lock.json')) return 'npm';
    if (files.includes('yarn.lock')) return 'yarn';
    if (files.includes('pnpm-lock.yaml')) return 'pnpm';
    if (files.includes('bun.lockb')) return 'bun';
    if (files.includes('Pipfile')) return 'pipenv';
    if (files.includes('poetry.lock')) return 'poetry';

    return null;
  }

  /**
   * Configure MCP server
   */
  async configureMCP(projectInfo) {
    console.log('⚙️  Configuring MCP server...');

    const mcpPath = path.join(this.pluginRoot, '.mcp.json');
    const mcpConfig = {
      mcpServers: {
        'prism-daemon': {
          command: 'node',
          args: ['${CLAUDE_PLUGIN_ROOT}/daemon/server.js'],
          env: {
            PLUGIN_ROOT: '${CLAUDE_PLUGIN_ROOT}',
            PROJECT_ROOT: '${PROJECT_ROOT:-${CLAUDE_PLUGIN_ROOT}}',
            CACHE_DIR: '${CLAUDE_PLUGIN_ROOT}/cache',
            INDEX_DIR: '${CLAUDE_PLUGIN_ROOT}/index',
            LOG_LEVEL: '${LOG_LEVEL:-info}',
            PORT: '0',
            AUTO_DETECT: 'true',
            AUTO_INDEX: 'true',
            PROJECT_LANGUAGE: projectInfo.language,
            PROJECT_FRAMEWORK: projectInfo.framework || '',
            PROJECT_TYPE: projectInfo.type
          },
          healthCheck: {
            enabled: true,
            path: '/health',
            interval: 30000,
            timeout: 5000
          },
          autoRestart: {
            enabled: true,
            maxRetries: 3,
            delay: 1000
          }
        }
      }
    };

    try {
      await fs.writeFile(mcpPath, JSON.stringify(mcpConfig, null, 2));
      console.log('   Updated: .mcp.json');
    } catch (error) {
      console.warn(`⚠️  Warning: Could not update .mcp.json: ${error.message}`);
    }
  }

  /**
   * Update plugin manifest
   */
  async updateManifest(projectInfo) {
    console.log('📦 Updating plugin manifest...');

    const manifestPath = path.join(this.pluginRoot, '.claude-plugin', 'plugin.json');
    const manifest = {
      name: 'prism-project-memory',
      version: '1.0.0',
      description: 'Enhanced project memory for Claude Code with semantic search and context awareness',
      author: {
        name: 'PRISM Team',
        email: 'team@claude-prism.dev'
      },
      commands: ['./commands/'],
      agents: ['./agents/'],
      mcpServers: './.mcp.json',
      autoStart: true,
      permissions: {
        files: 'read',
        network: 'true',
        environment: 'true'
      },
      features: {
        autoDetect: true,
        zeroConfig: true,
        crossPlatform: true,
        projectInfo: {
          language: projectInfo.language,
          framework: projectInfo.framework || 'none',
          type: projectInfo.type,
          detectedAt: projectInfo.installDate
        }
      }
    };

    try {
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      console.log('   Updated: plugin.json');
    } catch (error) {
      console.warn(`⚠️  Warning: Could not update plugin.json: ${error.message}`);
    }
  }

  /**
   * Platform-specific setup
   */
  async platformSpecificSetup(projectInfo) {
    console.log('🖥️  Platform-specific setup...');

    // Create platform-specific startup scripts
    const scripts = {
      win32: this.createWindowsScript,
      darwin: this.createMacScript,
      linux: this.createLinuxScript
    };

    const createScript = scripts[this.osType];
    if (createScript) {
      await createScript.call(this, projectInfo);
    }

    // Create cross-platform verification script
    await this.createPlatformScript(projectInfo);
  }

  /**
   * Create Windows script
   */
  async createWindowsScript(projectInfo) {
    const scriptPath = path.join(this.pluginRoot, 'start-prism.bat');
    const script = `@echo off
echo Starting PRISM Daemon...
cd /d "%~dp0"
node daemon/server.js
echo PRISM Daemon stopped.
pause
`;

    try {
      await fs.writeFile(scriptPath, script);
      console.log('   Created: start-prism.bat (Windows)');
    } catch (error) {
      console.warn(`⚠️  Warning: Could not create Windows script: ${error.message}`);
    }
  }

  /**
   * Create macOS script
   */
  async createMacScript(projectInfo) {
    const scriptPath = path.join(this.pluginRoot, 'start-prism.command');
    const script = `#!/bin/bash
echo "Starting PRISM Daemon..."
cd "$(dirname "$0")"
node daemon/server.js
echo "PRISM Daemon stopped."
`;

    try {
      await fs.writeFile(scriptPath, script);
      await fs.chmod(scriptPath, '755');
      console.log('   Created: start-prism.command (macOS)');
    } catch (error) {
      console.warn(`⚠️  Warning: Could not create macOS script: ${error.message}`);
    }
  }

  /**
   * Create Linux script
   */
  async createLinuxScript(projectInfo) {
    const scriptPath = path.join(this.pluginRoot, 'start-prism.sh');
    const script = `#!/bin/bash
echo "Starting PRISM Daemon..."
cd "$(dirname "$0")"
node daemon/server.js
echo "PRISM Daemon stopped."
`;

    try {
      await fs.writeFile(scriptPath, script);
      await fs.chmod(scriptPath, '755');
      console.log('   Created: start-prism.sh (Linux)');
    } catch (error) {
      console.warn(`⚠️  Warning: Could not create Linux script: ${error.message}`);
    }
  }

  /**
   * Create cross-platform script
   */
  async createPlatformScript(projectInfo) {
    const scriptPath = path.join(this.pluginRoot, 'scripts', 'verify-install.js');
    const script = `#!/usr/bin/env node

/**
 * PRISM Installation Verification Script
 * Checks if the plugin is properly installed and configured
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class InstallationVerifier {
  constructor() {
    this.pluginRoot = process.cwd();
    this.projectRoot = process.env.PROJECT_ROOT || process.cwd();
    this.issues = [];
    this.checks = [];
  }

  async verify() {
    console.log('🔍 Verifying PRISM Installation...');
    console.log('Plugin Root:', this.pluginRoot);
    console.log('Project Root:', this.projectRoot);
    console.log('');

    // Check 1: Core files exist
    await this.checkCoreFiles();

    // Check 2: Directories exist
    await this.checkDirectories();

    // Check 3: Configuration files
    await this.checkConfiguration();

    // Check 4: Node.js dependencies
    await this.checkDependencies();

    // Check 5: MCP server configuration
    await this.checkMCPConfiguration();

    // Check 6: Project detection
    await this.checkProjectDetection();

    // Generate report
    await this.generateReport();

    return this.issues.length === 0;
  }

  async checkCoreFiles() {
    console.log('📂 Checking core files...');
    const files = [
      'daemon/server.js',
      'daemon/project-detector.js',
      'commands/prism.md',
      '.claude-plugin/plugin.json',
      '.mcp.json'
    ];

    for (const file of files) {
      const filePath = path.join(this.pluginRoot, file);
      try {
        await fs.access(filePath);
        this.checks.push({ name: file, status: '✅', message: 'Found' });
      } catch (error) {
        this.issues.push({
          type: 'missing_file',
          file,
          message: 'Required file is missing'
        });
        this.checks.push({ name: file, status: '❌', message: 'Missing' });
      }
    }
    console.log('');
  }

  async checkDirectories() {
    console.log('📁 Checking directories...');
    const dirs = ['cache', 'index', 'logs'];

    for (const dir of dirs) {
      const dirPath = path.join(this.pluginRoot, dir);
      try {
        await fs.access(dirPath);
        this.checks.push({ name: dir, status: '✅', message: 'Exists' });
      } catch (error) {
        this.issues.push({
          type: 'missing_directory',
          directory: dir,
          message: 'Required directory is missing'
        });
        this.checks.push({ name: dir, status: '❌', message: 'Missing' });
      }
    }
    console.log('');
  }

  async checkConfiguration() {
    console.log('⚙️  Checking configuration...');

    // Check plugin.json
    try {
      const manifestPath = path.join(this.pluginRoot, '.claude-plugin', 'plugin.json');
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

      if (!manifest.autoStart) {
        this.issues.push({
          type: 'configuration',
          file: 'plugin.json',
          message: 'autoStart should be true for zero-config experience'
        });
        this.checks.push({ name: 'autoStart', status: '❌', message: 'Not enabled' });
      } else {
        this.checks.push({ name: 'autoStart', status: '✅', message: 'Enabled' });
      }
    } catch (error) {
      this.issues.push({ type: 'config_error', file: 'plugin.json', message: error.message });
      this.checks.push({ name: 'plugin.json', status: '❌', message: 'Invalid' });
    }

    // Check MCP configuration
    try {
      const mcpPath = path.join(this.pluginRoot, '.mcp.json');
      const mcpConfig = JSON.parse(await fs.readFile(mcpPath, 'utf8'));

      if (mcpConfig.mcpServers && mcpConfig.mcpServers['prism-daemon']) {
        this.checks.push({ name: 'MCP Server', status: '✅', message: 'Configured' });
      } else {
        this.issues.push({ type: 'mcp_config', message: 'MCP server not properly configured' });
        this.checks.push({ name: 'MCP Server', status: '❌', message: 'Not configured' });
      }
    } catch (error) {
      this.issues.push({ type: 'mcp_config', message: error.message });
      this.checks.push({ name: 'MCP Config', status: '❌', message: 'Invalid' });
    }

    console.log('');
  }

  async checkDependencies() {
    console.log('📦 Checking dependencies...');

    try {
      const packagePath = path.join(this.pluginRoot, 'package.json');
      const packageData = JSON.parse(await fs.readFile(packagePath, 'utf8'));

      if (packageData.dependencies) {
        const deps = Object.keys(packageData.dependencies);
        this.checks.push({
          name: 'Dependencies',
          status: '✅',
          message: \`\${deps.length} packages installed\`
        });
      } else {
        this.checks.push({
          name: 'Dependencies',
          status: '⚠️',
          message: 'No dependencies listed'
        });
      }
    } catch (error) {
      this.issues.push({ type: 'dependency_check', message: error.message });
      this.checks.push({ name: 'Dependencies', status: '❌', message: 'Check failed' });
    }

    console.log('');
  }

  async checkMCPConfiguration() {
    console.log('🔌 Checking MCP server...');

    try {
      // Check if we can start the MCP server
      const mcpPath = path.join(this.pluginRoot, '.mcp.json');
      const mcpConfig = JSON.parse(await fs.readFile(mcpPath, 'utf8'));

      if (mcpConfig.mcpServers && mcpConfig.mcpServers['prism-daemon']) {
        const serverConfig = mcpConfig.mcpServers['prism-daemon'];

        if (serverConfig.command === 'node' && serverConfig.args) {
          this.checks.push({ name: 'MCP Command', status: '✅', message: 'Configured' });
        } else {
          this.issues.push({ type: 'mcp_command', message: 'MCP command not properly configured' });
          this.checks.push({ name: 'MCP Command', status: '❌', message: 'Invalid' });
        }

        if (serverConfig.env && serverConfig.env.AUTO_DETECT) {
          this.checks.push({ name: 'Auto-Detect', status: '✅', message: 'Enabled' });
        } else {
          this.issues.push({ type: 'auto_detect', message: 'Auto-detection not enabled' });
          this.checks.push({ name: 'Auto-Detect', status: '❌', message: 'Disabled' });
        }
      }
    } catch (error) {
      this.issues.push({ type: 'mcp_server', message: error.message });
      this.checks.push({ name: 'MCP Server', status: '❌', message: 'Error' });
    }

    console.log('');
  }

  async checkProjectDetection() {
    console.log('🔍 Checking project detection...');

    try {
      const ProjectDetector = require('../daemon/project-detector');
      const detector = new ProjectDetector(this.projectRoot);
      const projectInfo = await detector.detectAll();

      this.checks.push({
        name: 'Project Language',
        status: '✅',
        message: projectInfo.language
      });

      if (projectInfo.framework) {
        this.checks.push({
          name: 'Project Framework',
          status: '✅',
          message: projectInfo.framework
        });
      } else {
        this.checks.push({
          name: 'Project Framework',
          status: '⚠️',
          message: 'No framework detected'
        });
      }
    } catch (error) {
      this.issues.push({ type: 'project_detection', message: error.message });
      this.checks.push({ name: 'Project Detection', status: '❌', message: 'Failed' });
    }

    console.log('');
  }

  async generateReport() {
    console.log('📋 Installation Report');
    console.log('=' .repeat(50));

    // Show all checks
    for (const check of this.checks) {
      console.log(\`\${check.status} \${check.name.padEnd(20)} - \${check.message}\`);
    }

    console.log('');

    if (this.issues.length === 0) {
      console.log('🎉 Installation verified successfully!');
      console.log('');
      console.log('🚀 PRISM is ready to use!');
      console.log('');
      console.log('Next steps:');
      console.log('1. Restart Claude Code to load the plugin');
      console.log('2. Run "prism index" to start indexing your project');
      console.log('3. Use "prism search" to find code across your project');
    } else {
      console.log('❌ Found \${this.issues.length} issue(s):');
      console.log('');

      for (const issue of this.issues) {
        console.log(\`- \${issue.type.toUpperCase()}: \${issue.message}\`);
        if (issue.file) {
          console.log(\`  File: \${issue.file}\`);
        }
        if (issue.directory) {
          console.log(\`  Directory: \${issue.directory}\`);
        }
        console.log('');
      }

      console.log('Please fix these issues before using PRISM.');
    }
  }
}

// Run verification
const verifier = new InstallationVerifier();
verifier.verify().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Verification failed:', error);
  process.exit(1);
});
`;

    try {
      await fs.writeFile(scriptPath, script);
      await fs.chmod(scriptPath, '755');
      console.log('   Created: verify-install.js');
    } catch (error) {
      console.warn(`⚠️  Warning: Could not create verification script: ${error.message}`);
    }
  }

  /**
   * Create verification script
   */
  async createVerificationScript() {
    const scriptPath = path.join(this.pluginRoot, 'scripts', 'verify.js');
    const script = `#!/usr/bin/env node

const verifier = require('./verify-install');
verifier.verify();
`;

    try {
      await fs.writeFile(scriptPath, script);
      await fs.chmod(scriptPath, '755');
      console.log('   Created: scripts/verify.js');
    } catch (error) {
      console.warn(`⚠️  Warning: Could not create verify.js: ${error.message}`);
    }
  }
}

// Run setup
const setup = new AutoSetup();
setup.setup().catch(error => {
  console.error('Setup failed:', error);
  process.exit(1);
});