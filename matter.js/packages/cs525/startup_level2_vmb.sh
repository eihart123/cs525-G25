#!/bin/bash
set -x #echo on

# Run from the cs525 directory
cd /opt/matter/cs525-G25/matter.js/packages/cs525 2>/dev/null || true

# Now startup the VMB
./dist/esm/VirtualMatterBrokerNode.js --configFile vmb_level_2_config_1.json --storage-clear 2>&1 > vmb_level_2_1.log &
./dist/esm/VirtualMatterBrokerNode.js --configFile vmb_level_2_config_2.json --storage-clear 2>&1 > vmb_level_2_2.log &

sleep infinity
