@echo off
rem Starts the local server for the theory app (hidden) and opens it in the default browser.
set "PYW=%LOCALAPPDATA%\Programs\Python\Python312\pythonw.exe"
start "" "%PYW%" -I "%~dp0serve.py"
ping -n 3 127.0.0.1 >nul
start "" http://127.0.0.1:8765/
