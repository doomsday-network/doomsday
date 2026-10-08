@echo off
title Doomsday Network - Full Node
echo ===================================================
echo Starting Doomsday Network Full Node & Explorer...
echo ===================================================
python -m node.server --host 0.0.0.0 --web-port 8334
pause
