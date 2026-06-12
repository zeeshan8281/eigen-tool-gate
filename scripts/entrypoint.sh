#!/bin/bash
set -e

# 1. Source EigenCompute sealed secrets (KMS-provided env) if present.
if [ -f "/usr/local/bin/compute-source-env.sh" ]; then
  source /usr/local/bin/compute-source-env.sh
fi

export PGDATA="${PGDATA:-/data/pgdata}"
export DATA_DIR="${DATA_DIR:-/data}"
mkdir -p "$PGDATA" "$DATA_DIR"
chown -R postgres:postgres /data
mkdir -p /var/run/postgresql
chown postgres:postgres /var/run/postgresql

# 2. Initialize PostgreSQL on first boot (on the TEE's encrypted volume).
if [ ! -f "$PGDATA/PG_VERSION" ]; then
  su postgres -c "initdb -D $PGDATA --auth-local=trust --auth-host=trust"
  echo "host all all 127.0.0.1/32 trust" >> "$PGDATA/pg_hba.conf"
  su postgres -c "pg_ctl -D $PGDATA -o '-c listen_addresses=127.0.0.1' -w start"
  su postgres -c "psql --command \"CREATE ROLE gate LOGIN SUPERUSER;\""
  su postgres -c "createdb -O gate gate"
else
  su postgres -c "pg_ctl -D $PGDATA -o '-c listen_addresses=127.0.0.1' -w start"
fi

# 3. Fail closed if the policy on disk no longer matches the sealed hash.
if [ "${POLICY_HASH:-unsealed}" != "unsealed" ]; then
  ACTUAL=$(node /app/dist/gate/seal.js --policy "${POLICY_PATH}" | grep 'Policy hash:' | awk '{print $3}')
  if [ "$ACTUAL" != "$POLICY_HASH" ]; then
    echo "FATAL: policy hash mismatch. sealed=${POLICY_HASH} actual=${ACTUAL}" >&2
    exit 1
  fi
  echo "[entrypoint] policy hash verified: ${POLICY_HASH}"
fi

# 4. Start the gate (schema is applied idempotently on boot).
exec node /app/dist/index.js
