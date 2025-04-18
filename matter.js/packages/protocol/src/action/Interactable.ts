/**
 * @license
 * Copyright 2022-2025 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Invoke } from "./request/Invoke.js";
import { Read } from "./request/Read.js";
import { Subscribe } from "./request/Subscribe.js";
import { Write } from "./request/Write.js";
import { InvokeResult } from "./response/InvokeResult.js";
import { ReadResult } from "./response/ReadResult.js";
import { SubscribeResult } from "./response/SubscribeResult.js";
import { WriteResult } from "./response/WriteResult.js";
import { AccessControl } from "./server/AccessControl.js";

/**
 * Objects implementing this interface can participate in Matter interactions.
 */
export interface Interactable<SessionT = AccessControl.Session> {
    /**
     * Perform a Matter read interaction.
     */
    read(request: Read, session?: SessionT): ReadResult;

    /**
     * Perform a Matter subscribe interaction.
     */
    subscribe(request: Subscribe, session?: SessionT): SubscribeResult;

    /**
     * Perform a Matter write interaction.
     */
    write<T extends Write>(request: T, session?: SessionT): WriteResult<T>;

    /**
     * Perform a Matter invoke interaction.
     */
    invoke<T extends Invoke>(request: T, session?: SessionT): InvokeResult<T>;
}
