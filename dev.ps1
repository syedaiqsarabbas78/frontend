$nodeDir = "C:\Program Files\nodejs"
if (Test-Path $nodeDir) {
    if ($env:Path -split ';' -notcontains $nodeDir) {
        $env:Path = "$nodeDir;$env:Path"
    }
}
Set-Location $PSScriptRoot
npm run dev