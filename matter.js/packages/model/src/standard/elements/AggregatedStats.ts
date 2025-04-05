/**
 * @license
 * Copyright 2022-2025 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/*** THIS FILE IS GENERATED, DO NOT EDIT ***/
/**
 * 
 * It is unclear whether we need this file.
 */

import { MatterDefinition } from "../MatterDefinition.js";
import { ClusterElement as Cluster, AttributeElement as Attribute } from "../../elements/index.js";
// import { type AggregatedAttributeFull, StatKinds, AttributeList, AggregateIntervals } from "@matter/types/clusters/aggregated-stats";


// Duplicated from @matter/types/clusters/aggregated-stats
const StatKinds: string[] = ['Average'];
const AttributeList: Record<string, string>[] = [
    {
        name: 'MeasuredValue',
        metatype: 'temperature',
    },
];

const AggregateIntervals: string[] = ["10", "60"];

const attributeList: any[] = [];
let i = 0x0;
for (const statKind of StatKinds) {
    for (const attribute of AttributeList) {
        for (const aggregateInterval of AggregateIntervals) {
            attributeList.push(Attribute({
                name: `${statKind}${attribute.name}${aggregateInterval}`, id: i, type: attribute.metatype, access: "R V", conformance: "O",
                constraint: "-27315 to 32766", quality: "X P",
                details: "TODOTODO detailes",
                xref: { document: "cluster", section: "1337.0.4.1" }
            }))
            i++;
        }
    }
}


export const AggregatedStats = Cluster(
    {
        name: "AggregatedStats", id: 0x1337, classification: "application", pics: "AGG",
        details: "This cluster provides an interface to aggregated statistics functionality, including configuration and provision of notifications of average temperature measurements.",
        xref: { document: "cluster", section: "1337.0" }
    },

    Attribute({ name: "ClusterRevision", id: 0xfffd, type: "ClusterRevision", default: 1 }),
    ...attributeList,
    // Attribute({
    //     name: "AverageMeasuredValueLatest", id: 0x0, type: "temperature", access: "R V", conformance: "O",
    //     constraint: "-27315 to 32766", quality: "X P",
    //     details: "Indicates the average measured temperature. The null value indicates that the average measured temperature is unknown or is not being recorded.",
    //     xref: { document: "cluster", section: "1337.0.4.1" }
    // }),
);

MatterDefinition.children.push(AggregatedStats);
