/**
 * @license
 * Copyright 2022-2025 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/* CS 525 G25 */

import { AggregatedStatsBehavior } from "./AggregatedStatsBehavior.js";
// import { Agent } from "#endpoint/Agent.js";
// import { Endpoint } from "#endpoint/Endpoint.js";
// import { MutableSet } from "#general";

/**
 * This is the default server implementation of {@link AggregatedStatsBehavior}.
 */
export class AggregatedStatsServer extends AggregatedStatsBehavior {
    static override readonly id = "aggregatedStats";

    declare isInitialized: boolean;

    override initialize() {
        this.isInitialized = true;
        console.log("AggregatedStatsServer initialized");
        console.log(this.endpoint);
        // console.log(this.endpoint.parts);
        console.log("Logging parts?");
        for (const part of this.endpoint.parts) {
            console.log(part);
        }
        // Initialize state values (Attributes) so that they can be subscribed to
        this.state.averageMeasuredValue10 = null;
        this.state.averageMeasuredValue60 = null;
        // this.state.averageMeasuredValue10 = 9999;
        // this.state.averageMeasuredValue60 = 9999;
        console.log("Logging parts done");
    }

    subscribeToAllParts() {
        console.log("Subscribing to all parts:");
        // const parts = this.agent.get(PartsBehavior)
        for (const part of this.endpoint.parts) {
            console.log(part);
            // Subscribe to the part here if needed
        }
    }

    // listParts() {
    //     console.log("Listing parts:");
    //     for (const part of this.endpoint.parts) {
    //         console.log(part);
    //     }
    // }
}

// /matter.js/packages/model/src/standard/elements/AggregatedStats.ts