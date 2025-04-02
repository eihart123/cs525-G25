#!/bin/bash

# Run from the cs525-baseline directory

npm run build

# 1000 devices
for i in {10..10}; do
  # Try to start the server
  echo "Starting sensor $i..."
  DEVICE_ID=$i node dist/esm/BridgedDevicesNode.js &
done

# killall node
