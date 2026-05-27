@echo off
setlocal EnableDelayedExpansion

REM Script di rilascio per Daggerheart ITA (Windows)
REM Uso: tools\release.bat 0.1.4

if "%~1"=="" (
  echo Uso: %~nx0 ^<nuova-versione^>
  echo Esempio: %~nx0 0.1.4
  exit /b 1
)

set "NEW_VERSION=%~1"

REM Vai alla root del progetto (parent di tools\)
cd /d "%~dp0\.."

REM Verifica formato versione
echo %NEW_VERSION% | findstr /R "^[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*$" >nul
if errorlevel 1 (
  echo ERRORE: la versione deve essere in formato X.Y.Z ^(es. 0.1.4^)
  exit /b 1
)

REM Verifica repo git
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo ERRORE: questa cartella non e' un repository git.
  exit /b 1
)

REM Verifica working tree pulito
for /f %%i in ('git status --porcelain') do (
  echo ERRORE: working tree non pulito. Commit o stash prima di rilasciare.
  git status --short
  exit /b 1
)

REM Verifica jq
where jq >nul 2>&1
if errorlevel 1 (
  echo ERRORE: jq non installato. Scaricalo da https://stedolan.github.io/jq/download/
  echo Oppure: winget install jqlang.jq
  exit /b 1
)

REM Versione corrente
for /f %%v in ('jq -r ".version" system.json') do set "CURRENT_VERSION=%%v"
echo Versione corrente: !CURRENT_VERSION!
echo Nuova versione:    !NEW_VERSION!

if "!CURRENT_VERSION!"=="!NEW_VERSION!" (
  echo ERRORE: la nuova versione e' uguale a quella corrente.
  exit /b 1
)

REM Verifica tag non esistente
git rev-parse "v!NEW_VERSION!" >nul 2>&1
if not errorlevel 1 (
  echo ERRORE: il tag v!NEW_VERSION! esiste gia'.
  exit /b 1
)

set /p REPLY=Procedere con il rilascio v!NEW_VERSION!? (y/N) 
if /i not "!REPLY!"=="y" (
  echo Annullato.
  exit /b 0
)

REM Aggiorna system.json
echo Aggiorno system.json...
jq ".version = \"!NEW_VERSION!\"" system.json > system.json.tmp
move /y system.json.tmp system.json >nul

REM Commit, tag, push
echo Commit, tag e push...
git add system.json
git commit -m "release: v!NEW_VERSION!"
git tag -a "v!NEW_VERSION!" -m "Daggerheart ITA v!NEW_VERSION!"
git push origin HEAD
git push origin "v!NEW_VERSION!"

echo.
echo Rilascio avviato per v!NEW_VERSION!
echo GitHub Actions sta creando la release.
echo Controlla: https://github.com/Vaanguard1990/daggerheart-ita/actions
endlocal
