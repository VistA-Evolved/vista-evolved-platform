#!/bin/bash
# Install all custom ZVE* M routines into VistA
set -e

source /opt/yottadb/current/ydb_env_set
export ydb_gbldir=/opt/vista/g/vista.gld
export ydb_routines="/opt/vista/o*(/opt/vista/r) $ydb_routines"

echo "=== Installing ZVECLAVL ==="
yottadb -run %XCMD 'D INSTALL^ZVECLAVL'

echo "=== Installing ZVECLNM ==="
yottadb -run %XCMD 'D INSTALL^ZVECLNM'

echo "=== Installing ZVEDEV ==="
yottadb -run %XCMD 'D INSTALL^ZVEDEV'

echo "=== Installing ZVETMCTL ==="
yottadb -run %XCMD 'D INSTALL^ZVETMCTL'

echo "=== Installing ZVEHLFIL ==="
yottadb -run %XCMD 'D INSTALL^ZVEHLFIL'

echo "=== Installing ZVEMGRP ==="
yottadb -run %XCMD 'D INSTALL^ZVEMGRP'

echo "=== Installing ZVEHSCOMP ==="
yottadb -run %XCMD 'D INSTALL^ZVEHSCOMP'

echo "=== Installing ZVEUCLONE ==="
yottadb -run %XCMD 'D INSTALL^ZVEUCLONE'

echo "=== Installing ZVEUSMG ==="
yottadb -run %XCMD 'D INSTALL^ZVEUSMG'

echo "=== Installing ZVEWRDM ==="
yottadb -run %XCMD 'D INSTALL^ZVEWRDM'

echo "=== ZVEMENUTREE (no INSTALL needed - read-only probe) ==="
echo "  Run: D WALK^ZVEMENUTREE for full tree"
echo "  Run: D ADMIN^ZVEMENUTREE for admin summary"

echo "=== ZVEKEYSCAN (no INSTALL needed - read-only probe) ==="
echo "  Run: D SCAN^ZVEKEYSCAN for all keys with holder counts"
echo "  Run: D KEYHOLDERS^ZVEKEYSCAN(\"XUMGR\") for holders of specific key"

echo ""
echo "=== All routines installed ==="
