<#
.SYNOPSIS
  Install all tenant-admin M routines into a running VistA Docker container.

.DESCRIPTION
  Copies all .m files from apps/tenant-admin/m-routines/ into the VistA container,
  runs each INSTALL entry point, then registers all RPCs in the OR CPRS GUI CHART
  context via ZVECTXTA.

  Idempotent: safe to re-run after docker compose down -v or container rebuild.

.PARAMETER ContainerName
  Name of the running VistA Docker container. Default: local-vista-utf8

.PARAMETER VistaUser
  OS user inside the container that owns VistA routines. Default: vista

.PARAMETER RoutinePath
  Path inside container where M routines live. Default: /opt/vista/r

.EXAMPLE
  .\install-m-routines.ps1
  .\install-m-routines.ps1 -ContainerName vehu -VistaUser vehu -RoutinePath /home/vehu/r
#>

param(
  [string]$ContainerName = "local-vista-utf8",
  [string]$VistaUser     = "vista",
  [string]$RoutinePath   = "/opt/vista/r"
)

$ErrorActionPreference = "Stop"
$scriptRoot = Split-Path -Parent $PSScriptRoot
$mRoutineDir = Join-Path $scriptRoot "m-routines"

Write-Host "=== VistA Tenant Admin M Routine Installer ===" -ForegroundColor Cyan
Write-Host "Container: $ContainerName"
Write-Host "VistA user: $VistaUser"
Write-Host "Routine path: $RoutinePath"
Write-Host ""

# Verify container is running
$running = docker ps --filter "name=$ContainerName" --format "{{.Names}}" 2>&1
if ($running -notmatch $ContainerName) {
  Write-Host "ERROR: Container '$ContainerName' is not running." -ForegroundColor Red
  Write-Host "Start it first: docker compose up -d" -ForegroundColor Yellow
  exit 1
}

# List M routines to install
$mFiles = Get-ChildItem -Path $mRoutineDir -Filter "*.m" | Sort-Object Name
if ($mFiles.Count -eq 0) {
  Write-Host "ERROR: No .m files found in $mRoutineDir" -ForegroundColor Red
  exit 1
}

Write-Host "Found $($mFiles.Count) M routines:" -ForegroundColor Green
$mFiles | ForEach-Object { Write-Host "  $_" }
Write-Host ""

# Step 1: Copy all .m files into container
Write-Host "Step 1: Copying M routines into container..." -ForegroundColor Cyan
foreach ($f in $mFiles) {
  $src = $f.FullName
  $dst = "${ContainerName}:/tmp/$($f.Name)"
  docker cp $src $dst
  if ($LASTEXITCODE -ne 0) { Write-Host "  FAIL: docker cp $($f.Name)" -ForegroundColor Red; exit 1 }
  docker exec $ContainerName bash -c "cp /tmp/$($f.Name) $RoutinePath/$($f.Name) && chown ${VistaUser}:${VistaUser} $RoutinePath/$($f.Name)"
  if ($LASTEXITCODE -ne 0) { Write-Host "  FAIL: cp to $RoutinePath for $($f.Name)" -ForegroundColor Red; exit 1 }
  Write-Host "  OK: $($f.Name)" -ForegroundColor Green
}

# Step 2: Run INSTALL for each routine that has one
$installRoutines = @(
  "ZVECLAVL",
  "ZVEHSCOMP",
  "ZVEHLFIL",
  "ZVEMGRP",
  "ZVEDEV",
  "ZVETMCTL",
  "ZVEUCLONE",
  "ZVEUSMG",
  "ZVECLNM",
  "ZVEWRDM"
)

Write-Host ""
Write-Host "Step 2: Running INSTALL entry points..." -ForegroundColor Cyan

# Build ydb env setup command — run as container root, NOT su - $VistaUser,
# because `su - vista` triggers the VistA login trap (XUS ACCEPT) which
# causes NOPRINCIO errors in non-interactive mode.
$envSetup = @"
export ydb_dist=/opt/yottadb/current
export ydb_gbldir=/opt/vista/g/vista.gld
export ydb_chset=UTF-8
export ydb_icu_version=`$(pkg-config --modversion icu-io 2>/dev/null || echo 67.1)
export ydb_routines="$RoutinePath `$ydb_dist/plugin/o/utf8/_ydbposix.so `$ydb_dist/utf8/libyottadbutil.so"
"@

foreach ($rtn in $installRoutines) {
  $mFile = Join-Path $mRoutineDir "$rtn.m"
  if (!(Test-Path -LiteralPath $mFile)) {
    Write-Host "  SKIP: $rtn.m not found" -ForegroundColor Yellow
    continue
  }
  Write-Host "  Installing $rtn..." -NoNewline
  $cmd = "$envSetup && echo 'S DUZ=1,DUZ(0)=""@"" D INSTALL^$rtn H' | `$ydb_dist/mumps -dir 2>&1"
  $output = docker exec $ContainerName bash -c $cmd 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host " FAIL" -ForegroundColor Red
    Write-Host "    $output" -ForegroundColor Red
  } else {
    Write-Host " OK" -ForegroundColor Green
  }
}

# Step 3: Register all RPCs in OR CPRS GUI CHART context
Write-Host ""
Write-Host "Step 3: Registering RPCs in OR CPRS GUI CHART context..." -ForegroundColor Cyan
$ctxCmd = "$envSetup && echo 'S DUZ=1,DUZ(0)=""@"" D ADDALL^ZVECTXTA H' | `$ydb_dist/mumps -dir 2>&1"
$ctxOutput = docker exec $ContainerName bash -c $ctxCmd 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "  FAIL: ZVECTXTA" -ForegroundColor Red
  Write-Host "  $ctxOutput" -ForegroundColor Red
} else {
  Write-Host "  OK: Context registration complete" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Installation complete ===" -ForegroundColor Cyan
Write-Host "Re-run this script after 'docker compose down -v' or container rebuild." -ForegroundColor Yellow
