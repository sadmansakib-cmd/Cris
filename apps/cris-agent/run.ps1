<#
.SYNOPSIS
    Launcher Script for Cris Agent
.DESCRIPTION
    Activates the virtual environment and launches Cris in the specified mode (text, pipeline, or live).
.EXAMPLE
    .\run.ps1 --mode text
    .\run.ps1 --mode pipeline
#>

param(
    [string]$Mode = "pipeline",
    [string]$EnvFile = ""
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$VenvPython = Join-Path $ScriptDir "venv\Scripts\python.exe"

if (-not (Test-Path $VenvPython)) {
    Write-Host "[!] Virtual environment not found. Running setup.ps1 first..." -ForegroundColor Yellow
    & (Join-Path $ScriptDir "setup.ps1")
}

$ArgsList = @((Join-Path $ScriptDir "main.py"), "--mode", $Mode)
if ($EnvFile) {
    $ArgsList += @("--env", $EnvFile)
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Starting Cris Agent (Mode: $Mode) " -ForegroundColor Cyan
Write-Host " Kill Switch: Press Ctrl+Alt+Q to instantly abort " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

& $VenvPython @ArgsList
