@echo off
title Doomsday Network - Worker Rig Sentinel
echo ===================================================
echo Starting Doomsday Worker Rig GPU Miner...
echo ===================================================

set /p MASTER_IP="Enter Master PC IP [default: 192.168.86.113]: "
if "%MASTER_IP%"=="" set MASTER_IP=192.168.86.113

set /p RIG_NAME="Enter Rig Name [e.g. Rig-4060Ti]: "
if "%RIG_NAME%"=="" set RIG_NAME=Rig-Worker

set /p WALLET_ADDR="Enter DOOM Wallet Address [default: doom12da148685b855223a3cd830058e227d8369b5aac8e96db05]: "
if "%WALLET_ADDR%"=="" set WALLET_ADDR=doom12da148685b855223a3cd830058e227d8369b5aac8e96db05

echo.
echo Connecting to Master Node: http://%MASTER_IP%:8334
echo Rig Identifier: %RIG_NAME%
echo Wallet: %WALLET_ADDR%
echo Idle threshold: 60s
echo.

python -m miner.sentinel --node http://%MASTER_IP%:8334 --wallet %WALLET_ADDR% --name "%RIG_NAME%" --idle-sec 60
pause
