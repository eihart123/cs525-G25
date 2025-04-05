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

// This is where we should list all allowed attribute names for the AggregatedStats cluster
export type AggregateInterval = 10 | 60;
export type AggregatedStatKind = 'Average';
export type AggregatedAttribute = 'MeasuredValue'

export type AggregatedAttributeFull = `${AggregatedStatKind}${AggregatedAttribute}${AggregateInterval}`
export type AggregatedRecord = {
    [K in AggregatedAttributeFull]: number;
  };

// cross product of all possible combinations of statKind, attribute, and aggregateInterval
export const StatKinds: AggregatedStatKind[] = ['Average'];
export const AttributeList: AggregatedAttribute[] = ['MeasuredValue'];

export const AggregateIntervals: AggregateInterval[] = [10, 60];

const attributeNames: AggregatedAttributeFull[] = [];
for (const statKind of StatKinds) {
    for (const attribute of AttributeList) {
        for (const aggregateInterval of AggregateIntervals) {
            attributeNames.push(`${statKind}${attribute}${aggregateInterval}` as AggregatedAttributeFull);
        }
    }
}

// Map each one onto the OptionalAttribute type
const attributeMap = attributeNames.reduce((acc, attributeName, i) => {
    acc[attributeName] = OptionalAttribute(i, TlvNullable(TlvInt16.bound({ min: -27315, max: 32767 })), { default: null });
    return acc;
}, {} as Record<AggregatedAttributeFull, ReturnType<typeof OptionalAttribute>>);
console.log(attributeMap);
export namespace AggregatedStats {
    /**
     * @see {@link Cluster}
     */
    export const ClusterInstance = MutableCluster({
        id: 0x1337,
        name: "AggregatedStats",
        revision: 1,

        attributes: attributeMap
        // attributes: {
        //     /**
        //      * Indicates the average measured temperature.
        //      *
        //      * The null value indicates that the average measured temperature is unknown or is not being recorded.
        //      *
        //      * See CS 525 Matter Application Cluster Extension (https://docs.google.com/document/d/1Br-RXX_OIgMnbJTYEfhOZdOQT0xYjVlxCxtCGePhgqo/edit?tab=t.0#heading=h.ek5k33x2f7r4)
        //      * for more details.
        //      */
        //     averagemeasuredValueLatest: OptionalAttribute(0x0, TlvNullable(TlvInt16.bound({ min: -27315, max: 32767 })), { default: null }),
        // }
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
