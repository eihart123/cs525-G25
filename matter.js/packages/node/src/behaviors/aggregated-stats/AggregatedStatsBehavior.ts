/**
 * @license
 * Copyright 2022-2025 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/* CS 525 G25 */

import { AggregatedStats } from "#clusters/aggregated-stats";
import { ClusterBehavior } from "../../behavior/cluster/ClusterBehavior.js";

/**
 * AggregatedStatsBehavior is the base class for objects that support interaction with
 * {@link TemperatureMeasurement.Cluster}.
 */
export const AggregatedStatsBehavior = ClusterBehavior.for(AggregatedStats.Cluster);

type AggregatedStatsBehaviorType = InstanceType<typeof AggregatedStatsBehavior>;
export interface AggregatedStatsBehavior extends AggregatedStatsBehaviorType {}
type StateType = InstanceType<typeof AggregatedStatsBehavior.State>;
export namespace AggregatedStatsBehavior { export interface State extends StateType {} }
