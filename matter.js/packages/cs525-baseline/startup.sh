#!/bin/bash
set -x

# Run from the cs525-baseline directory
cd /opt/matter/cs525-G25/matter.js/packages/cs525-baseline 2>/dev/null || true
npm run build

# 20 devices
for i in {5540..5559}; do
  # Try to start the server
  echo "Starting sensor $i..."
  rm sensor-$i.log 2>/dev/null || true
  PORT=$i node dist/esm/SensorDeviceNode.js -- --storage-clear 2>&1 | tee sensor-$i.log & 
done

sleep infinity
