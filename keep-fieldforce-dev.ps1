# keep-fieldforce-dev.ps1
# Keeps the local FieldForce dev server running on port 3000.

$ProjectPath = "C:\Users\jand\Documents\Codex\FieldForce"
$Port = 3000
$CheckIntervalSeconds = 15
$LogFile = Join-Path $ProjectPath "fieldforce-dev-watch.log"

function Write-Log {
    param([string]$Message)

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] $Message"

    Write-Host $line
    Add-Content -Path $LogFile -Value $line
}

function Test-Port {
    param([int]$Port)

    try {
        $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        return $null -ne $connection
    }
    catch {
        return $false
    }
}

function Stop-FieldForceDevProcesses {
    Write-Log "Checking for existing FieldForce dev processes..."

    $escapedPath = $ProjectPath.Replace("\", "\\")

    $processes = Get-CimInstance Win32_Process |
        Where-Object {
            $_.CommandLine -and
            (
                $_.CommandLine -like "*$ProjectPath*" -or
                $_.CommandLine -like "*$escapedPath*"
            ) -and
            (
                $_.CommandLine -like "*npm*" -or
                $_.CommandLine -like "*node*" -or
                $_.CommandLine -like "*next*"
            )
        }

    foreach ($process in $processes) {
        try {
            Write-Log "Stopping process PID $($process.ProcessId): $($process.CommandLine)"
            Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
        }
        catch {
            Write-Log "Could not stop process PID $($process.ProcessId)."
        }
    }
}

function Start-FieldForceDevServer {
    Write-Log "Starting FieldForce dev server on port $Port..."

    $command = @"
cd "$ProjectPath"
`$env:PORT="$Port"
npm run dev -- --port $Port
"@

    Start-Process powershell.exe -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy", "Bypass",
        "-Command", $command
    ) -WorkingDirectory $ProjectPath

    Start-Sleep -Seconds 8

    if (Test-Port -Port $Port) {
        Write-Log "FieldForce dev server is listening on port $Port."
    }
    else {
        Write-Log "Warning: server was started, but port $Port is not listening yet."
    }
}

Write-Log "FieldForce dev server watchdog started."
Write-Log "Project path: $ProjectPath"
Write-Log "Target port: $Port"

while ($true) {
    if (Test-Port -Port $Port) {
        Write-Log "OK - port $Port is listening."
    }
    else {
        Write-Log "Port $Port is not listening. Restarting dev server..."
        Stop-FieldForceDevProcesses
        Start-FieldForceDevServer
    }

    Start-Sleep -Seconds $CheckIntervalSeconds
}