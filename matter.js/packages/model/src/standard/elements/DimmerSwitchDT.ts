/**
 * @license
 * Copyright 2022-2025 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/*** THIS FILE IS GENERATED, DO NOT EDIT ***/

import { MatterDefinition } from "../MatterDefinition.js";
import { DeviceTypeElement as DeviceType, RequirementElement as Requirement } from "../../elements/index.js";

export const DimmerSwitchDt = DeviceType(
    {
        name: "DimmerSwitch", id: 0x104, type: "OnOffLightSwitch", category: "Switches and Controls",
        classification: "simple",
        details: "A Dimmer Switch is a controller device that, when bound to a lighting device such as a Dimmable " +
            "Light, is capable of being used to switch the device on or off and adjust the intensity of the light " +
            "being emitted.",
        xref: { document: "device", section: "6.2" }
    },

    Requirement(
        { name: "Descriptor", id: 0x1d, element: "serverCluster" },
        Requirement({ name: "DeviceTypeList", default: [ { deviceType: 260, revision: 3 } ], element: "attribute" })
    ),
    Requirement({
        name: "Identify", id: 0x3, conformance: "M", element: "serverCluster",
        xref: { document: "device", section: "6.2.4" }
    }),
    Requirement({
        name: "Identify", id: 0x3, conformance: "M", element: "clientCluster",
        xref: { document: "device", section: "6.2.4" }
    }),
    Requirement({
        name: "Groups", id: 0x4, conformance: "O", element: "clientCluster",
        xref: { document: "device", section: "6.2.4" }
    }),
    Requirement({
        name: "ScenesManagement", id: 0x62, conformance: "P, O", element: "clientCluster",
        xref: { document: "device", section: "6.2.4" }
    }),
    Requirement({
        name: "OnOff", id: 0x6, conformance: "M", element: "clientCluster",
        xref: { document: "device", section: "6.2.4" }
    }),
    Requirement({
        name: "LevelControl", id: 0x8, conformance: "M", element: "clientCluster",
        xref: { document: "device", section: "6.2.4" }
    })
);

MatterDefinition.children.push(DimmerSwitchDt);
