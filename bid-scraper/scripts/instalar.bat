@echo off
rem Instala dependências em um ambiente virtual (requer Python 3.11+ no PATH).
cd /d "%~dp0\.."
python -m venv .venv || goto :erro
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt || goto :erro
echo.
echo Pronto. Rode:  scripts\bid.bat sondar
exit /b 0
:erro
echo Falha na instalacao. Confirme que o Python 3.11+ esta instalado e no PATH.
exit /b 1
