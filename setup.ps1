# Setup for Windows. All the work is in src/setup.js; this file only passes the flags on.
node "$PSScriptRoot/src/setup.js" @args
exit $LASTEXITCODE
