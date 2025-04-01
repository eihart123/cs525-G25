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

import { Endpoint, EndpointServer, ServerNode } from "@matter/node";
// BridgedDeviceBasicInformationServer, OnOffLightDevice, OnOffPlugInUnitDevice, 
// "#endpoints/*": "./src/endpoints/*.js",
import { AggregatorEndpoint } from "@matter/node/endpoints/aggregator";
import { AggregatedStatsServer } from "@matter/node/behaviors/aggregated-stats";
import { TemperatureMeasurementServer } from "@matter/node/behaviors";
import { BridgedDeviceBasicInformationServer } from "@matter/node/behaviors/bridged-device-basic-information";
// import { OnOffLightDevice, OnOffPlugInUnitDevice } from "@matter/main/devices"

import { Diagnostic, Environment, Logger, StorageService, StorageContext, StorageManager, Time } from "@matter/main";
import { DescriptorCluster, GeneralCommissioning } from "@matter/main/clusters";
import { NodeId, VendorId } from "@matter/types";
// import { logEndpoint } from "#main/protocol";
import { execSync } from "node:child_process";
import { DescriptorServer } from "@matter/node/behaviors";

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

class VirtualMatterBrokerNode {
    instanceNodeId: string;
    #vmbStorageManager: StorageManager;
    #controller: CommissioningController;
    #controllerStorage: StorageContext;
    #aggregator: Endpoint<AggregatorEndpoint>;
    #aggregatorStorage: StorageContext;

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

        // Start the server
        await server.start();
        console.log(`Matter server started on port ${port}`);
    }

    async start(instanceNodeId: string) {
        if (!instanceNodeId) throw new Error("Missing instance node id");
        this.instanceNodeId = instanceNodeId;
        this.#vmbStorageManager = (await storageService.open(`vmb-${this.instanceNodeId}`));

        // South side initialization
        await this.#initController();
        // North side initialization
        await this.#initAggregator();
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
        
    }

    // Create a virtual node/endpoints (use Node Label) in the aggregator
    async onNodeCommission(nodeId: NodeId) {
        // Query the original node for all its endpoints
        // (await this.#controller.getNode(nodeId)).getDevices()

        /**
         
          Descriptor cluster with a PartsList attribute containing all the endpoints representing those Bridged Devices.
         PartsList: EP 1, 11,12,13,14,15,16
         The PartsList on endpoint 1 lists all endpoints for bridged
            devices; each endpoint 11..16 represents one device at
            the non-Matter side of the bridge.
         Descriptor cluster: EP 11
         
         Bridge Device Basic Information cluster:
         - Node Label: "dining table"

        Descriptor cluster: EP 2
         DeviceTypeList: Aggregator
            PartsList: EP 11,12,13
            TagList: Tag=(MfgCode=0xFFF1, Namespace=0x11,
            TagID=0x03), Label=“Zigbee bridge”
        
        Descriptor cluster: EP 1
        DeviceTypeList: Aggregator
        PartsList: EP 14,15,16
        TagList: Tag=(MfgCode=0xFFF1, Namespace=0x11,
        TagID=0x05), Label=“Z-Wave bridge”

        Actions cluster: ActionList: [ ]
        EndpointLists: [
        [0xE001, "living room", room, [12,13,14] ],
        [0xE002, "bedroom", room, [22,23,24,25,26] ]

        TODO: Add all endpoints to the PartsList of the aggregator endpoint.
        

        
         */
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

        const devices = node.getDevices();
        console.log(`Devices: ${devices[0]}`);

        const rootEndpoint = node.getRootEndpoint()
        const endpoints = rootEndpoint?.getChildEndpoints() ?? [];
        const descriptor = node.getRootClusterClient(DescriptorCluster);
        const descriptorServer = node.getRootClusterServer(DescriptorCluster);
        if (descriptorServer === undefined) {
            throw new Error("Descriptor server not found");
        }
        descriptorServer
        const partsList = (await descriptor?.attributes.partsList.get()) ?? [];
        console.log(`old PartsList: [${partsList}]`);

        for (const part of partsList) {
            console.log(`Part: ${part}`);
            // Get the endpoint corresponding to the part number
            const endpoint = endpoints.find((ep) => ep.number === part);
            if (endpoint) {
                console.log(`Endpoint name for part ${part}: ${endpoint.name}`);
            }
        }

        const endpointNumbers = endpoints.map((endpoint) => {
            const number = endpoint.number
            if (number === undefined) {
                throw new Error("Endpoint number is undefined");
            }
            return number;
        });
        descriptor?.attributes.partsList.set(endpointNumbers);
        console.log(`new PartsList: [${await (descriptor?.attributes.partsList.get())}]`);
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
// await aggregator.set({
//     aggregatedStats: {
//         averageTemperatureValue: 25.0,
//     },
// });
// // Retrieve the new average temperature value
// const newAverage = aggregator.state.aggregatedStats.averageTemperatureValue;
// console.log("New Average Temperature Value:", newAverage);

// // Get aggregator endpoint from server
// const aggregatorEndpoint = server.get(aggregator.id);