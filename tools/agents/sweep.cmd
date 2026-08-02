@echo off
rem SermonSmith nightly self-test sweep — invoked by the Windows scheduled task
rem "SermonSmith Nightly Sweep". Logs to tools\agents\reports\last-run.log.
setlocal
cd /d "%~dp0..\.."
node tools\agents\sweep.mjs > tools\agents\reports\last-run.log 2>&1
endlocal
