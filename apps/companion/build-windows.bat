@echo off
setlocal
cd /d %~dp0
node ..\..\scripts\sync-local-deck.mjs || exit /b 1
if not exist ..\..\dist mkdir ..\..\dist
set GOOS=windows
set GOARCH=amd64
set CGO_ENABLED=0
go test ./... || exit /b 1
go build -trimpath -ldflags="-s -w -H=windowsgui" -o ..\..\dist\NexusDeck-Companion.exe .\cmd\nexus-deck || exit /b 1
if not exist .\cmd\nexus-installer\payload mkdir .\cmd\nexus-installer\payload
copy /Y ..\..\dist\NexusDeck-Companion.exe .\cmd\nexus-installer\payload\NexusDeck-Companion.exe >nul || exit /b 1
go build -trimpath -ldflags="-s -w -H=windowsgui" -o ..\..\dist\NexusDeck-Setup.exe .\cmd\nexus-installer || exit /b 1
certutil -hashfile ..\..\dist\NexusDeck-Companion.exe SHA256
certutil -hashfile ..\..\dist\NexusDeck-Setup.exe SHA256

echo.
echo Build concluido:
echo   dist\NexusDeck-Companion.exe
echo   dist\NexusDeck-Setup.exe
