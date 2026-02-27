@echo off
title 포키사이트 자동 시작 도구
cd /d "%~dp0"

echo [1/3] 기존 프로세스 정리 중...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im cloudflared.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/3] 서버 가동 시작...
start /b node server.js

echo [3/3] 외부 접속 주소 생성 중 (약 10초 대기)...
timeout /t 10 /nobreak >nul
npx cloudflared tunnel --url http://localhost:3001

echo.
echo ======================================================
echo 서버가 정상적으로 실행되었습니다!
echo 상단에 표시된 'https://...trycloudflare.com' 주소를 확인하세요.
echo (이 창을 닫으면 사이트 접속이 끊깁니다)
echo ======================================================
pause
