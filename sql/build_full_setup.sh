#!/bin/sh
# Sinh lại 99_full_setup.sql bằng cách ghép 00..08. Chạy sau mỗi lần sửa một file nguồn:
#   sh database/build_full_setup.sh
# Không sửa tay 99_full_setup.sql.
set -e
cd "$(dirname "$0")"

FILES="00_database.sql 01_schema.sql 02_seed.sql 03_functions.sql 04_procedures.sql
05_triggers.sql 06_cursors.sql 07_reports.sql 08_security.sql"

{
    echo "-- 99. FULL SETUP: ghép 00..08 (không gồm 08b_create_users.sql, 09_smoke_test.sql, 10_regression_test.sql)"
    echo "-- File sinh tự động bằng build_full_setup.sh, KHÔNG sửa tay."
    first=1
    for f in $FILES; do
        [ $first -eq 1 ] || echo
        first=0
        echo
        echo "-- ===== $f ====="
        cat "$f"
    done
} > 99_full_setup.sql

echo "Da sinh 99_full_setup.sql ($(wc -l < 99_full_setup.sql) dong)"
