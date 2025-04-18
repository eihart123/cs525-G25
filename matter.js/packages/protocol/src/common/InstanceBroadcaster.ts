/**
 * @license
 * Copyright 2022-2025 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { BitFlag, BitmapSchema, ProductDescription, TypeFromPartialBitSchema, VendorId } from "#types";
import { Fabric } from "../fabric/Fabric.js";

export const PairingHintBitmap = {
    /**
     * The Device will automatically enter Commissioning Mode upon power cycle (unplug/re- plug, remove/re-insert
     * batteries). This bit SHALL be set to 1 for devices using Standard Commissioning Flow, and set to 0 otherwise.
     */
    powerCycle: BitFlag(0),

    /**
     * This SHALL be set to 1 for devices requiring Custom Commissioning Flow before they can be available for
     * Commissioning by any Commissioner. For such a flow, the user SHOULD be sent to the URL specified in the
     * CommissioningCustomFlowUrl of the DeviceModel schema entry indexed by the Vendor ID and Product ID (e.g., as
     * found in the announcement) in the Distributed Compliance Ledger.
     */
    deviceManufacturerUrl: BitFlag(1),

    /**
     * The Device has been commissioned. Any Administrator that commissioned the device provides a user interface that
     * may be used to put the device into Commissioning Mode.
     */
    administrator: BitFlag(2),

    /**
     * The settings menu on the Device provides instructions to put it into Commissioning Mode.
     */
    settingsMenuOnNode: BitFlag(3),

    /**
     * The PI key/value pair describes a custom way to put the Device into Commissioning Mode. This Custom Instruction
     * option is NOT recommended for use by a Device that does not have knowledge of the user’s language preference.
     */
    customInstruction: BitFlag(4),

    /**
     * The Device Manual provides special instructions to put the Device into Commissioning Mode (see Section 11.22.5.8,
     * “UserManualUrl”). This is a catch-all option to capture user interactions that are not codified by other options
     * in this table.
     */
    deviceManual: BitFlag(5),

    /**
     * The Device will enter Commissioning Mode when reset button is pressed.
     */
    pressResetButton: BitFlag(6),

    /**
     * The Device will enter Commissioning Mode when reset button is pressed when applying power to it.
     */
    pressResetButtonWithApplicationOfPower: BitFlag(7),

    /**
     * The Device will enter Commissioning Mode when reset button is pressed for N seconds. The exact value of N SHALL
     * be made available via PI key.
     */
    pressRestButtonForNumberOfSeconds: BitFlag(8),

    /**
     * The Device will enter Commissioning Mode when reset button is pressed until associated light blinks.
     * Information on color of light MAY be made available via PI key (see Note 1).
     */
    pressResetButtonUntilLightBlinks: BitFlag(9),

    /**
     * The Device will enter Commissioning Mode when reset button is pressed for N seconds when applying power to it.
     * The exact value of N SHALL be made available via PI key.
     */
    pressResetButtonForNumberOfSecondsWithApplicationOfPower: BitFlag(10),

    /**
     * The Device will enter Commissioning Mode when reset button is pressed until associated light blinks when
     * applying power to the Device. Information on color of light MAY be made available via PI key (see Note 1).
     */
    pressResetButtonUntilLightBlinksWithApplicationOfPower: BitFlag(11),

    /**
     * The Device will enter Commissioning Mode when reset button is pressed N times with maximum 1 second between each
     * press. The exact value of N SHALL be made available via PI key.
     */
    pressResetButtonNumberOfTimes: BitFlag(12),

    /**
     * The Device will enter Commissioning Mode when setup button is pressed.
     */
    pressSetupButton: BitFlag(13),

    /**
     * The Device will enter Commissioning Mode when setup button is pressed when applying power to it.
     */
    pressSetupButtonWithApplicationOfPower: BitFlag(14),

    /**
     * The Device will enter Commissioning Mode when setup button is pressed for N seconds. The exact value of N SHALL
     * be made available via PI key.
     */
    pressSetupButtonForNumberOfSeconds: BitFlag(15),

    /**
     * The Device will enter Commissioning Mode when setup button is pressed until associated light blinks.
     * Information on color of light MAY be made available via PI key (see Note 1).
     */
    pressSetupButtonUntilLightBlinks: BitFlag(16),

    /**
     * The Device will enter Commissioning Mode when setup button is pressed for N seconds when applying power to it.
     * The exact value of N SHALL be made available via PI key.
     */
    pressSetupButtonForNumberOfSecondsWithApplicationOfPower: BitFlag(17),

    /**
     * The Device will enter Commissioning Mode when setup button is pressed until associated light blinks when
     * applying power to the Device. Information on color of light MAY be made available via PI key (see Note 1).
     */
    pressSetupButtonUntilLightBlinksWithApplicationOfPower: BitFlag(18),

    /**
     * The Device will enter Commissioning Mode when setup button is pressed N times with maximum 1 second between each
     * press. The exact value of N SHALL be made available via PI key.
     */
    pressSetupButtonNumberOfTimes: BitFlag(19),
};

export const PairingHintBitmapSchema = BitmapSchema(PairingHintBitmap);

export interface CommissioningModeInstanceData extends ProductDescription {
    /** Device discriminator for commissionable announcements. */
    discriminator: number;

    /** Session Idle Interval of the device for commissionable announcements. */
    sessionIdleInterval?: number;

    /** Session Active Interval of the device for commissionable announcements. */
    sessionActiveInterval?: number;

    /** Duration of time the node should stay active after the last network activity. **/
    sessionActiveThreshold?: number;

    /** Pairing hint of the device for commissionable announcements. */
    pairingHint?: TypeFromPartialBitSchema<typeof PairingHintBitmap>;

    /** Pairing instruction of the device for commissionable announcements. */
    pairingInstructions?: string;
}

export type CommissionerInstanceData = {
    /** Device name for commissionable announcements. */
    deviceName: string;

    /** Device type for commissionable announcements. */
    vendorId: VendorId;

    /** Vendor ID for commissionable announcements. */
    productId: number;

    /** Device type for commissionable announcements. */
    deviceType?: number;

    /** Session Idle Interval of the device for commissionable announcements. */
    sessionIdleInterval?: number;

    /** Session Active Interval of the device for commissionable announcements. */
    sessionActiveInterval?: number;

    /** This key defines the duration of time the node stays Active after the last network activity. **/
    sessionActiveThreshold?: number;
};

export type OperationalInstanceData = {
    /** Session Idle Interval of the device for operational announcements. */
    sessionIdleInterval?: number;

    /** Session Active Interval of the device for operational announcements. */
    sessionActiveInterval?: number;

    /** This key defines the duration of time the node stays Active after the last network activity. **/
    sessionActiveThreshold?: number;
};

export enum CommissioningMode {
    NotCommissioning = 0,
    Basic = 1,
    Enhanced = 2,
}

/** Interface for classes that allow to announce one Matter instance. */
export interface InstanceBroadcaster {
    /** Set a commissionable mode and details to announce a commissionable device. */
    setCommissionMode(mode: CommissioningMode, deviceData: CommissioningModeInstanceData): Promise<void>;

    /**
     * Set operational details to Announce an operational device which is already commissioned.
     * Use expireCommissioningAnnouncements = true when Fabrics are changed after a n commissioning process.
     */
    setFabrics(fabrics: Fabric[], expireCommissioningAnnouncements?: boolean): Promise<void>;

    /** Set commissioner details to announce a commissioner service for User directed commissioning (UDC). */
    setCommissionerInfo(commissionerData: CommissionerInstanceData): Promise<void>;

    /** Send out announcements for this instance. */
    announce(): Promise<void>;

    /** Expire the announcement for this operative instance. */
    expireFabricAnnouncement(): Promise<void>;

    /** Expire the announcement for this commissioning instance. */
    expireCommissioningAnnouncement(): Promise<void>;

    /** Expire all announcements. */
    expireAllAnnouncements(): Promise<void>;

    /** Destroy the instance */
    close(): Promise<void>;
}
