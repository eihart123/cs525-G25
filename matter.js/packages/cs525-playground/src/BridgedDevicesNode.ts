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

import { Endpoint, EndpointServer, Environment, ServerNode, StorageService, Time, VendorId } from "@matter/main";
import { BridgedDeviceBasicInformationServer } from "@matter/main/behaviors/bridged-device-basic-information";
import { OnOffLightDevice } from "@matter/main/devices/on-off-light";
import { OnOffPlugInUnitDevice } from "@matter/main/devices/on-off-plug-in-unit";
import { AggregatorEndpoint } from "@matter/main/endpoints/aggregator";
import { logEndpoint } from "@matter/main/protocol";
import { execSync } from "node:child_process";
import { TemperatureSensorDevice } from "@matter/main/devices/temperature-sensor";

/** Initialize configuration values */
const nodeId = 0;
const { deviceName, vendorName, passcode, discriminator, vendorId, productName, productId, port, uniqueId } =
    await getConfiguration(nodeId);

/**
 * Create a Matter ServerNode, which contains the Root Endpoint and all relevant data and configuration
 */
const server = await ServerNode.create({
    // Required: Give the Node a unique ID which is used to store the state of this node
    id: uniqueId,

    // Provide Network relevant configuration like the port
    // Optional when operating only one device on a host, Default port is 5540
    network: {
        port,
    },

    // Provide Commissioning relevant settings
    // Optional for development/testing purposes
    commissioning: {
        passcode,
        discriminator,
    },

    // Provide Node announcement settings
    // Optional: If Ommitted some development defaults are used
    productDescription: {
        name: deviceName,
        deviceType: AggregatorEndpoint.deviceType,
    },

    // Provide defaults for the BasicInformation cluster on the Root endpoint
    // Optional: If Omitted some development defaults are used
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

/**
 * Matter Nodes are a composition of endpoints. Create and add a single multiple endpoint to the node to make it a
 * composed device. This example uses the OnOffLightDevice or OnOffPlugInUnitDevice depending on the value of the type
 * parameter. It also assigns each Endpoint a unique ID to store the endpoint number for it in the storage to restore
 * the device on restart.
 *
 * In this case we directly use the default command implementation from matter.js. Check out the DeviceNodeFull example
 * to see how to customize the command handlers.
 */

const aggregator = new Endpoint(AggregatorEndpoint, { id: "aggregator" });
await server.add(aggregator);
const numDevices = 2;

for (let idx = 0; idx < numDevices; idx++) {
    const i = idx + 1;

    const name = `OnOff Light ${i}`;

    const endpoint = new Endpoint(TemperatureSensorDevice.with(BridgedDeviceBasicInformationServer), {
            id: `tempsensor-${i}`, // ID of the endpoint -- AFAIK this does not need to be unique.
            temperatureMeasurement: {
                // Use this to initialize the measuredValue with the most uptodate value.
                // If you do not know the value and also cannot request it, best use "null" (if allowed by the cluster).
                measuredValue: getIntValueFromCommandOrRandom(),
            },
            bridgedDeviceBasicInformation: {
                nodeLabel: name, // Main end user name for the device
                productName: name,
                productLabel: name,
                serialNumber: `node-matter-${uniqueId}-${i}`,
                reachable: true,
            },
        });
    await aggregator.add(endpoint);

    // await endpoint.close();

    const interval = 10; // seconds
    const updateInterval = setInterval(() => {
        endpoint.set({
            temperatureMeasurement: {
                measuredValue: getIntValueFromCommandOrRandom(),
            },
        }).catch(error => console.error("Error updating measured value:", error));
    }, interval * 1000);

    // Cleanup our update interval when node goes offline
    server.lifecycle.offline.on(() => clearTimeout(updateInterval));
    /**
     * Register state change handlers and events of the endpoint for identify and onoff states to react to the commands.
     *
     * If the code in these change handlers fail then the change is also rolled back and not executed and an error is
     * reported back to the controller.
     */
    endpoint.events.identify.startIdentifying.on(() => {
        console.log(`Run identify logic for ${name}, ideally explode ...`);
    });

    // endpoint.events.identify.stopIdentifying.on(() => {
    //     console.log(`Stop identify logic for ${name} ...`);
    // });

    // endpoint.events.onOff.onOff$Changed.on(value => {
    //     executeCommand(value ? `on${i}` : `off${i}`);
    //     console.log(`${name} is now ${value ? "ON" : "OFF"}`);
    // });
}

/**
 * In order to start the node and announce it into the network we use the run method which resolves when the node goes
 * offline again because we do not need anything more here. See the Full example for other starting options.
 * The QR Code is printed automatically.
 */
await server.start();

/**
 * Log the endpoint structure for debugging reasons and to allow to verify anything is correct
 */
// logEndpoint(EndpointServer.forEndpoint(server));

/*
  If you want to dynamically add another device during runtime you can do so by doing the following:

    const name = `OnOff Light 3`;

    const endpoint = new Endpoint(OnOffLightDevice.with(BridgedDeviceBasicInformationServer), {
        id: `onoff-3`,
        bridgedDeviceBasicInformation: {
            nodeLabel: name,
            productName: name,
            productLabel: name,
            serialNumber: `node-matter-${uniqueId}-3`,
            reachable: true,
        },
    });
    await aggregator.add(endpoint);

    endpoint.events.onOff.onOff$Changed.on(value => {
        executeCommand(value ? `on3` : `off3`);
        console.log(`${name} is now ${value ? "ON" : "OFF"}`);
    });

 */

/*
   To remove a device during runtime you can do so by doing the following:
        console.log("Removing Light 3 now!!");

        await endpoint.close();

   This will automatically remove the endpoint from the bridge.
 */

/*********************************************************************************************************
 * Convenience Methods
 *********************************************************************************************************/


function getIntValueFromCommandOrRandom(allowNegativeValues = true) {
    if (!allowNegativeValues) return Math.round(Math.random() * 100);
    return (Math.round(Math.random() * 100) - 50);
}

async function getConfiguration(nodeId: number) {
    /**
     * Collect all needed data
     *
     * This block collects all needed data from cli, environment or storage. Replace this with where ever your data come from.
     *
     * Note: This example uses the matter.js process storage system to store the device parameter data for convenience
     * and easy reuse. When you also do that be careful to not overlap with Matter-Server own storage contexts
     * (so maybe better not do it ;-)).
     */
    const environment = Environment.default;

    const storageService = environment.get(StorageService);
    console.log(`Storage location: ${storageService.location} (Directory)`);
    console.log(
        'Use the parameter "--storage-path=NAME-OR-PATH" to specify a different storage location in this directory, use --storage-clear to start with an empty storage.',
    );
    const deviceStorage = (await storageService.open(`device-${nodeId}`)).createContext("data");


    const deviceName = "Matter test device AGGREGATOR";
    const vendorName = "matter-node.js";
    const passcode =  (await deviceStorage.get("passcode", 20202021));
    const discriminator = (await deviceStorage.get("discriminator", 10 + nodeId));
    // product name / id and vendor id should match what is in the device certificate
    const vendorId = (await deviceStorage.get("vendorid", 0xfff1));
    const productName = `node-matter sensor AGGREGATOR`;
    const productId = (await deviceStorage.get("productid", 0x8000));

    const port = 5540;

    const uniqueId = (await deviceStorage.get("uniqueid", Time.nowMs().toString()));

    // Persist basic data to keep them also on restart
    await deviceStorage.set({
        passcode,
        discriminator,
        vendorid: vendorId,
        productid: productId,
        uniqueid: uniqueId,
    });

    return {
        deviceName,
        vendorName,
        passcode,
        discriminator,
        vendorId,
        productName,
        productId,
        port,
        uniqueId,
    };
}
