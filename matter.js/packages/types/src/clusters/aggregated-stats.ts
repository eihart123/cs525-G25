/**
 * @license
 * Copyright 2022-2025 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/* CS 525 G25 */

import { MutableCluster } from "../cluster/mutation/MutableCluster.js";
import { OptionalAttribute } from "../cluster/Cluster.js";
import { TlvInt16 } from "../tlv/TlvNumber.js";
import { TlvNullable } from "../tlv/TlvNullable.js";
import { Identity } from "#general";
import { ClusterRegistry } from "../cluster/ClusterRegistry.js";

export namespace AggregatedStats {
    /**
     * @see {@link Cluster}
     */
    export const ClusterInstance = MutableCluster({
        id: 0x1337,
        name: "AggregatedStats",
        revision: 1,

        attributes: {
            /**
             * Indicates the average measured temperature.
             *
             * The null value indicates that the average measured temperature is unknown or is not being recorded.
             *
             * See CS 525 Matter Application Cluster Extension (https://docs.google.com/document/d/1Br-RXX_OIgMnbJTYEfhOZdOQT0xYjVlxCxtCGePhgqo/edit?tab=t.0#heading=h.ek5k33x2f7r4)
             * for more details.
             */
            averageTemperatureValue: OptionalAttribute(0x0, TlvNullable(TlvInt16.bound({ min: -27315, max: 32767 })), { default: null }),
        }
    });

    /**
     * This cluster provides an interface to aggregated statistics functionality, including configuration and
     * provision of notifications of average temperature measurements.
     */
    export interface Cluster extends Identity<typeof ClusterInstance> {}

    export const Cluster: Cluster = ClusterInstance;
    export const Complete = Cluster;
}

export type AggregatedStatsCluster = AggregatedStats.Cluster;
export const AggregatedStatsCluster = AggregatedStats.Cluster;
ClusterRegistry.register(AggregatedStats.Complete);
