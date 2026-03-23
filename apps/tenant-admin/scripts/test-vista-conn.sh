#!/bin/bash
# Test VistA connectivity from inside the container
source /opt/yottadb/current/ydb_env_set 2>/dev/null || true
echo 'W $$GET1^DIQ(200,"1,",.01)' | mumps -dir 2>&1 | tail -3
echo "---"
echo 'D DT^DICRW W DT' | mumps -dir 2>&1 | tail -3
echo "---"
echo 'W $O(^VA(200,0))' | mumps -dir 2>&1 | tail -3
