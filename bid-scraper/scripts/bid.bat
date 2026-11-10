@echo off
rem Atalho: scripts\bid.bat <comando> [opcoes]   (usa o .venv, ou o bidscraper.exe se existir)
cd /d "%~dp0\.."
if exist bidscraper.exe (
  bidscraper.exe %*
) else (
  call .venv\Scripts\activate.bat
  python -m bidscraper %*
)
