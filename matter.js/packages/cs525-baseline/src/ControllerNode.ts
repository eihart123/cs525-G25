#!/usr/bin/env node
/**
 * @license
 * Copyright 2022-2025 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * This example shows how to create a Matter controller to pair with a device and interfact with it.
 * It can be used as CLI script, but is more thought as a starting point for your own controller implementation
 * because you need to adjust the code in any way depending on your use case.
 */

import { Environment, Logger, singleton, StorageService, Time } from "@matter/main";
import { BasicInformationCluster, DescriptorCluster, GeneralCommissioning, OnOff, TemperatureMeasurement } from "@matter/main/clusters";

import { Ble, ClusterClientObj, ControllerCommissioningFlowOptions } from "@matter/main/protocol";
import { ManualPairingCodeCodec, NodeId } from "@matter/main/types";
import { NodeJsBle } from "@matter/nodejs-ble";
import { CommissioningController, NodeCommissioningOptions } from "@project-chip/matter.js";
import { NodeStates } from "@project-chip/matter.js/device";
import { appendFile } from 'fs';

const logger = Logger.get("Controller");
const numDevices = 20; // Number of devices to commission

const environment = Environment.default;
Logger.level = "debug";

if (environment.vars.get("ble")) {
    // Initialize Ble
    Ble.get = singleton(
        () =>
            new NodeJsBle({
                hciId: environment.vars.number("ble.hci.id"),
            }),
    );
}

const storageService = environment.get(StorageService);

console.log(`Storage location: ${storageService.location} (Directory)`);
logger.info(
    'Use the parameter "--storage-path=NAME-OR-PATH" to specify a different storage location in this directory, use --storage-clear to start with an empty storage.',
);

const vm_addresses = [
    {name: "vm2", ip: "fe80::250:56ff:fe8c:57da" }, // VM 2
    {name: "vm3", ip: "fe80::250:56ff:fe8c:dc43" },
    {name: "vm4", ip: "fe80::250:56ff:fe8c:34c3" },
    {name: "vm5", ip: "fe80::250:56ff:fe8c:50b4" },
    {name: "vm6", ip: "fe80::250:56ff:fe8c:bfd9" },
    {name: "vm7", ip: "fe80::250:56ff:fe8c:69e1" },
    {name: "vm8", ip: "fe80::250:56ff:fe8c:cc0b" },
    {name: "vm9", ip: "fe80::250:56ff:fe8c:9744" },
    {name: "vm10", ip:"fe80::250:56ff:fe8c:d55" },
    {name: "vm11", ip:"fe80::250:56ff:fe8c:1ec1" },
    {name: "vm12", ip:"fe80::250:56ff:fe8c:1814" },
    {name: "vm13", ip:"fe80::250:56ff:fe8c:643e" },
    {name: "vm14", ip:"fe80::250:56ff:fe8c:b863" },
    {name: "vm15", ip:"fe80::250:56ff:fe8c:7b42" },
    {name: "vm16", ip:"fe80::250:56ff:fe8c:6c49" },
    {name: "vm17", ip:"fe80::250:56ff:fe8c:4ebd" },
    {name: "vm18", ip:"fe80::250:56ff:fe8c:c3b8" },
    {name: "vm19", ip:"fe80::250:56ff:fe8c:7915" },
    {name: "vm20", ip:"fe80::250:56ff:fe8c:8ca6" }
]

const all_endnodes = vm_addresses.flatMap((vm) => {
    const endnodes: any = [];
    for (let i = 0; i < numDevices; i++) {
        endnodes.push({
            name: `${vm.name}-${i}`,
            ip: vm.ip,
            port: 5540 + i,
        });
    }
    return endnodes;
})


class ControllerNode {
    async start() {
        logger.info(`node-matter Controller started`);

        /**
         * Collect all needed data
         *
         * This block makes sure to collect all needed data from cli or storage. Replace this with where ever your data
         * come from.
         *
         * Note: This example also uses the initialized storage system to store the device parameter data for convenience
         * and easy reuse. When you also do that be careful to not overlap with Matter-Server own contexts
         * (so maybe better not ;-)).
         */

        const controllerStorage = (await storageService.open("controller-baseline")).createContext("data");
        const ip = (await controllerStorage.has("ip"))
            ? await controllerStorage.get<string>("ip")
            : environment.vars.string("ip");
        const port = (await controllerStorage.has("port"))
            ? await controllerStorage.get<number>("port")
            : environment.vars.number("port");
        const uniqueId = (await controllerStorage.has("uniqueid"))
            ? await controllerStorage.get<string>("uniqueid")
            : (environment.vars.string("uniqueid") ?? Time.nowMs().toString());
        await controllerStorage.set("uniqueid", uniqueId);
        const adminFabricLabel = (await controllerStorage.has("fabriclabel"))
            ? await controllerStorage.get<string>("fabriclabel")
            : (environment.vars.string("fabriclabel") ?? "matter.js Controller");
        await controllerStorage.set("fabriclabel", adminFabricLabel);

        const pairingCode = environment.vars.string("pairingcode");
        let longDiscriminator: number | undefined, setupPin, shortDiscriminator;
        if (pairingCode !== undefined) {
            const pairingCodeCodec = ManualPairingCodeCodec.decode(pairingCode);
            shortDiscriminator = pairingCodeCodec.shortDiscriminator;
            longDiscriminator = undefined;
            setupPin = pairingCodeCodec.passcode;
            logger.debug(`Data extracted from pairing code: ${Logger.toJSON(pairingCodeCodec)}`);
        } else {
            longDiscriminator =
                environment.vars.number("longDiscriminator") ??
                (await controllerStorage.get("longDiscriminator", 10));
            if (longDiscriminator > 4095) throw new Error("Discriminator value must be less than 4096");
            setupPin = environment.vars.number("pin") ?? (await controllerStorage.get("pin", 20202021));
        }
        if ((shortDiscriminator === undefined && longDiscriminator === undefined) || setupPin === undefined) {
            throw new Error(
                "Please specify the longDiscriminator of the device to commission with -longDiscriminator or provide a valid passcode with -passcode",
            );
        }

        // Collect commissioning options from commandline parameters
        const commissioningOptions: ControllerCommissioningFlowOptions = {
            regulatoryLocation: GeneralCommissioning.RegulatoryLocationType.IndoorOutdoor,
            regulatoryCountryCode: "XX",
        };

        let ble = false;

        /** Create Matter Controller Node and bind it to the Environment. */
        const commissioningController = new CommissioningController({
            environment: {
                environment,
                id: uniqueId,
            },
            autoConnect: false, // Do not auto connect to the commissioned nodes
            adminFabricLabel,
        });
        
        /** Start the Matter Controller Node */
        await commissioningController.start();
        
        console.log(
          commissioningController.controllerInstance?.exchangeManager.transmissionMetadata
        )
        // When we do not have a commissioned node we need to commission the device provided by CLI parameters
        if (!commissioningController.isCommissioned()) {
          // Map to options
          var myList: Array<NodeCommissioningOptions> = [];
          for (var i = 0; i < all_endnodes.length; i++) {
            const { name, ip, port } = all_endnodes[i];
            const options: NodeCommissioningOptions = {
                commissioning: commissioningOptions,
                discovery: {
                    knownAddress: { ip, port, type: "udp" },
                    identifierData: {},
                    discoveryCapabilities: {},
                },
                passcode: setupPin,
            };
            myList.push(options);
          }

          // Measure commissioning time
          // Commission the node using the options
          const startTime = Date.now();

          // delay startup
          await new Promise(resolve => setTimeout(resolve, 2000));

          // start commissioning each node in batches of 20 every 5 seconds
          const allPromises = [];
          for (let i = 0; i < myList.length; i += 20) {
            const batch = myList.slice(i, i + 20);
            logger.info(`Commissioning batch ${Math.floor(i / 20) + 1} of ${Math.ceil(myList.length / 20)}`);
            const batchPromises = batch.map(options => {
              try {
                commissioningController.commissionNode(options)
                .then(result => {
                  logger.info(`Commissioning done successfully for node ${result}`);
                  return result;
                })
              } catch (error) {
                logger.error(`Commissioning failed for node ${options}: ${error}`);
                return Promise.reject(error); // Reject the promise to handle errors
              }
            });
            allPromises.push(...batchPromises);
            await new Promise(resolve => setTimeout(resolve, 5000 + 1000)); // Wait for 5 seconds before commissioning the next batch
          }
          try {
              await Promise.all(allPromises);
          } catch (error) {
            logger.error('This is unexpected...')
          }
          const endTime = Date.now();
          const commissioningTime = endTime - startTime;
          logger.info(`Commissioning for batch ${Math.floor(i / 20) + i} completed in ${commissioningTime}ms`);
          // await Promise.all(myList.map(async (options) => {
          //   const nodeId = await commissioningController.commissionNode(options);
          //   console.log(`Commissioning successfully done with nodeId ${nodeId}`);
          // }))
        }

        // After commissioning or if we have a commissioned node we can connect to it
        try {
            const nodes = commissioningController.getCommissionedNodes();
            console.log("Found commissioned nodes:", Logger.toJSON(nodes));

            const nodeId = NodeId(environment.vars.number("nodeid") ?? nodes[0]);
            if (!nodes.includes(nodeId)) {
                throw new Error(`Node ${nodeId} not found in commissioned nodes`);
            }

            const nodeDetails = commissioningController.getCommissionedNodesDetails();
            console.log("Commissioned nodes details:", Logger.toJSON(nodeDetails.find(node => node.nodeId === nodeId)));

            // Get the node instance
            const node = await commissioningController.getNode(nodeId);

            // Subscribe to events of the node
            node.events.attributeChanged.on(({ path: { nodeId, clusterId, endpointId, attributeName }, value }) =>
                console.log(
                    `attributeChangedCallback ${nodeId}: Attribute ${endpointId}/${clusterId}/${attributeName} changed to ${Logger.toJSON(
                        value,
                    )}`,
                ),
            );
            node.events.eventTriggered.on(({ path: { nodeId, clusterId, endpointId, eventName }, events }) =>
                console.log(
                    `eventTriggeredCallback ${nodeId}: Event ${endpointId}/${clusterId}/${eventName} triggered with ${Logger.toJSON(
                        events,
                    )}`,
                ),
            );
            node.events.stateChanged.on(info => {
                switch (info) {
                    case NodeStates.Connected:
                        console.log(`state changed: Node ${nodeId} connected`);
                        break;
                    case NodeStates.Disconnected:
                        console.log(`state changed: Node ${nodeId} disconnected`);
                        break;
                    case NodeStates.Reconnecting:
                        console.log(`state changed: Node ${nodeId} reconnecting`);
                        break;
                    case NodeStates.WaitingForDeviceDiscovery:
                        console.log(`state changed: Node ${nodeId} waiting for device discovery`);
                        break;
                }
            });
            node.events.structureChanged.on(() => {
                console.log(`Node ${nodeId} structure changed`);
            });

            // Connect to the node if not already connected, this will automatically subscribe to all attributes and events
            if (!node.isConnected) {
                node.connect();
            }

            // Wait for initialization oif not yet initialized - this should only happen if we just commissioned it
            if (!node.initialized) {
                await node.events.initialized;
            }

            // Or use this to wait for full remote initialization and reconnection.
            // Will only return when node is connected!
            // await node.events.initializedFromRemote;

            node.logStructure();

            // Example to initialize a ClusterClient and access concrete fields as API methods
            const descriptor = node.getRootClusterClient(DescriptorCluster);
            if (descriptor !== undefined) {
                console.log(await descriptor.attributes.deviceTypeList.get()); // you can call that way
                console.log(await descriptor.getServerListAttribute()); // or more convenient that way
            } else {
                console.log("No Descriptor Cluster found. This should never happen!");
            }

            // Example to subscribe to a field and get the value
            const info = node.getRootClusterClient(BasicInformationCluster);
            if (info !== undefined) {
                console.log(await info.getProductNameAttribute()); // This call is executed remotely
                //console.log(await info.subscribeProductNameAttribute(value => console.log("productName", value), 5, 30));
                //console.log(await info.getProductNameAttribute()); // This call is resolved locally because we have subscribed to the value!
            } else {
                console.log("No BasicInformation Cluster found. This should never happen!");
            }

            // Example to get all Attributes of the commissioned node: */*/*
            //const attributesAll = await interactionClient.getAllAttributes();
            //console.log("Attributes-All:", Logger.toJSON(attributesAll));

            // Example to get all Attributes of all Descriptor Clusters of the commissioned node: */DescriptorCluster/*
            //const attributesAllDescriptor = await interactionClient.getMultipleAttributes([{ clusterId: DescriptorCluster.id} ]);
            //console.log("Attributes-Descriptor:", JSON.stringify(attributesAllDescriptor, null, 2));

            // Example to get all Attributes of the Basic Information Cluster of endpoint 0 of the commissioned node: 0/BasicInformationCluster/*
            //const attributesBasicInformation = await interactionClient.getMultipleAttributes([{ endpointId: 0, clusterId: BasicInformationCluster.id} ]);
            //console.log("Attributes-BasicInformation:", JSON.stringify(attributesBasicInformation, null, 2));

            const devices = node.getDevices();
            for (const device of devices) {
                console.log(`Device ${device.number} found with type: ${device.deviceType}`);
                // const clients = device.getAllClusterClients();
                // console.log(clients);
                const temperatureMeasurement = device.getClusterClient(TemperatureMeasurement.Complete);
                if (!temperatureMeasurement) {
                    console.log(`Device ${device.number} does not support Temperature Measurement`);
                    continue; // Skip if Temperature Measurement is not supported
                }
                // console.log(temperatureMeasurement)
                temperatureMeasurement.addMeasuredValueAttributeListener((value: number | null) => {
                    // This listener will be called whenever the measured value changes
                    console.log(`Device ${device.number} Temperature Measurement changed to: ${value}`);
                })
                const minInterval = 1
                const maxInterval = 10
                await temperatureMeasurement.subscribeMeasuredValueAttribute((value: number | null) => {
                  console.log(`Device ${device.number} Temperature Measurement subscription to: ${value}`);

                    const totalIn = Object.entries(commissioningController.controllerInstance?.exchangeManager.transmissionMetadata || {}).reduce((acc, [key, value]) => {
                        return acc + value;
                    }, 0);
                    const totalOut = Object.entries(commissioningController.controllerInstance?.exchangeManager.transmissionMetadataOut || {}).reduce((acc, [key, value]) => {
                        return acc + value;
                    }, 0);

                    const data = `${Date.now()}, in ${totalIn}, out ${totalOut}\n`;
                    appendFile('results_baseline.txt', data, (err) => {
                      if (err) throw err;
                      console.log('The file has been saved!');
                    });

                  console.log(
                    commissioningController.controllerInstance?.exchangeManager.transmissionMetadata
                  )
                  console.log(
                    commissioningController.controllerInstance?.exchangeManager.transmissionMetadataOut
                  )
                }, minInterval, maxInterval)
                // attributes.measuredValue
                // getMeasuredValueAttribute
                // subscribeMeasuredValueAttribute
                // endpointId
                // if (temperatureMeasurement) {
                //     // Example to get the measuredValue from TemperatureMeasurement cluster
                //     const measuredValue = await temperatureMeasurement.getMeasuredValueAttribute();
                //     console.log(`Device ${device.number} Temperature Measurement: ${measuredValue}`);
                // } else {
                //     console.log(`Device ${device.number} does not support Temperature Measurement`);
                // }
            }
            // if (devices[0] && devices[0].number === 1) {
            //     // Example to subscribe to all Attributes of endpoint 1 of the commissioned node: */*/*
            //     //await interactionClient.subscribeMultipleAttributes([{ endpointId: 1, /* subscribe anything from endpoint 1 */ }], 0, 180, data => {
            //     //    console.log("Subscribe-All Data:", Logger.toJSON(data));
            //     //});

            //     const onOff: ClusterClientObj<OnOff.Complete> | undefined = devices[0].getClusterClient(OnOff.Complete);
            //     if (onOff !== undefined) {
            //         let onOffStatus = await onOff.getOnOffAttribute();
            //         console.log("initial onOffStatus", onOffStatus);

            //         onOff.addOnOffAttributeListener(value => {
            //             console.log("subscription onOffStatus", value);
            //             onOffStatus = value;
            //         });
            //         // read data every minute to keep up the connection to show the subscription is working
            //         setInterval(() => {
            //             onOff
            //                 .toggle()
            //                 .then(() => {
            //                     onOffStatus = !onOffStatus;
            //                     console.log("onOffStatus", onOffStatus);
            //                 })
            //                 .catch(error => logger.error(error));
            //         }, 60000);
            //     }
            // }
        } catch (error) {
            logger.error("Error during commissioning or connecting to node:", error);
        }
        // finally {
        //     //await matterServer.close(); // Comment out when subscribes are used, else the connection will be closed
        //     setTimeout(() => process.exit(0), 1000000);
        // }
    }
}

new ControllerNode().start().catch(error => logger.error(error));
