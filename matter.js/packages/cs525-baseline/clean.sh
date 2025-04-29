set -x #echo on

killall node
rm -rf /opt/matter/cs525-G25/matter.js/packages/cs525/*.log || true
rm -rf /opt/matter/cs525-G25/matter.js/packages/cs525-baseline/*.log || true
rm -rf ~/.matter/controller-baseline
rm -rf ~/.matter/1*
rm -fr ~/.matter/device-*