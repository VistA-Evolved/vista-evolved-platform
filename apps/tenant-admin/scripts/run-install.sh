#!/bin/bash
# Run inside the VistA Docker container as root (not su - vista)
# to bypass the VistA login trap (XUS ACCEPT / NOPRINCIO).
set -e
export ydb_dist=/opt/yottadb/current
export ydb_gbldir=/opt/vista/g/vista.gld
export ydb_chset=UTF-8
export ydb_icu_version=$(pkg-config --modversion icu-io 2>/dev/null || echo 67.1)
export ydb_routines="/opt/vista/r $ydb_dist/plugin/o/utf8/_ydbposix.so $ydb_dist/utf8/libyottadbutil.so"

ROUTINES="ZVECLAVL ZVECLNM ZVEDEV ZVEHLFIL ZVEHSCOMP ZVEMGRP ZVETMCTL ZVEUCLONE ZVEUSMG ZVEWRDM"

for RTN in $ROUTINES; do
  echo -n "Installing $RTN... "
  echo "S DUZ=1,DUZ(0)=\"@\" D INSTALL^$RTN H" | $ydb_dist/mumps -dir 2>&1 | tail -5
  echo "done"
done

echo ""
echo "Registering RPCs in OR CPRS GUI CHART context..."
echo "S DUZ=1,DUZ(0)=\"@\" D ADDALL^ZVECTXTA H" | $ydb_dist/mumps -dir 2>&1 | tail -10
echo ""
echo "=== Installation complete ==="
