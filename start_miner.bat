@echo off
title Doomsday Network - Idle Sentinel Miner
echo ===================================================
echo Starting Doomsday Idle Sentinel GPU Miner...
echo ===================================================

if not exist wallet.json (
    echo Generating default wallet...
    python -m wallet.cli generate --file wallet.json
)

for /f "tokens=2 delims=:, " %%a in ('findstr "address" wallet.json') do set WALLET_ADDR=%%~a

echo Mining to Address: %WALLET_ADDR%
echo Idle threshold: 60s (adjust with --idle-sec)
echo.

python -m miner.sentinel --node http://127.0.0.1:8334 --wallet %WALLET_ADDR% --name "Rig-5080" --idle-sec 60
pause
