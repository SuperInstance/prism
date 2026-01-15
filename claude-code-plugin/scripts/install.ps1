# PRISM Windows Installation Script
# Works on Windows 10/11

param(
    [Parameter(Mandatory=$false)]
    [string]$InstallPath = (Get-Location).Path
)

Write-Host "🚀 PRISM Installation Starting..." -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green

# Check if we're in the right directory
if (-not (Test-Path "$InstallPath\package.json") -or -not (Test-Path "$InstallPath\.claude-plugin")) {
    Write-Host "❌ This script must be run from the PRISM plugin root directory." -ForegroundColor Red
    Write-Host "   Please cd to the directory containing package.json and .claude-plugin" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Plugin directory verified" -ForegroundColor Green

# Check Node.js
Write-Host "📋 Checking Node.js..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js is not installed. Please install Node.js 14+ and try again." -ForegroundColor Red
    exit 1
}

try {
    $nodeVersion = node --version | ForEach-Object { $_.Replace('v', '') }
    $majorVersion = [int]$nodeVersion.Split('.')[0]
    if ($majorVersion -lt 14) {
        Write-Host "❌ Node.js version 14 or higher is required. Current version: $nodeVersion" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
}
catch {
    Write-Host "❌ Could not determine Node.js version" -ForegroundColor Red
    exit 1
}

# Check npm
Write-Host "📋 Checking npm..." -ForegroundColor Yellow
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ npm is not installed. Please install npm and try again." -ForegroundColor Red
    exit 1
}

try {
    $npmVersion = npm --version
    Write-Host "✅ npm: $npmVersion" -ForegroundColor Green
}
catch {
    Write-Host "❌ Could not determine npm version" -ForegroundColor Red
    exit 1
}

# Create directories
Write-Host "📁 Creating directories..." -ForegroundColor Yellow
$directories = @("cache", "index", "logs", "temp")
foreach ($dir in $directories) {
    $dirPath = Join-Path $InstallPath $dir
    if (-not (Test-Path $dirPath)) {
        New-Item -ItemType Directory -Path $dirPath -Force | Out-Null
        Write-Host "   Created: $dir"
    }
}

# Create .gitignore if it doesn't exist
$gitignorePath = Join-Path $InstallPath ".gitignore"
if (-not (Test-Path $gitignorePath)) {
    $gitignoreContent @"
# PRISM cache and temporary files
cache/
index/
logs/
temp/
*.log
*.tmp
.DS_Store
Thumbs.db
"@
    $gitignoreContent | Out-File -FilePath $gitignorePath -Encoding UTF8
    Write-Host "✅ Created .gitignore" -ForegroundColor Green
}

# Install dependencies if needed
Write-Host "📦 Checking dependencies..." -ForegroundColor Yellow
$packageJsonPath = Join-Path $InstallPath "package.json"
$nodeModulesPath = Join-Path $InstallPath "node_modules"

if ((Test-Path $packageJsonPath) -and -not (Test-Path $nodeModulesPath)) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    Write-Host "✅ Dependencies installed" -ForegroundColor Green
}
elseif (Test-Path $nodeModulesPath) {
    Write-Host "✅ Dependencies already installed" -ForegroundColor Green
}
else {
    Write-Host "⚠️  No package.json found, skipping dependency installation" -ForegroundColor Yellow
}

# Run Node.js setup script
Write-Host "⚙️  Running auto-setup..." -ForegroundColor Yellow
if (Get-Command node -ErrorAction SilentlyContinue) {
    & node "$InstallPath\scripts\install-setup.js"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Setup script failed" -ForegroundColor Red
        exit 1
    }
}
else {
    Write-Host "❌ Node.js not available for setup script" -ForegroundColor Red
    exit 1
}

# Create Windows scripts
Write-Host "🖥️  Creating Windows scripts..." -ForegroundColor Yellow

# Create batch script
$batchScript = @"
@echo off
echo Starting PRISM Daemon...
cd /d "%~dp0"
node daemon/server.js
echo PRISM Daemon stopped.
pause
"@

$batchPath = Join-Path $InstallPath "start-prism.bat"
$batchScript | Out-File -FilePath $batchPath -Encoding ASCII
Write-Host "✅ Created start-prism.bat" -ForegroundColor Green

# Create PowerShell shortcut script
$powershellScript = @"
# PRISM PowerShell Start Script
param(
    [Parameter(Mandatory=$false)]
    [switch]$HideWindow = $false
)

Write-Host "Starting PRISM Daemon..." -ForegroundColor Green
cd $PSScriptRoot

if ($HideWindow) {
    Start-Process -FilePath "node" -ArgumentList "daemon/server.js" -NoNewWindow
}
else {
    node daemon/server.js
}

Write-Host "PRISM Daemon stopped." -ForegroundColor Yellow
"@

$powershellPath = Join-Path $InstallPath "start-prism.ps1"
$powershellScript | Out-File -FilePath $powershellPath -Encoding UTF8
Write-Host "✅ Created start-prism.ps1" -ForegroundColor Green

# Create verification script
Write-Host "🔍 Creating verification script..." -ForegroundColor Yellow
$verifyScript = @"
# PRISM Installation Verification Script
Write-Host "🔍 Verifying PRISM Installation..." -ForegroundColor Green
Write-Host "Plugin Root: $PSScriptRoot" -ForegroundColor Cyan
Write-Host "Project Root: $env:PROJECT_ROOT" -ForegroundColor Cyan
Write-Host ""

# Check core files
Write-Host "📂 Checking core files..." -ForegroundColor Yellow
$coreFiles = @(
    "daemon/server.js",
    "daemon/project-detector.js",
    "commands/prism.md",
    ".claude-plugin/plugin.json",
    ".mcp.json"
)

$filesMissing = @()
foreach ($file in $coreFiles) {
    $filePath = Join-Path $PSScriptRoot $file
    if (Test-Path $filePath) {
        Write-Host "   ✅ $file" -ForegroundColor Green
    }
    else {
        Write-Host "   ❌ $file" -ForegroundColor Red
        $filesMissing += $file
    }
}

# Check directories
Write-Host ""
Write-Host "📁 Checking directories..." -ForegroundColor Yellow
$directories = @("cache", "index", "logs")
$dirsMissing = @()
foreach ($dir in $directories) {
    $dirPath = Join-Path $PSScriptRoot $dir
    if (Test-Path $dirPath) {
        Write-Host "   ✅ $dir" -ForegroundColor Green
    }
    else {
        Write-Host "   ❌ $dir" -ForegroundColor Red
        $dirsMissing += $dir
    }
}

# Check configuration
Write-Host ""
Write-Host "⚙️  Checking configuration..." -ForegroundColor Yellow
try {
    $manifestPath = Join-Path $PSScriptRoot ".claude-plugin\plugin.json"
    if (Test-Path $manifestPath) {
        $manifest = Get-Content $manifestPath | ConvertFrom-Json
        if ($manifest.autoStart) {
            Write-Host "   ✅ Auto-start enabled" -ForegroundColor Green
        }
        else {
            Write-Host "   ⚠️  Auto-start not enabled" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "   ❌ Plugin manifest not found" -ForegroundColor Red
    }
}
catch {
    Write-Host "   ❌ Error reading configuration: $_" -ForegroundColor Red
}

# Generate report
Write-Host ""
Write-Host "📋 Installation Report" -ForegroundColor Cyan
Write-Host "".PadRight(50, '=')

if ($filesMissing.Count -eq 0 -and $dirsMissing.Count -eq 0) {
    Write-Host "🎉 Installation verified successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🚀 PRISM is ready to use!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Restart Claude Code to load the plugin" -ForegroundColor White
    Write-Host "2. Run 'prism index' to start indexing your project" -ForegroundColor White
    Write-Host "3. Use 'prism search' to find code across your project" -ForegroundColor White
}
else {
    Write-Host "❌ Found $($filesMissing.Count + $dirsMissing.Count) issue(s):" -ForegroundColor Red
    Write-Host ""

    if ($filesMissing.Count -gt 0) {
        Write-Host "Missing files:" -ForegroundColor Red
        foreach ($file in $filesMissing) {
            Write-Host "   - $file" -ForegroundColor White
        }
    }

    if ($dirsMissing.Count -gt 0) {
        Write-Host "Missing directories:" -ForegroundColor Red
        foreach ($dir in $dirsMissing) {
            Write-Host "   - $dir" -ForegroundColor White
        }
    }

    Write-Host ""
    Write-Host "Please fix these issues before using PRISM." -ForegroundColor Yellow
}

Write-Host ""
"@

$verifyPath = Join-Path $InstallPath "verify-install.ps1"
$verifyScript | Out-File -FilePath $verifyPath -Encoding UTF8
Write-Host "✅ Created verify-install.ps1" -ForegroundColor Green

# Create desktop shortcut (optional)
Write-Host ""
Write-Host "🖱️  Would you like to create a desktop shortcut?" -ForegroundColor Yellow
$createShortcut = Read-Host "Create desktop shortcut? (y/N)"

if ($createShortcut.ToLower() -eq 'y') {
    $desktopPath = [System.Environment]::GetFolderPath('Desktop')
    $shortcutPath = Join-Path $desktopPath "PRISM Launcher.lnk"

    try {
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut($shortcutPath)
        $shortcut.TargetPath = "powershell.exe"
        $shortcut.Arguments = "-ExecutionPolicy Bypass -File `"$powershellPath`""
        $shortcut.Description = "PRISM Daemon Launcher"
        $shortcut.WorkingDirectory = $InstallPath
        $shortcut.IconLocation = "$InstallPath\daemon\server.js, 0"
        $shortcut.Save()

        Write-Host "✅ Created desktop shortcut: PRISM Launcher.lnk" -ForegroundColor Green
    }
    catch {
        Write-Host "⚠️  Could not create desktop shortcut: $_" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🎉 Installation Complete!" -ForegroundColor Green
Write-Host "========================" -ForegroundColor Green
Write-Host ""
Write-Host "📋 What's been done:" -ForegroundColor Cyan
Write-Host "   ✅ Directories created" -ForegroundColor Green
Write-Host "   ✅ Configuration files updated" -ForegroundColor Green
Write-Host "   ✅ Windows scripts created" -ForegroundColor Green
Write-Host "   ✅ Auto-detection enabled" -ForegroundColor Green
Write-Host "   ✅ Zero-config setup complete" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Restart Claude Code to load the plugin" -ForegroundColor White
Write-Host "   2. Run '.\verify-install.ps1' to verify installation" -ForegroundColor White
Write-Host "   3. Run 'prism index' to start indexing your project" -ForegroundColor White
Write-Host ""
Write-Host "📖 Quick Commands:" -ForegroundColor Cyan
Write-Host "   • Start daemon manually: .\start-prism.bat" -ForegroundColor White
Write-Host "   • Start daemon (hidden): .\start-prism.ps1 -HideWindow" -ForegroundColor White
Write-Host "   • Verify installation: .\verify-install.ps1" -ForegroundColor White
Write-Host "   • View logs: Get-Content logs/prism.log" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Configuration files:" -ForegroundColor Cyan
Write-Host "   • .claude-plugin/plugin.json - Plugin manifest" -ForegroundColor White
Write-Host "   • .mcp.json - MCP server configuration" -ForegroundColor White
Write-Host "   • cache/ - Cache directory" -ForegroundColor White
Write-Host "   • index/ - Index storage" -ForegroundColor White
Write-Host ""
Write-Host "Happy coding with PRISM! 🎯" -ForegroundColor Green