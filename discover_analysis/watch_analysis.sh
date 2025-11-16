#!/bin/bash
echo "================================================================================"
echo "WATCHING ANALYSIS LOGS IN REAL-TIME"
echo "================================================================================"
echo "Log file: $(dirname "$0")/analysis_log.txt"
echo "Press Ctrl+C to stop watching"
echo "================================================================================"
echo ""

tail -f "$(dirname "$0")/analysis_log.txt"
