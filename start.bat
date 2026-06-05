@echo off
echo Starting CoderSathi...

:: Start MCP server
start "DevToolkit MCP Server" cmd /k "cd /d D:\mcp\devtoolkit-mcp && node dist/index.js"

:: Start backend
start "CoderSathi Backend" cmd /k "cd /d D:\coding-agent\backend && python -m uvicorn main:app --reload --port 8000"

:: Wait then start frontend
timeout /t 3 /nobreak > nul
start "CoderSathi Frontend" cmd /k "cd /d D:\coding-agent\frontend && npm run dev"

echo.
echo ====================================
echo  CoderSathi is starting...
echo ====================================
echo  MCP Server : stdio (background)
echo  Backend    : http://localhost:8000
echo  Frontend   : http://localhost:5200
echo ====================================
echo.
pause
