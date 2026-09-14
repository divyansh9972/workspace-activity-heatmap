@echo off
echo =========================================
echo  UPDATING FRAMER ACTIVITY HEATMAP
echo =========================================
echo.

echo 1. Scanning local workspaces for new activity...
python scanner.py
echo.

echo 2. Pushing updated data to GitHub...
git add .
git commit -m "Auto-update heatmap data from local scanner"
git push
echo.

echo =========================================
echo SUCCESS! 
echo GitHub is now deploying your changes.
echo Your Framer website will automatically reflect 
echo the new data in about 60 seconds.
echo =========================================
pause
