# setup_compilers.ps1
# PowerShell script to check and install compilers for the Notepad application.

$ErrorActionPreference = 'SilentlyContinue'

Write-Host '=== Notepad Compiler Setup Script ===' -ForegroundColor Cyan
Write-Host 'This script will detect existing compilers and install missing ones using winget/local download.'
Write-Host ''

function Check-Command($cmd) {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) {
        return $true
    }
    return $false
}

function Install-Winget($name, $packageId) {
    Write-Host ('Installing ' + $name + ' (' + $packageId + ') using winget...') -ForegroundColor Yellow
    winget install --id $packageId --silent --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -eq 0) {
        Write-Host ('Successfully installed ' + $name + '!') -ForegroundColor Green
    } else {
        Write-Warning ('Failed to install ' + $name + ' via winget. Please try manual install.')
    }
}

# 1. Java JDK
if (Check-Command 'javac') {
    Write-Host '[✓] Java Compiler (javac) is already installed.' -ForegroundColor Green
} else {
    Write-Host '[ ] Java Compiler is missing.' -ForegroundColor Gray
    Install-Winget 'Java JDK (Adoptium)' 'EclipseAdoptium.Temurin.21.JDK'
}

# 2. C/C++ Compiler
if (Check-Command 'g++') {
    Write-Host '[✓] C++ Compiler (g++) is already installed.' -ForegroundColor Green
} else {
    Write-Host '[ ] C++ Compiler is missing.' -ForegroundColor Gray
    Install-Winget 'WinLibs GCC/G++' 'BrechtSanders.WinLibs.POSIX.UCRT'
}

# 3. Go Compiler
if (Check-Command 'go') {
    Write-Host '[✓] Go Compiler (go) is already installed.' -ForegroundColor Green
} else {
    Write-Host '[ ] Go Compiler is missing.' -ForegroundColor Gray
    Install-Winget 'Go' 'GoLang.Go'
}

# 4. Rust Compiler
if (Check-Command 'rustc') {
    Write-Host '[✓] Rust Compiler (rustc) is already installed.' -ForegroundColor Green
} else {
    Write-Host '[ ] Rust Compiler is missing.' -ForegroundColor Gray
    Install-Winget 'Rustup' 'Rustlang.Rustup'
}

# 5. .NET SDK
if (Check-Command 'dotnet') {
    Write-Host '[✓] .NET SDK (dotnet) is already installed.' -ForegroundColor Green
} else {
    Write-Host '[ ] .NET SDK is missing.' -ForegroundColor Gray
    Install-Winget '.NET SDK 8' 'Microsoft.DotNet.SDK.8'
}

# 6. Kotlin Compiler
$kotlinDest = Join-Path $PSScriptRoot '.runtimes'
$kotlinBin = Join-Path $kotlinDest 'kotlinc\bin\kotlinc.bat'

if (Test-Path $kotlinBin) {
    Write-Host '[✓] Kotlin Compiler (kotlinc) is already installed locally.' -ForegroundColor Green
} elseif (Check-Command 'kotlinc') {
    Write-Host '[✓] Kotlin Compiler (kotlinc) is already installed globally.' -ForegroundColor Green
} else {
    Write-Host '[ ] Kotlin Compiler is missing. Downloading standalone Kotlin compiler locally...' -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $kotlinDest | Out-Null
    
    $zipUrl = 'https://github.com/JetBrains/kotlin/releases/download/v2.0.0/kotlin-compiler-2.0.0.zip'
    $zipPath = Join-Path $kotlinDest 'kotlin-compiler.zip'
    
    try {
        Write-Host 'Downloading Kotlin Compiler v2.0.0...' -ForegroundColor Cyan
        Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing
        
        Write-Host ('Extracting to ' + $kotlinDest + '...') -ForegroundColor Cyan
        Expand-Archive -Path $zipPath -DestinationPath $kotlinDest -Force
        
        Remove-Item $zipPath -Force
        Write-Host 'Successfully installed Kotlin compiler locally!' -ForegroundColor Green
    } catch {
        Write-Warning ('Failed to download Kotlin compiler: ' + $_.Exception.Message)
    }
}

Write-Host ''
Write-Host 'Setup finished! If winget installed new compilers, you may need to restart your terminal or environment.' -ForegroundColor Green
