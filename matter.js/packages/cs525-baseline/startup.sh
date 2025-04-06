#!/bin/bash

# Run from the cs525-baseline directory

npm run build

# 20 devices
for i in {10..29}; do
  # Try to start the server
  echo "Starting sensor $i..."
  DEVICE_ID=$i node dist/esm/SensorDeviceNode.js 2>&1 | cat > sensor-$i.log & 
done
