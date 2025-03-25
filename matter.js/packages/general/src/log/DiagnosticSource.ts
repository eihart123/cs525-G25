/**
 * @license
 * Copyright 2022-2025 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Diagnostic, IDiagnostic } from "./Diagnostic.js";

const sources = new Set<IDiagnostic>();

/**
 * Registry of diagnostic sources.
 */
export const DiagnosticSource = {
    add(source: IDiagnostic) {
        sources.add(source);
    },

    delete(source: IDiagnostic) {
        sources.delete(source);
    },

    get [Diagnostic.presentation]() {
        return Diagnostic.Presentation.List;
    },

    get [Diagnostic.value]() {
        return sources;
    },
};
