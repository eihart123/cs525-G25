/**
 * @license
 * Copyright 2022-2025 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/*** THIS FILE IS GENERATED, DO NOT EDIT ***/

import { MatterDefinition } from "../MatterDefinition.js";
import { DatatypeElement as Datatype } from "../../elements/index.js";

export const uint32 = Datatype({
    name: "uint32", byteSize: 4, description: "Unsigned 32-bit integer", isSeed: true,
    metatype: "integer",
    xref: { document: "core", section: "7.19.1" }
});
MatterDefinition.children.push(uint32);
