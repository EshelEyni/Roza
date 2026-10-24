[CmdletBinding()]
param(
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$runUrl = $null
$exitCode = 0

function Show-DeploymentAlert {
    param([string]$Message, [bool]$Succeeded)

    try {
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        if ($Succeeded) {
            [System.Media.SystemSounds]::Asterisk.Play()
            $icon = [System.Windows.Forms.MessageBoxIcon]::Information
        } else {
            [System.Media.SystemSounds]::Hand.Play()
            $icon = [System.Windows.Forms.MessageBoxIcon]::Error
        }
        [System.Windows.Forms.MessageBox]::Show(
            $Message, 'Roza deployment',
            [System.Windows.Forms.MessageBoxButtons]::OK, $icon,
            [System.Windows.Forms.MessageBoxDefaultButton]::Button1,
            [System.Windows.Forms.MessageBoxOptions]::DefaultDesktopOnly
        ) | Out-Null
    } catch {
        Write-Warning ('Could not show the Windows dialog: ' + $_.Exception.Message)
    }
}

Push-Location -LiteralPath $repositoryRoot
try {
    if ($DryRun) {
        & "$PSScriptRoot/publish-image.ps1" -DryRun
        Write-Host '> Dispatch deploy-roza.yml on EshelEyni/Roza main and capture its run ID.'
        Write-Host '> gh run watch <dispatched-run-id> --repo EshelEyni/Roza --exit-status'
        Write-Host '> Show a Windows success or failure dialog with sound.'
        Write-Host 'Dry run complete. No image published, deployment started, or dialog shown.'
    } else {
        $gh = Get-Command gh -ErrorAction SilentlyContinue
        if (-not $gh) {
            $installedGh = Join-Path $env:ProgramFiles 'GitHub CLI/gh.exe'
            if (Test-Path -LiteralPath $installedGh) { $gh = Get-Command $installedGh }
        }
        if (-not $gh) { throw 'GitHub CLI was not found. Install gh and run gh auth login.' }
        if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
            throw 'Docker CLI was not found. Install/start Docker Desktop and sign in with docker login.'
        }
        & $gh auth status --hostname github.com
        if ($LASTEXITCODE -ne 0) { throw 'GitHub authentication failed. Run gh auth login first.' }

        & "$PSScriptRoot/publish-image.ps1"

        # Capture this dispatch directly, rather than watching an unrelated latest run.
        $dispatchJson = & $gh api --method POST `
            'repos/EshelEyni/Roza/actions/workflows/deploy-roza.yml/dispatches' `
            -H 'Accept: application/vnd.github+json' `
            -H 'X-GitHub-Api-Version: 2026-03-10' `
            -f 'ref=main' -F 'return_run_details=true'
        if ($LASTEXITCODE -ne 0) { throw 'Image published, but starting the deployment failed.' }
        $dispatch = ($dispatchJson -join "`n") | ConvertFrom-Json
        if (-not $dispatch.workflow_run_id) {
            throw 'Deployment was requested, but GitHub returned no run ID. Check GitHub Actions before retrying.'
        }
        $runUrl = $dispatch.html_url
        Write-Host ('Deployment: ' + $runUrl)
        & $gh run watch $dispatch.workflow_run_id --repo EshelEyni/Roza --exit-status
        if ($LASTEXITCODE -ne 0) {
            throw ('Deployment did not finish successfully, or watching it failed. Check: ' + $runUrl)
        }
        $message = "Roza is ready. Image published and deployment completed successfully.`n`n$runUrl"
        Write-Host $message
        Show-DeploymentAlert -Message $message -Succeeded $true
    }
} catch {
    $exitCode = 1
    $message = "Roza publish/deploy failed.`n`n$($_.Exception.Message)"
    Write-Host $message -ForegroundColor Red
    if (-not $DryRun) { Show-DeploymentAlert -Message $message -Succeeded $false }
} finally {
    Pop-Location
}
exit $exitCode
