#!/usr/bin/env node
/**
 * @license
 * Copyright 2022-2025 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * This example shows how to create a simple Sensor Matter device as temperature or humidity device.
 * It can be used as CLI script and starting point for your own device node implementation.
 * This example is CJS conform and do not use top level await's.
 */

import { Endpoint, EndpointServer, Environment, LogDestination, ServerNode, StorageService, Time } from "@matter/main";
import { TemperatureSensorDevice } from "@matter/main/devices/temperature-sensor";
import { logEndpoint } from "@matter/main/protocol";
import { DeviceTypeId, VendorId } from "@matter/main/types";
import { execSync } from "node:child_process";
import { LogLevel, Logger, singleton } from "@matter/main";
import { exit } from "node:process";

async function main() {
    const deviceID = process.env.DEVICE_ID;
    const port = process.env.PORT;
    console.log({ port });
    if (port === undefined) {
        // Exit if DEVICE_ID is not provided
        console.error("PORT environment variable is not set. Please set it to a valid device ID.");
        return;
        // Alternatively you could fallback to a default value or handle it differently
        // const deviceID = '1'; // Fallback to a default device ID
    }
    /** Initialize configuration values */
    console.log("Initializing configuration...");
    Logger.level = "info";
    // logger.level = LogLevel.NOTICE; // Set the log level for the logger to INFO
    // logger.info("Hi there")
    // Logger.setDefaultLoglevelForLogger("EndpointStructureLogger", LogLevel.INFO); // Set the default log level for the MatterNode logger
    // Logger.get("EndpointStructureLogger").setLevel(LogLevel.INFO); // Set the log level for the endpoint structure logger
    const {
        interval,
        deviceName,
        vendorName,
        passcode,
        discriminator,
        vendorId,
        productName,
        productId,
        uniqueId,
    } = await getConfiguration(deviceID);
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
            deviceType: DeviceTypeId(TemperatureSensorDevice.deviceType),
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
     * Matter Nodes are a composition of endpoints. Create and add a single endpoint to the node. This example uses the
     * OnOffLightDevice or OnOffPlugInUnitDevice depending on the value of the type parameter. It also assigns this Part a
     * unique ID to store the endpoint number for it in the storage to restore the device on restart.
     * In this case we directly use the default command implementation from matter.js. Check out the DeviceNodeFull example
     * to see how to customize the command handlers.
     */
    let endpoint: Endpoint<TemperatureSensorDevice>;
    endpoint = new Endpoint(TemperatureSensorDevice, {
        id: "tempsensor", // ID of the endpoint -- AFAIK this does not need to be unique.
        temperatureMeasurement: {
            // Use this to initialize the measuredValue with the most uptodate value.
            // If you do not know the value and also cannot request it, best use "null" (if allowed by the cluster).
            measuredValue: getIntValueFromCommandOrRandom("value"),
        },
    });

    await server.add(endpoint);

    /**
     * Log the endpoint structure for debugging reasons and to allow to verify anything is correct
     */
    // logEndpoint(EndpointServer.forEndpoint(server));

    const updateInterval = setInterval(() => {
        endpoint.set({
            temperatureMeasurement: {
                measuredValue: getIntValueFromCommandOrRandom("value"),
            },
        }).catch(error => console.error("Error updating measured value:", error));
    }, interval * 1000);

    // Cleanup our update interval when node goes offline
    server.lifecycle.offline.on(() => clearTimeout(updateInterval));

    /**
     * In order to start the node and announce it into the network we use the run method which resolves when the node goes
     * offline again because we do not need anything more here. See the Full example for other starting options.
     * The QR Code is printed automatically.
     */
    server.run();
    // stop the server/quit node after 120 seconds
    setTimeout(() => {
        process.exit(0);
    }, 120 * 1000); // 120 seconds
}

main().catch(error => console.error(error));

/*********************************************************************************************************
 * Convenience Methods
 *********************************************************************************************************/

/** Defined a shell command from an environment variable and execute it and log the response. */

function getIntValueFromCommandOrRandom(scriptParamName: string, allowNegativeValues = true) {
    const script = Environment.default.vars.string(scriptParamName);
    // By default, gets a random number between -50 and 50 if no script is provided
    if (script === undefined) {
        if (!allowNegativeValues) return Math.round(Math.random() * 100);
        return (Math.round(Math.random() * 100) - 50);
    }
    let result = execSync(script).toString().trim();
    if ((result.startsWith("'") && result.endsWith("'")) || (result.startsWith('"') && result.endsWith('"')))
        result = result.slice(1, -1);
    console.log(`Command result: ${result}`);
    let value = Math.round(parseFloat(result));
    if (!allowNegativeValues && value < 0) value = 0;
    return value;
}

async function getConfiguration(deviceID: string) {
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
    console.log(storageService)
    console.log(`Storage location: ${storageService.location} (Directory)`);
    // This environment variable is used by StorageService
    console.log(
        'Use the parameter "--storage-path=NAME-OR-PATH" to specify a different storage location in this directory, use --storage-clear to start with an empty storage.',
    );
    const deviceStorage = (await storageService.open(`device-${deviceID}`)).createContext("data");

    // How often to update the measured value in seconds
    let interval = environment.vars.number("interval") ?? (await deviceStorage.get("interval", 10));
    if (interval < 1) {
        console.log(`Invalid Interval ${interval}, set to 10s`);
        interval = 10;
    }
    console.log(`Update interval set to ${interval} seconds`); // Log the interval for debugging

    const deviceName = `Matter test device #${deviceID}`;
    const vendorName = "matter-node.js";
    const passcode = environment.vars.number("passcode") ?? (await deviceStorage.get("passcode", 20202021));
    const discriminator = environment.vars.number("discriminator") ?? await deviceStorage.get("discriminator", 0);
    // product name / id and vendor id should match what is in the device certificate
    const vendorId = environment.vars.number("vendorid") ?? (await deviceStorage.get("vendorid", 0xfff1));
    const productName = `node-matter OnOff Temperature`;
    const productId = environment.vars.number("productid") ?? (await deviceStorage.get("productid", 0x8000));

    const uniqueId =
        environment.vars.string("uniqueid") ?? (await deviceStorage.get("uniqueid", Time.nowMs().toString()));

    // Persist basic data to keep them also on restart
    await deviceStorage.set({
        passcode,
        discriminator,
        vendorid: vendorId,
        productid: productId,
        interval,
        uniqueid: uniqueId,
    });

    return {
        interval,
        deviceName,
        vendorName,
        passcode,
        discriminator,
        vendorId,
        productName,
        productId,
        uniqueId,
    };
}
