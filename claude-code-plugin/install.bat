@echo off
setlocal enabledelayedexpansion

echo Installing PRISM Plugin for Claude Code...
echo.

:: Set plugin directory
set "PLUGIN_DIR=%USERPROFILE%\.claude\plugins\prism-project-memory"

:: Check if Node.js is installed
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install Node.js 14+ first.
    echo    Visit: https://nodejs.org/
    exit /b 1
)

:: Check if Claude Code CLI is installed
where claude >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Claude Code CLI not found. Please install Claude Code first.
    echo    Visit: https://claude.ai/download
    exit /b 1
)

:: Create plugin directory
echo Creating plugin directory: %PLUGIN_DIR%
if not exist "%PLUGIN_DIR%" mkdir "%PLUGIN_DIR%"

:: Copy plugin files
echo Copying plugin files...
xcopy /E /I /Y ".claude-plugin" "%PLUGIN_DIR%\.claude-plugin" >nul
xcopy /E /I /Y "daemon" "%PLUGIN_DIR%\daemon" >nul
copy /Y ".mcp.json" "%PLUGIN_DIR%\" >nul
copy /Y "package.json" "%PLUGIN_DIR%\" >nul
if exist "commands\prism.md" (
    if not exist "%PLUGIN_DIR%\commands" mkdir "%PLUGIN_DIR%\commands"
    copy /Y "commands\prism.md" "%PLUGIN_DIR%\commands\" >nul
)
if exist "agents\prism-assistant.md" (
    if not exist "%PLUGIN_DIR%\agents" mkdir "%PLUGIN_DIR%\agents"
    copy /Y "agents\prism-assistant.md" "%PLUGIN_DIR%\agents\" >nul
)

:: Create .prism directory
if not exist "%PLUGIN_DIR%\.prism" mkdir "%PLUGIN_DIR%\.prism"

echo.
echo [SUCCESS] Plugin installed to: %PLUGIN_DIR%
echo.
echo Installation complete!
echo.
echo Next steps:
echo   1. Restart Claude Code
echo   2. The plugin will auto-start and index your projects
echo   3. Test with: /prism status
echo.
echo Tip: The plugin creates a .prism/ folder in each project for local storage
echo.

pause
