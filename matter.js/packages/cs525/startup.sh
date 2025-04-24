#!/bin/bash

# Run from the cs525 directory

npm run build

# Now startup the VMB
nohup node dist/esm/VirtualMatterBrokerNode.js -- --storage-clear 2>&1 > vmb.log &

# 20 devices
for i in {10..29}; do
  # Try to start the server
  echo "Starting sensor $i..."
  DEVICE_ID=$i nohup node dist/esm/SensorDeviceNode.js -- --storage-clear 2>&1 > sensor-$i.log & 
done