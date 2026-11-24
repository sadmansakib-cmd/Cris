<#
.SYNOPSIS
    Automated Windows Setup Script for Cris Agent
.DESCRIPTION
    Creates Python virtual environment, installs dependencies, initializes directories,
    and validates the test suite.
#>

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Cris Agent - Windows Setup & Environment Initialization " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# 1. Detect Python
$PythonCmd = "python"
if (Get-Command "py" -ErrorAction SilentlyContinue) {
    # Check if 3.11 is available via py launcher
    $Py311 = & py -3.11 --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        $PythonCmd = "py -3.11"
        Write-Host "[+] Using Python 3.11 via launcher" -ForegroundColor Green
    } else {
        Write-Host "[*] Python 3.11 launcher not found. Using default Python installation" -ForegroundColor Yellow
        $PythonCmd = "python"
    }
}

Write-Host "[*] Detected Python: $(& $PythonCmd --version)" -ForegroundColor Green

# 2. Virtual Environment Setup
$VenvDir = Join-Path $ScriptDir "venv"
if (-not (Test-Path $VenvDir)) {
    Write-Host "[*] Creating virtual environment at $VenvDir..." -ForegroundColor Yellow
    Invoke-Expression "$PythonCmd -m venv `"$VenvDir`""
} else {
    Write-Host "[+] Existing virtual environment found at $VenvDir" -ForegroundColor Green
}

$VenvPython = Join-Path $VenvDir "Scripts\python.exe"
$VenvPip = Join-Path $VenvDir "Scripts\pip.exe"

# 3. Upgrade Pip & Install Dependencies
Write-Host "[*] Upgrading pip..." -ForegroundColor Yellow
& $VenvPython -m pip install --upgrade pip

Write-Host "[*] Installing pinned requirements from requirements.txt..." -ForegroundColor Yellow
& $VenvPip install -r (Join-Path $ScriptDir "requirements.txt")

# 4. Install Playwright Chromium Browser
Write-Host "[*] Installing Playwright Chromium browser binary..." -ForegroundColor Yellow
try {
    & $VenvPython -m playwright install chromium
} catch {
    Write-Host "[!] Note: Playwright browser install can be re-run later if network fails." -ForegroundColor DarkYellow
}

# 5. Create Runtime Directories
$Dirs = @("data", "tokens", "logs", "data/screenshots", "data/browser_profile")
foreach ($d in $Dirs) {
    $Target = Join-Path $ScriptDir $d
    if (-not (Test-Path $Target)) {
        New-Item -ItemType Directory -Path $Target -Force | Out-Null
    }
}
Write-Host "[+] Runtime directories verified (data, tokens, logs)" -ForegroundColor Green

# 6. Initialize .env from .env.example if missing
$EnvFile = Join-Path $ScriptDir ".env"
$EnvExample = Join-Path $ScriptDir ".env.example"
if (-not (Test-Path $EnvFile) -and (Test-Path $EnvExample)) {
    Copy-Item $EnvExample $EnvFile
    Write-Host "[+] Created template .env file. Please add your GEMINI_API_KEY in apps/cris-agent/.env" -ForegroundColor Magenta
}

# 7. Run Test Suite Validation
Write-Host "[*] Executing test suite verification..." -ForegroundColor Yellow
& $VenvPython (Join-Path $ScriptDir "tests\runner.py")

Write-Host "==========================================================" -ForegroundColor Green
Write-Host " Setup complete! Run Cris using: .\run.ps1 --mode text " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
