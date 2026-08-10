@echo off
setlocal
cd /d %~dp0
if not exist ..\..\dist mkdir ..\..\dist
set GOOS=windows
set GOARCH=amd64
set CGO_ENABLED=0
go test ./... || exit /b 1
go build -trimpath -ldflags="-s -w -H=windowsgui" -o ..\..\dist\NexusDeck-Companion.exe .\cmd\nexus-deck || exit /b 1
echo.
echo Build concluido: dist\NexusDeck-Companion.exe
