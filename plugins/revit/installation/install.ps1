# Installe le plugin pour une version de Revit.  Usage :  .\install.ps1 -Revit 2025 -Dossier ..\src\Bina.Revit.Addin\bin\Release\net8.0-windows
param([Parameter(Mandatory=$true)][string]$Revit, [Parameter(Mandatory=$true)][string]$Dossier)
$ErrorActionPreference = 'Stop'
$dll = Join-Path (Resolve-Path $Dossier) 'Bina.Revit.Addin.dll'
if (-not (Test-Path $dll)) { throw "Fichier introuvable : $dll (compilez d'abord le plugin)." }
$cible = Join-Path $env:APPDATA "Autodesk\Revit\Addins\$Revit"
if (-not (Test-Path $cible)) { throw "Dossier Revit $Revit introuvable : $cible (Revit $Revit est-il installé et lancé au moins une fois ?)." }
$dest = Join-Path $cible 'Bina'
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item (Join-Path (Split-Path $dll) '*.dll') $dest -Force
$modele = Get-Content (Join-Path $PSScriptRoot 'Bina.addin') -Raw
$modele.Replace('CHEMIN_DLL', (Join-Path $dest 'Bina.Revit.Addin.dll')) | Set-Content (Join-Path $cible 'Bina.addin') -Encoding UTF8
Write-Host "Installé. Fermez puis rouvrez Revit $Revit : l'onglet Bina apparaît."
