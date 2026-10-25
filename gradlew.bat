@echo off
setlocal EnableExtensions
set "GRADLE_VERSION=8.13"
set "GRADLE_BASE=%USERPROFILE%\.gradle\sidenote-distributions"
set "GRADLE_HOME=%GRADLE_BASE%\gradle-%GRADLE_VERSION%"
set "GRADLE_ZIP=%GRADLE_BASE%\gradle-%GRADLE_VERSION%-bin.zip"
set "GRADLE_SHA256=20f1b1176237254a6fc204d8434196fa11a4cfb387567519c61556e8710aed78"
if not exist "%GRADLE_HOME%\bin\gradle.bat" (
  if not exist "%GRADLE_BASE%" mkdir "%GRADLE_BASE%"
  echo Downloading official Gradle %GRADLE_VERSION% distribution...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -Uri 'https://services.gradle.org/distributions/gradle-%GRADLE_VERSION%-bin.zip' -OutFile '%GRADLE_ZIP%'; $actual=(Get-FileHash -Path '%GRADLE_ZIP%' -Algorithm SHA256).Hash.ToLower(); if ($actual -ne '%GRADLE_SHA256%') { throw 'Gradle ZIP SHA-256 checksum mismatch.' }; Expand-Archive -Path '%GRADLE_ZIP%' -DestinationPath '%GRADLE_BASE%' -Force"
  if errorlevel 1 exit /b 1
)
call "%GRADLE_HOME%\bin\gradle.bat" %*
exit /b %errorlevel%
