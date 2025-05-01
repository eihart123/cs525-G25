#!/bin/bash
set -x #echo on

# Run from the cs525 directory
cd /opt/matter/cs525-G25/matter.js/packages/cs525 2>/dev/null || true

# Now startup the VMB
./dist/esm/VirtualMatterBrokerNode.js --configFile vmb_level_1_config.json --storage-clear 2>&1 > vmb_level_1.log &

sleep infinity
