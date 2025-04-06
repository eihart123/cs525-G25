#!/bin/bash

# Run from the cs525 directory

npm run build

# Now startup the VMB
tmux new -d "/bin/sh -c 'node dist/esm/VirtualMatterBrokerNode.js -- --storage-clear'"

# 20 devices
for i in {10..29}; do
  # Try to start the server
  echo "Starting sensor $i..."
  DEVICE_ID=$i node dist/esm/SensorDeviceNode.js 2>&1 | cat > sensor-$i.log & 
done