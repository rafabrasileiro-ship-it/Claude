@echo off
rem Gera bidscraper.exe (um único executável) com PyInstaller.
cd /d "%~dp0\.."
call .venv\Scripts\activate.bat
pip install pyinstaller
pyinstaller --onefile --name bidscraper --collect-submodules bidscraper bidscraper\__main__.py
copy /Y dist\bidscraper.exe bidscraper.exe
echo Gerado: bidscraper.exe (mantenha config.toml na mesma pasta)
