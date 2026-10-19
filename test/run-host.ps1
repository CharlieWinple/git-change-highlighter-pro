param([switch]$Packaged)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) ('gch-host-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory $fixtureRoot | Out-Null
git -C $fixtureRoot init
git -C $fixtureRoot config user.name Test
git -C $fixtureRoot config user.email test@example.invalid
git -C $fixtureRoot config core.autocrlf false
[IO.File]::WriteAllText((Join-Path $fixtureRoot 'sample.py'), "value = 1`n")
git -C $fixtureRoot add .
git -C $fixtureRoot commit -m baseline
[IO.File]::WriteAllText((Join-Path $fixtureRoot 'sample.py'), "value = 2`n")
$extensionRoot = $projectRoot
if ($Packaged) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $packageRoot = "$fixtureRoot-package"
    $version = (Get-Content (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
    [IO.Compression.ZipFile]::ExtractToDirectory((Join-Path $projectRoot "dist/git-change-highlighter-pro-$version.vsix"), $packageRoot)
    $extensionRoot = Join-Path $packageRoot 'extension'
}
code --new-window --disable-extensions --disable-workspace-trust --skip-welcome --skip-release-notes --user-data-dir "$fixtureRoot-profile" --extensions-dir "$fixtureRoot-extensions" --extensionDevelopmentPath "$extensionRoot" --extensionTestsPath "$PSScriptRoot\host.cjs" "$fixtureRoot"
