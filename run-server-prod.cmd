@echo off
cd /d E:\Humanitiees
set DATABASE_URL=postgresql://humanitee:omglol123@206.189.119.150:5432/humanitee_prod?schema=public
"C:\Program Files\nodejs\node.exe" src\index.js
pause
