#!/usr/bin/env node

/**
 * Test the project detector functionality
 */

const ProjectDetector = require('../daemon/project-detector');
const path = require('path');
const fs = require('fs').promises;

async function testProjectDetector() {
  console.log('🔍 Testing Project Detector...\n');

  const testRoot = path.join(__dirname, 'test-project');

  try {
    // Create test project files
    await fs.mkdir(testRoot, { recursive: true });

    // Create package.json for Node.js test
    await fs.writeFile(path.join(testRoot, 'package.json'), JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        express: '^4.18.0',
        react: '^18.0.0'
      },
      devDependencies: {
        jest: '^29.0.0',
        eslint: '^8.0.0'
      },
      scripts: {
        start: 'node server.js',
        test: 'jest',
        build: 'webpack'
      }
    }, null, 2));

    // Create some source files
    await fs.mkdir(path.join(testRoot, 'src'), { recursive: true });
    await fs.writeFile(path.join(testRoot, 'src', 'index.js'), `
// Main entry point
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello World');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});
`);

    console.log('✅ Test project created');

    // Test project detector
    const detector = new ProjectDetector(testRoot);
    const projectInfo = await detector.detectAll();

    console.log('\n📊 Project Detection Results:');
    console.log('================================');
    console.log('Name:', projectInfo.name);
    console.log('Language:', projectInfo.language);
    console.log('Type:', projectInfo.type);
    console.log('Framework:', projectInfo.framework);
    console.log('Dependencies:', projectInfo.dependencies.length, 'items');
    console.log('Dev Dependencies:', projectInfo.devDependencies.length, 'items');
    console.log('Build Tools:', projectInfo.buildTools);
    console.log('Test Frameworks:', projectInfo.testFrameworks);
    console.log('Linting Tools:', projectInfo.lintingTools);
    console.log('Config Files:', projectInfo.configFiles);

    console.log('\n📁 Directory Structure:');
    console.log('================================');
    for (const [dir, exists] of Object.entries(projectInfo.directories)) {
      console.log(`${dir}: ${exists ? '✅' : '❌'}`);
    }

    console.log('\n🎯 Validation Results:');
    console.log('================================');

    // Validation checks
    const checks = [
      { name: 'Node.js Detection', pass: projectInfo.type === 'node' },
      { name: 'JavaScript Detection', pass: projectInfo.language === 'javascript' },
      { name: 'React Framework', pass: projectInfo.framework === 'react' },
      { name: 'Dependencies Detected', pass: projectInfo.dependencies.length > 0 },
      { name: 'Build Tools Detected', pass: projectInfo.buildTools.length > 0 || projectInfo.scripts.build !== undefined },
      { name: 'Test Frameworks Detected', pass: projectInfo.testFrameworks.length > 0 || projectInfo.scripts.test !== undefined },
      { name: 'Src Directory', pass: projectInfo.directories.src },
      { name: 'Package.json Found', pass: projectInfo.configFiles.some(f => f.includes('package')) }
    ];

    let passed = 0;
    checks.forEach(check => {
      const status = check.pass ? '✅' : '❌';
      console.log(`${status} ${check.name}`);
      if (check.pass) passed++;
    });

    console.log(`\n📈 Summary: ${passed}/${checks.length} checks passed`);

    if (passed === checks.length) {
      console.log('🎉 Project detection working perfectly!');
    } else {
      console.log('⚠️  Some issues detected - check the results above');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Clean up
    try {
      await fs.rm(testRoot, { recursive: true, force: true });
      console.log('\n✅ Test cleanup completed');
    } catch (error) {
      console.log('⚠️  Cleanup warning:', error.message);
    }
  }
}

// Run the test
testProjectDetector();