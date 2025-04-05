#!/usr/bin/env node
/**
 * @license
 * Copyright 2022-2025 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * This example shows how to create a new device node that is composed of multiple devices.
 * It creates multiple endpoints on the server. For information on how to add a composed device to a bridge please
 * refer to the bridge example!
 * It can be used as CLI script and starting point for your own device node implementation.
 */

import { CommissioningController, CommissioningControllerOptions, NodeCommissioningOptions } from "@project-chip/matter.js";

import { Endpoint, EndpointServer, MutableEndpoint, ServerNode } from "@matter/node";
// BridgedDeviceBasicInformationServer, OnOffLightDevice, OnOffPlugInUnitDevice, 
// "#endpoints/*": "./src/endpoints/*.js",
import { AggregatorEndpoint } from "@matter/node/endpoints/aggregator";
import { AggregatedStatsBehavior, AggregatedStatsServer } from "@matter/node/behaviors/aggregated-stats";
import { TemperatureMeasurementServer } from "@matter/node/behaviors";
import { BridgedDeviceBasicInformationServer } from "@matter/node/behaviors/bridged-device-basic-information";
// import { OnOffLightDevice, OnOffPlugInUnitDevice } from "@matter/main/devices"
import { TemperatureSensorDevice } from "@matter/node/devices";

import { Diagnostic, Environment, Logger, StorageService, StorageContext, StorageManager, Time } from "@matter/main";
import { DescriptorCluster, GeneralCommissioning } from "@matter/main/clusters";
import { AttributeList } from "@matter/types/clusters/aggregated-stats";
import { type AggregatedRecord, AggregateInterval, AggregateIntervals, AggregatedAttribute } from "@matter/types/clusters/aggregated-stats";

import { NodeId, VendorId, Cluster, ClusterId, ClusterRegistry } from "@matter/types";
// import { logEndpoint } from "#main/protocol";
import { execSync } from "node:child_process";
import { DescriptorServer } from "@matter/node/behaviors";
// import { Attribute, Cluster, Command, Event } from "./Cluster.js";
const logger = Logger.get("VirtualMatterBrokerNode");
Logger.level = "info";

const NUM_DEVICES = 1;

const environment = Environment.default;
const storageService = environment.get(StorageService);

console.log(`Storage location: ${storageService.location} (Directory)`);

// The Virtual Matter Broker (VMB) is a Matter device that acts as a bridge
// between two Matter networks. On the south side, it acts as a Matter controller
// and pairs with other Matter nodes. On the north side, it acts as a Matter Bridge device
// which can be added by an additional Matter controller.
//
// The Bridge device (aggregator) will effectively "forward" the nodes from the
// south side to the north side.

class ProxiedTemperatureMeasurementServer extends TemperatureMeasurementServer {
    
}

interface Datapoint {
    value: number;
    timestamp: number;
}

interface RiemannData {
    sum: number;
}
interface MoreDatapoint extends Record<AggregatedAttribute, RiemannData>{
    latest: Datapoint;
}
/*
{
    10: riemannSum
    60, riemannSum2
    latest: {
        value: 0,
        timestamp: 0
    }
}
 */
type ClusterPlusAttribute = string
// EndpointID <-> Datapoint
type EndpointDataRecord = Record<ClusterPlusAttribute, Record<string, MoreDatapoint>>
class VirtualMatterBrokerNode {
    instanceNodeId: string;
    #vmbStorageManager: StorageManager;
    #controller: CommissioningController;
    #controllerStorage: StorageContext;
    #aggregator: Endpoint<AggregatorEndpoint>;
    #aggregatorStorage: StorageContext;
    // When the interval was last fired
    #lastIntervalFired: Record<AggregateInterval, number>;
    // Data is the inputs from the south side
    #aggregatorData: EndpointDataRecord;
    // Attributes is the final computed stuff
    #aggregatorAttributes: Record<string, number>;
    /**
    
    Create an internal controller C2. The internal controller should directly pair with the end device.
    After the device is paired, it should create an virtual endpoint dynamically with .add.
    Then, we should add the virtual endpoint to an unpaired aggregator.

    This unpaired aggregator, when paired with the root controller, will give device discovery capabilities
    to the root controller.
     */

    async #initController() {
        // Configure commissioning options
        this.#controllerStorage = this.#vmbStorageManager.createContext("south-controller");
        const uniqueId = (await this.#controllerStorage.has("uniqueid"))
            ? await this.#controllerStorage.get<string>("uniqueid")
            : (environment.vars.string("uniqueid") ?? Time.nowMs().toString());
        await this.#controllerStorage.set("uniqueid", uniqueId);
        const adminFabricLabel = (await this.#controllerStorage.has("fabriclabel"))
            ? await this.#controllerStorage.get<string>("fabriclabel")
            : (environment.vars.string("fabriclabel") ?? `vmb-${this.instanceNodeId}`);

        // Create CommissioningController
        const commissionerOptions: CommissioningControllerOptions = {
            environment: {
                environment,
                id: uniqueId,
            },
            autoConnect: false,
            adminFabricLabel,
        };
        this.#controller = new CommissioningController(commissionerOptions);
        this.#lastIntervalFired = {}
        // Start the controller
        await this.#controller.start();
    }

    async #initAggregator() {
        this.#aggregatorStorage = this.#vmbStorageManager.createContext("north-aggregator");

        const deviceName = "My First Broker Bridge";
        const vendorName = "CS 525 G25";
        const passcode = await this.#aggregatorStorage.get("passcode", 20250525);
        const discriminator = await this.#aggregatorStorage.get("discriminator", 3840);
        // product name / id and vendor id should match what is in the device certificate
        const vendorId = await this.#aggregatorStorage.get("vendorid", 0xfff1);
        // const productName = `node-matter OnOff ${isSocket ? "Socket" : "Light"}`;
        const productName = "Factory Broker 9000";
        const productId = await this.#aggregatorStorage.get("productid", 0x8000);

        const port = environment.vars.number("port") ?? 5540;

        const uniqueId = await this.#aggregatorStorage.get("uniqueid", Time.nowMs().toString());

        // Persist basic data to keep them also on restart
        await this.#aggregatorStorage.set({
            passcode,
            discriminator,
            vendorid: vendorId,
            productid: productId,
            uniqueid: uniqueId,
        });

        // Create Matter server node
        const server = await ServerNode.create({
            id: uniqueId,
            network: {
                port,
            },
            commissioning: {
                passcode,
                discriminator,
            },
            productDescription: {
                name: deviceName,
                deviceType: AggregatorEndpoint.deviceType,
            },
            basicInformation: {
                vendorName,
                vendorId: VendorId(vendorId),
                nodeLabel: productName,
                productName,
                productLabel: productName,
                productId,
                serialNumber: `matterjs-${uniqueId}`,
                uniqueId,
            },
        });

        // Create aggregator endpoint
        this.#aggregator = new Endpoint(AggregatorEndpoint.with(AggregatedStatsServer), { id: "aggregator" });
        await server.add(this.#aggregator);

        server.behaviors.require(AggregatedStatsBehavior);

        // Start the server
        await server.start();
        console.log(`Matter server started on port ${port}`);
    }

    async start(instanceNodeId: string) {
        if (!instanceNodeId) throw new Error("Missing instance node id");
        this.instanceNodeId = instanceNodeId;
        this.#vmbStorageManager = (await storageService.open(`vmb-${this.instanceNodeId}`));

        this.#aggregatorData = {};

        // South side initialization
        await this.#initController();
        // North side initialization
        await this.#initAggregator();

        // Setup a timer to recalculate aggregates
        for (const length of AggregateIntervals) {
            console.log(`Setting up interval for ${length} seconds`);
            const interval = parseInt(length)
            this.#lastIntervalFired[length] = Date.now()
            setInterval(async () => {
                logger.info(`Recalculating aggregates for ${length} seconds interval`);
                await this.recalculateAggregatesFor(length as AggregateInterval);
            }, 1000 * interval);
        }
    }

    async pairNode(i: number) {
        let longDiscriminator, setupPin;
        longDiscriminator = await this.#controllerStorage.get("longDiscriminator", 0);
        if (longDiscriminator > 4095) throw new Error("Discriminator value must be less than 4096");
        setupPin = await this.#controllerStorage.get("pin", 20202021);

        // TODO: Commission the node
        const options: NodeCommissioningOptions = {
            commissioning: {
                regulatoryLocation: GeneralCommissioning.RegulatoryLocationType.IndoorOutdoor,
                regulatoryCountryCode: "XX",
            },
            discovery: {
                /* We will use auto-discovery with a discriminator */
                knownAddress: undefined,
                identifierData: { longDiscriminator: longDiscriminator + i },
            },
            passcode: setupPin,
        };

        // TODO: on commission, update the aggregator endpoint with the new node
        const nodeId = await this.#controller.commissionNode(options);
        this.onNodeCommission(nodeId);

        // Connect the node
        const node = await this.#controller.getNode(nodeId);
        if (node && !node.isConnected) {
            node.connect();
        }
    }

    async recalculateAggregatesFor(intervalSec: AggregateInterval) {
        /**
         * This function is called every intervalSec seconds.
         */

        const now = Date.now();
        console.log(this.#aggregatorData)
        // attribute: [{ sum: XXX, endpointId: YYY }]
        const dataFilteredByInterval: Record<string, { sum: number, endpointId: string }[]> = {}
        for (const [key, value] of Object.entries(this.#aggregatorData)) {
            const rawAttribute = key.split(".")[1];
            // Riemann sum (approximating the area under the curve) by the length of the interval (b - a)

            // Uppercase the first letter of the attribute name.
            const attribute = rawAttribute.charAt(0).toUpperCase() + rawAttribute.slice(1) as AggregatedAttribute;
            
            // Map each attribute for the interval we are interested in
            if (!Object.hasOwn(dataFilteredByInterval, attribute)) {
                dataFilteredByInterval[attribute] = [];
            }

            for (const [endpointId, datapoint] of Object.entries(value)) {
                dataFilteredByInterval[attribute].push({
                    sum: datapoint[intervalSec]?.sum || 0,
                    endpointId,
                })
            }
            
        }
        logger.info({ dataFilteredByInterval }, "Data grouped by attribute");

        // Calculate average, min, max
        for (const [attribute, value] of Object.entries(dataFilteredByInterval)) {
            const sums = value.map((endpointData) => endpointData.sum)
            const sum_of_sums = sums.reduce((acc, val) => acc + val, 0);
            // Divide by the number of endpoints
            // Divide by the size of the interval
            logger.info({ sum_of_sums }, `sums for ${attribute}`);
            const avg = sum_of_sums / value.length / parseInt(`${intervalSec}`);

            // These need to start lowercase (set syntax)
            const aggregatedStats = {
                [`average${attribute}${intervalSec}`]: avg,
            } as AggregatedRecord

            console.info({ aggregatedStats }, `Aggregated stats for interval ${intervalSec}s`);

            await this.#aggregator.set({
                // @ts-ignore
                aggregatedStats,
            });
        }

        // reset the interval
        this.#lastIntervalFired[intervalSec] = Date.now()

        // Cleanup the riemann sums
        for (const [key, value] of Object.entries(this.#aggregatorData)) {
            const clusterPlusAttribute = key as ClusterPlusAttribute
            for (const [endpointId, datapoint] of Object.entries(value)) {
                // Reset the riemann sum to 0
                this.#aggregatorData[clusterPlusAttribute][endpointId][intervalSec] = { sum: 0 }
            }
        }
        

    }
    // Create a virtual node/endpoints (use Node Label) in the aggregator
    async onNodeCommission(nodeId: NodeId) {
        // Query the original node for all its endpoints
        // (await this.#controller.getNode(nodeId)).getDevices()
        const commissionedNodes = this.#controller.getCommissionedNodes()
        console.log(`Commissioned nodes: [${commissionedNodes}]`);
        const details = this.#controller.getCommissionedNodesDetails()
        const detailsForNode = details.find((node) => node.nodeId === nodeId);
        if (detailsForNode === undefined) {
            throw new Error("Node not found in commissioned nodes details");
        }
        console.log(`Commissioned nodes details: ${Diagnostic.json(details)}`);
        console.log(detailsForNode.advertisedName);

        const node = await this.#controller.getNode(nodeId);
        console.log(`Node: ${Diagnostic.json(node)}`);

        // Create a "proxy" endpoint for the node
        const proxy_endpoint = new Endpoint(
            TemperatureSensorDevice.with(BridgedDeviceBasicInformationServer),
            {
                id: `ple-${nodeId}`,
                bridgedDeviceBasicInformation: {
                    nodeLabel: detailsForNode.advertisedName, // Main end user name for the device
                    productName: detailsForNode.advertisedName,
                    productLabel: detailsForNode.advertisedName,
                    serialNumber: `node-matter-${nodeId}`,
                    reachable: true,
                },
            }
        );

        // Add the proxy endpoint to the aggregator endpoint
        // This allows visibility of the proxy endpoint on the north side of the bridge,
        // which is technically visibility of the south node
        await this.#aggregator.add(proxy_endpoint);

        // Add handler on south controller so that when a south node has an
        // attribute changed, it will update the proxy endpoint on the north side
        /** 
        node.events.eventTriggered.on(({ path: { nodeId, clusterId, endpointId, eventName }, events }) =>
                console.log(
                    `eventTriggeredCallback ${nodeId}: Event ${endpointId}/${clusterId}/${eventName} triggered with ${Logger.toJSON(
                        events,
                    )}`,
                ),
            );
         */
        node.events.attributeChanged.on(async ({ path: { clusterId, endpointId, attributeName }, value }) => {
            console.log(
                `attributeChangedCallback ${nodeId}: Attribute ${endpointId}/${clusterId}/${attributeName} changed to ${Logger.toJSON(
                    value,
                )}`,
            );
            // const actualEndpoint = (await this.#controller.getNode(nodeId)).getDeviceById(endpointId)
            // const onOffValue = endpoint.state.onOff.onOff;

            const cluster = ClusterRegistry.get(clusterId);
            if (!cluster) {
                throw new Error(`No such clusterID '${clusterId}'`);
            }
            const clusterNameProperty = cluster.name.charAt(0).toLowerCase() + cluster.name.slice(1)
            const proxiedClusters = [
                'TemperatureMeasurement'
            ]

            // This is all attributes we want to match against
            const aggregatedAttributes: string[] = []
            for (const cluster of proxiedClusters) {
                for (const attribute of AttributeList) {
                    const attributeNameProperty = attribute.charAt(0).toLowerCase() + attribute.slice(1)
                    aggregatedAttributes.push(`${cluster}.${attributeNameProperty}`)
                }
            }

            // This is the attribute we got from the event
            const clusterPlusAttribute = `${cluster.name}.${attributeName}`

            logger.info(`Cluster: ${cluster.name}, Attribute: ${attributeName}, Value: ${value}`)
            logger.info(`ClusterPlusAttribute: ${clusterPlusAttribute}`)
            logger.info(`AggregatedAttributes: ${aggregatedAttributes}`)

            if (aggregatedAttributes.includes(clusterPlusAttribute)) {
                logger.info(`${clusterPlusAttribute} matched an aggregated Attribute, updating tracked metadata`)
                if (!Object.hasOwn(this.#aggregatorData, clusterPlusAttribute)) {
                    const empty: Record<string, MoreDatapoint> = {}
                    this.#aggregatorData[clusterPlusAttribute] = empty;
                }
                const timestamp = Date.now()
                this.#aggregatorData[clusterPlusAttribute][endpointId] = {
                    ...this.#aggregatorData[clusterPlusAttribute][endpointId],
                    latest: {
                        value,
                        timestamp
                    },
                }
                
                // With this value, we want to update our riemann sums
                for (const length of AggregateIntervals) {
                    const previousArea = this.#aggregatorData[clusterPlusAttribute][endpointId]?.[length]?.sum || 0
                    const area = value * ((timestamp - this.#lastIntervalFired[length]) / 1000)
                    this.#aggregatorData[clusterPlusAttribute][endpointId][length] = {
                        sum: previousArea + area,
                    }
                }
            } else {
                logger.info(`${clusterPlusAttribute} did not match an aggregated Attribute`)
            }

            // Update the proxy endpoint
            if (proxiedClusters.includes(cluster.name)) {
                // These need to start lowercase (set syntax)
                await proxy_endpoint.set({
                    [clusterNameProperty]: {
                        [attributeName]: value
                    }
                })
            } else {
                logger.info(`Cluster ${cluster.name} is not proxied, not updating proxy endpoint`)
            }
        });


        // const devices = node.getDevices();
        // console.log(`Devices: ${devices[0]}`);

        // const rootEndpoint = node.getRootEndpoint()
        // const endpoints = rootEndpoint?.getChildEndpoints() ?? [];
        // const descriptor = node.getRootClusterClient(DescriptorCluster);
        // const descriptorServer = node.getRootClusterServer(DescriptorCluster);
        // if (descriptorServer === undefined) {
        //     throw new Error("Descriptor server not found");
        // }
        // const partsList = (await descriptor?.attributes.partsList.get()) ?? [];
        // console.log(`old PartsList: [${partsList}]`);

        // for (const part of partsList) {
        //     console.log(`Part: ${part}`);
        //     // Get the endpoint corresponding to the part number
        //     const endpoint = endpoints.find((ep) => ep.number === part);
        //     if (endpoint) {
        //         console.log(`Endpoint name for part ${part}: ${endpoint.name}`);
        //     }
        // }

        // const endpointNumbers = endpoints.map((endpoint) => {
        //     const number = endpoint.number
        //     if (number === undefined) {
        //         throw new Error("Endpoint number is undefined");
        //     }
        //     return number;
        // });
        // descriptor?.attributes.partsList.set(endpointNumbers);
        // console.log(`new PartsList: [${await (descriptor?.attributes.partsList.get())}]`);
        // Compose
    }
}

async function main() {
    // Create a new instance of the VirtualMatterBrokerNode
    const vmb = new VirtualMatterBrokerNode();
    // Start the VMB with a unique instance node ID
    await vmb.start("something-unique");

    // Pair each node with the VMB
    for (let i = 0; i < NUM_DEVICES; i++) {
        // const endpoint = new Endpoint(
        //     TemperatureSensorDevice.with(BridgedDeviceBasicInformationServer),
        //     {
        //         id: `tempsensor-${i}`,
        //         bridgedDeviceBasicInformation: {
        //             nodeLabel: name, // Main end user name for the device
        //             productName: name,
        //             productLabel: name,
        //             serialNumber: `node-matter-${uniqueId}-${i}`,
        //             reachable: true,
        //         },
        //     },
        // );
        await vmb.pairNode(i);
        // await vmb.connectNode(i);
    }
}

await main();

// for (let idx = 0; idx < NUM_DEVICES; idx++) {
//     const i = idx + 1;

//     const name = `TemperatureSensor ${i}`;

//     const endpoint = new Endpoint(
//         TemperatureSensorDevice.with(BridgedDeviceBasicInformationServer),
//         {
//             id: `tempsensor-${i}`,
//             bridgedDeviceBasicInformation: {
//                 nodeLabel: name, // Main end user name for the device
//                 productName: name,
//                 productLabel: name,
//                 serialNumber: `node-matter-${uniqueId}-${i}`,
//                 reachable: true,
//             },
//         },
//     );
//     await aggregator.add(endpoint);

//     /**
//      * Register state change handlers and events of the endpoint for identify and onoff states to react to the commands.
//      *
//      * If the code in these change handlers fail then the change is also rolled back and not executed and an error is
//      * reported back to the controller.
//      */
//     endpoint.events.identify.startIdentifying.on(() => {
//         console.log(`Run identify logic for ${name}, ideally blink a light every 0.5s ...`);
//     });

//     endpoint.events.identify.stopIdentifying.on(() => {
//         console.log(`Stop identify logic for ${name} ...`);
//     });

//     endpoint.events.temperatureMeasurement.measuredValue$Changed.on(value => {
//         console.log(`Temperature for ${name} is now ${value}°C`);
//     });
// }

// Get average temperature value
// const average = aggregator.state.aggregatedStats.averageTemperatureValue;
// console.log("Average Temperature Value:", average);
// // Set average temperature value to 25.0

// // Retrieve the new average temperature value
// const newAverage = aggregator.state.aggregatedStats.averageTemperatureValue;
// console.log("New Average Temperature Value:", newAverage);

// // Get aggregator endpoint from server
// const aggregatorEndpoint = server.get(aggregator.id);