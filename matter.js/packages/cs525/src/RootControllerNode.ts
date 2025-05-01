#!/usr/bin/env node
/**
 * @license
 * Copyright 2022-2025 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Diagnostic, Environment, Logger, StorageService, Time } from "@matter/main";
import { GeneralCommissioning } from "@matter/main/clusters";
import { ManualPairingCodeCodec, NodeId } from "@matter/main/types";
import { CommissioningController, NodeCommissioningOptions } from "@project-chip/matter.js";
import { NodeStates } from "@project-chip/matter.js/device";
import { AggregatedStatsCluster } from "@matter/types/clusters/aggregated-stats";
import { appendFile } from "node:fs";
import { execSync } from "node:child_process";
import { DescriptorServer } from "@matter/node/behaviors";
import { Command } from "commander";
import fs from "node:fs";
import { resolve } from "node:path";
import { exit } from "node:process";
import { fileURLToPath } from 'url';
import path from 'path';

Logger.level = "info";
const logger = Logger.get("RootController");

const environment = Environment.default;

const storageService = environment.get(StorageService);

logger.info(`Storage location: ${storageService.location} (Directory)`);
logger.info(
    'Use the parameter "--storage-path=NAME-OR-PATH" to specify a different storage location in this directory, use --storage-clear to start with an empty storage.',
);

type Config = {
    south: {
        name: string;
        ip: string;
        port: number;
    }[]
}

function readConfigFile(configFile: string): Config {
    // Read `cs525` config.json file from dist/esm folder
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const file = resolve(__dirname, "..", "..", configFile);
    if (!fs.existsSync(file)) {
        console.error(`Config file ${file} not found`);
        exit(1);
    }

    const data = fs.readFileSync(file, "utf8");
    const config = JSON.parse(data) as Config;
    return config;
}

class RootControllerNode {
    controller: CommissioningController | undefined = undefined;

    async start(config: Config) {
        logger.info(`node-matter Controller started`);

        const controllerStorage = (await storageService.open("controller")).createContext("data");
        const uniqueId = (await controllerStorage.has("uniqueid"))
            ? await controllerStorage.get<string>("uniqueid")
            : (environment.vars.string("uniqueid") ?? Time.nowMs().toString());
        await controllerStorage.set("uniqueid", uniqueId);
        const adminFabricLabel = (await controllerStorage.has("fabriclabel"))
            ? await controllerStorage.get<string>("fabriclabel")
            : (environment.vars.string("fabriclabel") ?? "matter.js Controller");
        await controllerStorage.set("fabriclabel", adminFabricLabel);

        const pairingCode = environment.vars.string("pairingcode");
        let longDiscriminator, setupPin, shortDiscriminator;
        if (pairingCode !== undefined) {
            const pairingCodeCodec = ManualPairingCodeCodec.decode(pairingCode);
            shortDiscriminator = pairingCodeCodec.shortDiscriminator;
            longDiscriminator = undefined;
            setupPin = pairingCodeCodec.passcode;
            logger.debug(`Data extracted from pairing code: ${Logger.toJSON(pairingCodeCodec)}`);
        } else {
            longDiscriminator =
                environment.vars.number("longDiscriminator") ??
                (await controllerStorage.get("longDiscriminator", 3840));
            if (longDiscriminator > 4095) throw new Error("Discriminator value must be less than 4096");
            setupPin = environment.vars.number("pin") ?? (await controllerStorage.get("pin", 20250525));
        }
        if ((shortDiscriminator === undefined && longDiscriminator === undefined) || setupPin === undefined) {
            throw new Error(
                "Please specify the longDiscriminator of the device to commission with -longDiscriminator or provide a valid passcode with -passcode",
            );
        }

        /** Create Matter Controller Node and bind it to the Environment. */
        const commissioningController = new CommissioningController({
            environment: {
                environment,
                id: uniqueId,
            },
            autoConnect: false, // Do not auto connect to the commissioned nodes
            adminFabricLabel,
        });
        this.controller = commissioningController;

        /** Start the Matter Controller Node */
        await commissioningController.start();

        const promises = config.south.map(({ name, ip, port }) => {
            return this.commissionAndPairNode({ name, ip, port, longDiscriminator, setupPin })
                .catch(error => {
                    logger.error(`Error commissioning node ${name}: ${error}`);
                });
        });
        // Wait until all commissioning/connecting is done
        await Promise.all(promises);
        console.log("All nodes commissioned and connected!");
    }

    async commissionAndPairNode({name, ip, port, longDiscriminator, setupPin}) {
        logger.debug(`Commissioning starting for ${name} (${ip}:${port})...`);
        const options: NodeCommissioningOptions = {
            commissioning: {
                regulatoryLocation: GeneralCommissioning.RegulatoryLocationType.IndoorOutdoor,
                regulatoryCountryCode: "XX",
            },
            discovery: {
                knownAddress: { ip, port, type: "udp" },
                identifierData: { longDiscriminator },
                discoveryCapabilities: {},
            },
            passcode: setupPin,
        };
        let nodeId: NodeId | undefined = undefined;
        while (nodeId === undefined) {
            try {
                nodeId = await this.controller?.commissionNode(options, { connectNodeAfterCommissioning: false });
            } catch (error) {
                logger.error(`Error commissioning node ${name}: ${error}`);
            }
        }
        logger.debug(`Commissioning done for ${name}, assigned nodeID: ${nodeId}`);
        await this.pairNode(nodeId, name);
    }

    async pairNode(nodeId: NodeId, name: string) {
        if (!this.controller) {
            throw new Error("Controller is not initialized");
        }

        const nodes = this.controller.getCommissionedNodes();

        if (!nodes.includes(nodeId)) {
            throw new Error(`Node ${nodeId} not found in commissioned nodes`);
        }

        const nodeDetails = this.controller.getCommissionedNodesDetails();
        logger.debug("Commissioned nodes details:", Diagnostic.json(nodeDetails.find(node => node.nodeId === nodeId)));

        // Get the node instance
        const node = await this.controller.getNode(nodeId);

        // Subscribe to events of the node
        // node.events.attributeChanged.on(({ path: { nodeId, clusterId, endpointId, attributeName }, value }) =>
        //     logger.debug(
        //         `attributeChangedCallback ${nodeId}: Attribute ${endpointId}/${clusterId}/${attributeName} changed to ${Logger.toJSON(
        //             value,
        //         )}`,
        //     ),
        // );
        // node.events.eventTriggered.on(({ path: { nodeId, clusterId, endpointId, eventName }, events }) =>
        //     logger.debug(
        //         `eventTriggeredCallback ${nodeId}: Event ${endpointId}/${clusterId}/${eventName} triggered with ${Logger.toJSON(
        //             events,
        //         )}`,
        //     ),
        // );
        node.events.stateChanged.on(info => {
            switch (info) {
                case NodeStates.Connected:
                    logger.info(`state changed: Node ${nodeId} connected`);
                    break;
                case NodeStates.Disconnected:
                    logger.info(`state changed: Node ${nodeId} disconnected`);
                    break;
                case NodeStates.Reconnecting:
                    logger.info(`state changed: Node ${nodeId} reconnecting`);
                    break;
                case NodeStates.WaitingForDeviceDiscovery:
                    logger.info(`state changed: Node ${nodeId} waiting for device discovery`);
                    break;
            }
        });
        // node.events.structureChanged.on(() => {
        //     logger.info(`Node ${nodeId} structure changed`);
        // });

        if (!node.isConnected) {
            // CS 525: disable auto subscribe to all attributes and events
            node.connect({ autoSubscribe: false });
        }
        logger.debug(`Node ${nodeId} connected`);
        // Wait for initialization oif not yet initialized - this should only happen if we just commissioned it
        if (!node.initialized) {
            await node.events.initialized;
        }

        const rootEndpoint = node.getRootEndpoint()
        const endpoints = rootEndpoint?.getChildEndpoints() ?? [];
        for (const child of endpoints) {
            logger.debug(`Child endpoint "${child.name}" found with type: ${child.deviceType}`);
            const aggregatedStats = child.getClusterClient(AggregatedStatsCluster);
            if (!aggregatedStats) {
                logger.info(`Child ${child.number} does not support Aggregated Stats`);
                continue;
            }
            // logger.info(await aggregatedStats?.attributes.attributeList.get())
            logger.info(await aggregatedStats.subscribeAverageMeasuredValue10Attribute(value => console.log(`${name}.average10 = ${value}`), 5, 30));
            logger.info(await aggregatedStats.subscribeAverageMeasuredValue60Attribute(value => console.log(`${name}.average60 = ${value}`), 5, 120));
        }
    }
}

async function main() {
    const program = new Command();
    program.name("root");

    program
        .requiredOption("--configFile <file>")
        .option("--storage-clear");

    program.parse(process.argv);
    const args = program.opts();
    const configFile = args.configFile;
    const config = readConfigFile(configFile);

    const node = new RootControllerNode()
    node.start(config).catch(error => logger.error(error));
    setInterval(() => {
        const totalIn = Object.entries(node.controller?.controllerInstance?.exchangeManager.transmissionMetadata || {}).reduce((acc, [key, value]) => {
            return acc + value;
        }, 0);
        const totalOut = Object.entries(node.controller?.controllerInstance?.exchangeManager.transmissionMetadataOut || {}).reduce((acc, [key, value]) => {
            return acc + value;
        }, 0);
        
        const data = `${Date.now()}, in ${totalIn}, out ${totalOut}\n`;
        appendFile('results_pubsub-root.txt', data, (err) => {
            if (err) throw err;
            logger.info(data);
        });
    }, 1000);
}

await main();