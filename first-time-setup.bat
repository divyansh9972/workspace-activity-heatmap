@echo off
echo ==========================================
echo   FIRST-TIME GITHUB SETUP
echo ==========================================
echo.
echo Please go to your new GitHub repository page.
echo Click the green "Code" button and copy the HTTPS URL.
echo It should look like: https://github.com/YourName/workspace-activity-heatmap.git
echo.

set /p REPO_URL="Paste that URL here and press Enter: "

echo.
echo Initializing Git repository...
git init

echo Adding files...
git add .

echo Committing files...
git commit -m "Initial commit"

echo Setting branch to main...
git branch -M main

echo Connecting to your GitHub repository...
git remote add origin %REPO_URL%

echo Pushing code to GitHub...
git push -u origin main

echo.
echo ==========================================
echo SUCCESS! Your code is now live on GitHub!
echo You can now go to GitHub Settings ^> Pages to turn on free hosting.
echo ==========================================
pause
