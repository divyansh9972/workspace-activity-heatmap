@echo off
echo Starting Local Settings Server...
start http://localhost:8000/?nocache=%RANDOM%
python server.py
