[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).ProviderPath
$invocationDirectory = if ($env:INIT_CWD) { $env:INIT_CWD } else { (Get-Location).ProviderPath }
$git = Get-Command git.exe -ErrorAction Stop
$checkout = & $git.Source -C $invocationDirectory rev-parse --show-toplevel 2>$null
if ($LASTEXITCODE -ne 0 -or !$checkout -or
    [IO.Path]::GetFullPath($checkout) -ne $repositoryRoot) {
    throw "Run npm run deploy:local from inside the local Roza checkout at $repositoryRoot."
}

$rozaKey = Join-Path $env:USERPROFILE 'Documents\AWS\esheleyni_aws_server.pem'
if (!(Test-Path -LiteralPath $rozaKey -PathType Leaf)) {
    throw "Roza SSH key missing: $rozaKey"
}

$npm = Get-Command npm.cmd -ErrorAction Stop
$ssh = Get-Command ssh.exe -ErrorAction Stop
$server = 'ubuntu@ec2-51-84-165-110.il-central-1.compute.amazonaws.com'

Push-Location -LiteralPath $repositoryRoot
try {
    & $npm.Source run desktop:build
    if ($LASTEXITCODE -ne 0) { throw "Desktop build failed (exit $LASTEXITCODE)." }

    & $npm.Source run docker:publish
    if ($LASTEXITCODE -ne 0) { throw "Docker publish failed (exit $LASTEXITCODE)." }

    # Share the production deployment lock, health check, and rollback with the GitHub workflow.
    & $ssh.Source -T -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes `
        -i $rozaKey $server 'sudo -n /usr/local/sbin/roza-redeploy'
    if ($LASTEXITCODE -ne 0) { throw "Roza SSH deployment failed (exit $LASTEXITCODE)." }
} finally {
    Pop-Location
}
