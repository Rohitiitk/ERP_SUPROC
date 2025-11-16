@echo off
echo ================================================================================
echo WATCHING ANALYSIS LOGS IN REAL-TIME
echo ================================================================================
echo Log file: %~dp0analysis_log.txt
echo Press Ctrl+C to stop watching
echo ================================================================================
echo.

powershell -Command "Get-Content '%~dp0analysis_log.txt' -Wait -Tail 50"
