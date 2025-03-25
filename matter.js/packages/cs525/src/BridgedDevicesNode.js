#!/usr/bin/env node
"use strict";
/**
 * @license
 * Copyright 2022-2025 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * This example shows how to create a new device node that is composed of multiple devices.
 * It creates multiple endpoints on the server. For information on how to add a composed device to a bridge please
 * refer to the bridge example!
 * It can be used as CLI script and starting point for your own device node implementation.
 */
var main_1 = require("@matter/main");
var bridged_device_basic_information_1 = require("@matter/main/behaviors/bridged-device-basic-information");
var on_off_light_1 = require("@matter/main/devices/on-off-light");
var on_off_plug_in_unit_1 = require("@matter/main/devices/on-off-plug-in-unit");
var aggregator_1 = require("@matter/main/endpoints/aggregator");
var protocol_1 = require("@matter/main/protocol");
var node_child_process_1 = require("node:child_process");
/** Initialize configuration values */
var _a = await getConfiguration(), isSocket = _a.isSocket, deviceName = _a.deviceName, vendorName = _a.vendorName, passcode = _a.passcode, discriminator = _a.discriminator, vendorId = _a.vendorId, productName = _a.productName, productId = _a.productId, port = _a.port, uniqueId = _a.uniqueId;
/**
 * Create a Matter ServerNode, which contains the Root Endpoint and all relevant data and configuration
 */
var server = await main_1.ServerNode.create({
    // Required: Give the Node a unique ID which is used to store the state of this node
    id: uniqueId,
    // Provide Network relevant configuration like the port
    // Optional when operating only one device on a host, Default port is 5540
    network: {
        port: port,
    },
    // Provide Commissioning relevant settings
    // Optional for development/testing purposes
    commissioning: {
        passcode: passcode,
        discriminator: discriminator,
    },
    // Provide Node announcement settings
    // Optional: If Ommitted some development defaults are used
    productDescription: {
        name: deviceName,
        deviceType: aggregator_1.AggregatorEndpoint.deviceType,
    },
    // Provide defaults for the BasicInformation cluster on the Root endpoint
    // Optional: If Omitted some development defaults are used
    basicInformation: {
        vendorName: vendorName,
        vendorId: (0, main_1.VendorId)(vendorId),
        nodeLabel: productName,
        productName: productName,
        productLabel: productName,
        productId: productId,
        serialNumber: "matterjs-".concat(uniqueId),
        uniqueId: uniqueId,
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
var aggregator = new main_1.Endpoint(aggregator_1.AggregatorEndpoint, { id: "aggregator" });
await server.add(aggregator);
var _loop_1 = function (idx) {
    var i = idx + 1;
    var isASocket = isSocket[idx]; // Is the Device we add a Socket or a Light?
    var name_1 = "OnOff ".concat(isASocket ? "Socket" : "Light", " ").concat(i);
    var endpoint = new main_1.Endpoint(isASocket
        ? // For a Bridged Device we need to add a BridgedDeviceBasicInformation cluster as server
            on_off_plug_in_unit_1.OnOffPlugInUnitDevice.with(bridged_device_basic_information_1.BridgedDeviceBasicInformationServer)
        : on_off_light_1.OnOffLightDevice.with(bridged_device_basic_information_1.BridgedDeviceBasicInformationServer), {
        id: "onoff-".concat(i),
        bridgedDeviceBasicInformation: {
            nodeLabel: name_1,
            productName: name_1,
            productLabel: name_1,
            serialNumber: "node-matter-".concat(uniqueId, "-").concat(i),
            reachable: true,
        },
    });
    await aggregator.add(endpoint);
    /**
     * Register state change handlers and events of the endpoint for identify and onoff states to react to the commands.
     *
     * If the code in these change handlers fail then the change is also rolled back and not executed and an error is
     * reported back to the controller.
     */
    endpoint.events.identify.startIdentifying.on(function () {
        console.log("Run identify logic for ".concat(name_1, ", ideally blink a light every 0.5s ..."));
    });
    endpoint.events.identify.stopIdentifying.on(function () {
        console.log("Stop identify logic for ".concat(name_1, " ..."));
    });
    endpoint.events.onOff.onOff$Changed.on(function (value) {
        executeCommand(value ? "on".concat(i) : "off".concat(i));
        console.log("".concat(name_1, " is now ").concat(value ? "ON" : "OFF"));
    });
};
for (var idx = 0; idx < isSocket.length; idx++) {
    _loop_1(idx);
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
(0, protocol_1.logEndpoint)(main_1.EndpointServer.forEndpoint(server));
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
/** Defined a shell command from an environment variable and execute it and log the response. */
function executeCommand(scriptParamName) {
    var script = main_1.Environment.default.vars.string(scriptParamName);
    if (script === undefined)
        return undefined;
    console.log("".concat(scriptParamName, ": ").concat((0, node_child_process_1.execSync)(script).toString().slice(0, -1)));
}
function getConfiguration() {
    var _a, _b, _c, _d, _e, _f;
    return __awaiter(this, void 0, void 0, function () {
        var environment, storageService, deviceStorage, isSocket, numDevices, i, deviceName, vendorName, passcode, _g, discriminator, _h, vendorId, _j, productName, productId, _k, port, uniqueId, _l;
        return __generator(this, function (_m) {
            switch (_m.label) {
                case 0:
                    environment = main_1.Environment.default;
                    storageService = environment.get(main_1.StorageService);
                    console.log("Storage location: ".concat(storageService.location, " (Directory)"));
                    console.log('Use the parameter "--storage-path=NAME-OR-PATH" to specify a different storage location in this directory, use --storage-clear to start with an empty storage.');
                    return [4 /*yield*/, storageService.open("device")];
                case 1:
                    deviceStorage = (_m.sent()).createContext("data");
                    isSocket = Array();
                    numDevices = environment.vars.number("num") || 2;
                    return [4 /*yield*/, deviceStorage.has("isSocket")];
                case 2:
                    if (!_m.sent()) return [3 /*break*/, 4];
                    console.log("Device types found in storage. --type parameter is ignored.");
                    return [4 /*yield*/, deviceStorage.get("isSocket")];
                case 3:
                    (_m.sent()).forEach(function (type) { return isSocket.push(type); });
                    _m.label = 4;
                case 4:
                    for (i = 1; i <= numDevices; i++) {
                        if (isSocket[i - 1] !== undefined)
                            continue;
                        isSocket.push(environment.vars.string("type".concat(i)) === "socket");
                    }
                    deviceName = "Matter test device";
                    vendorName = "matter-node.js";
                    if (!((_a = environment.vars.number("passcode")) !== null && _a !== void 0)) return [3 /*break*/, 5];
                    _g = _a;
                    return [3 /*break*/, 7];
                case 5: return [4 /*yield*/, deviceStorage.get("passcode", 20202021)];
                case 6:
                    _g = (_m.sent());
                    _m.label = 7;
                case 7:
                    passcode = _g;
                    if (!((_b = environment.vars.number("discriminator")) !== null && _b !== void 0)) return [3 /*break*/, 8];
                    _h = _b;
                    return [3 /*break*/, 10];
                case 8: return [4 /*yield*/, deviceStorage.get("discriminator", 3840)];
                case 9:
                    _h = (_m.sent());
                    _m.label = 10;
                case 10:
                    discriminator = _h;
                    if (!((_c = environment.vars.number("vendorid")) !== null && _c !== void 0)) return [3 /*break*/, 11];
                    _j = _c;
                    return [3 /*break*/, 13];
                case 11: return [4 /*yield*/, deviceStorage.get("vendorid", 0xfff1)];
                case 12:
                    _j = (_m.sent());
                    _m.label = 13;
                case 13:
                    vendorId = _j;
                    productName = "node-matter OnOff ".concat(isSocket ? "Socket" : "Light");
                    if (!((_d = environment.vars.number("productid")) !== null && _d !== void 0)) return [3 /*break*/, 14];
                    _k = _d;
                    return [3 /*break*/, 16];
                case 14: return [4 /*yield*/, deviceStorage.get("productid", 0x8000)];
                case 15:
                    _k = (_m.sent());
                    _m.label = 16;
                case 16:
                    productId = _k;
                    port = (_e = environment.vars.number("port")) !== null && _e !== void 0 ? _e : 5540;
                    if (!((_f = environment.vars.string("uniqueid")) !== null && _f !== void 0)) return [3 /*break*/, 17];
                    _l = _f;
                    return [3 /*break*/, 19];
                case 17: return [4 /*yield*/, deviceStorage.get("uniqueid", main_1.Time.nowMs().toString())];
                case 18:
                    _l = (_m.sent());
                    _m.label = 19;
                case 19:
                    uniqueId = _l;
                    // Persist basic data to keep them also on restart
                    return [4 /*yield*/, deviceStorage.set({
                            passcode: passcode,
                            discriminator: discriminator,
                            vendorid: vendorId,
                            productid: productId,
                            isSocket: isSocket,
                            uniqueid: uniqueId,
                        })];
                case 20:
                    // Persist basic data to keep them also on restart
                    _m.sent();
                    return [2 /*return*/, {
                            isSocket: isSocket,
                            deviceName: deviceName,
                            vendorName: vendorName,
                            passcode: passcode,
                            discriminator: discriminator,
                            vendorId: vendorId,
                            productName: productName,
                            productId: productId,
                            port: port,
                            uniqueId: uniqueId,
                        }];
            }
        });
    });
}
