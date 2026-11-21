@echo off
set "PATH=%LOCALAPPDATA%\nodejs;%PATH%"
cd /d "%~dp0"
npm.cmd run dev