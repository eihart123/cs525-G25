/**
 * @license
 * Copyright 2022-2025 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */
import { existsSync, readFileSync } from "node:fs";
import { cp, writeFile } from "node:fs/promises";
import { ansi } from "../ansi-text/text-builder.js";
import { Graph } from "../building/graph.js";
import { execute } from "../running/execute.js";
const VERSION_FILE = "version.txt";
class Versioner {
  #pkg;
  #version;
  #members = /* @__PURE__ */ new Set();
  get pkg() {
    return this.#pkg;
  }
  get version() {
    return this.#version;
  }
  get appliedVersion() {
    return this.#pkg.json.version;
  }
  constructor(pkg, version) {
    this.#pkg = pkg.workspace;
    if (version === void 0) {
      version = this.#readVersion();
    }
    if (version && !version.match(/^(?:\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?|[a-z]+)$/)) {
      throw new Error(`Version ${version} is invalid (must be semantic or single lowercase word)`);
    }
    this.#version = version;
  }
  async set() {
    await writeFile(this.#versionFile, this.#definiteVersion);
  }
  async apply(progress) {
    const graph = await Graph.load(this.#pkg);
    this.#members = new Set(graph.nodes.map((node) => node.pkg.name));
    for (const node of graph.nodes) {
      const what = `Apply ${ansi.bold(this.#definiteVersion)} to ${ansi.bold(node.pkg.name)}`;
      progress?.update(what);
      if (this.#applyOne(node.pkg)) {
        progress?.success(what);
        await node.pkg.save();
      } else {
        progress?.success(`${what} (no change)`);
      }
      await cp(this.#pkg.resolve("LICENSE"), node.pkg.resolve("LICENSE"));
    }
  }
  async tag() {
    await execute("git", ["tag", "-f", `v${this.#definiteVersion}`]);
  }
  get #definiteVersion() {
    if (this.#version === void 0) {
      throw new Error(`No version supplied and ${this.#versionFile} does not exist`);
    }
    return this.#version;
  }
  get #versionFile() {
    return this.#pkg.resolve(VERSION_FILE);
  }
  #readVersion() {
    const versionFile = this.#versionFile;
    if (!existsSync(versionFile)) {
      return void 0;
    }
    const version = readFileSync(versionFile).toString().trim();
    if (version.length === 0) {
      throw new Error(`Version file ${versionFile} is empty`);
    }
    return version;
  }
  #applyOne(pkg) {
    const json = pkg.json;
    let changed = false;
    if (json.version !== this.#definiteVersion) {
      json.version = this.#definiteVersion;
      changed = true;
    }
    for (const key in json) {
      if (key !== "dependencies" && !key.endsWith("Dependencies")) {
        continue;
      }
      const deps = json[key];
      if (typeof deps !== "object") {
        continue;
      }
      if (this.#applyToDeps(deps)) {
        changed = true;
      }
    }
    return changed;
  }
  #applyToDeps(deps) {
    let changed = false;
    const version = this.#definiteVersion;
    for (const key in deps) {
      if (this.#members.has(key)) {
        if (deps[key] === version) {
          continue;
        }
        deps[key] = this.#definiteVersion;
        changed = true;
      }
    }
    return changed;
  }
}
export {
  Versioner
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vc3JjL3ZlcnNpb25pbmcvdmVyc2lvbmVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgMjAyMi0yMDI1IE1hdHRlci5qcyBBdXRob3JzXG4gKiBTUERYLUxpY2Vuc2UtSWRlbnRpZmllcjogQXBhY2hlLTIuMFxuICovXG5cbmltcG9ydCB7IGV4aXN0c1N5bmMsIHJlYWRGaWxlU3luYyB9IGZyb20gXCJub2RlOmZzXCI7XG5pbXBvcnQgeyBjcCwgd3JpdGVGaWxlIH0gZnJvbSBcIm5vZGU6ZnMvcHJvbWlzZXNcIjtcbmltcG9ydCB7IGFuc2kgfSBmcm9tIFwiLi4vYW5zaS10ZXh0L3RleHQtYnVpbGRlci5qc1wiO1xuaW1wb3J0IHsgR3JhcGggfSBmcm9tIFwiLi4vYnVpbGRpbmcvZ3JhcGguanNcIjtcbmltcG9ydCB7IGV4ZWN1dGUgfSBmcm9tIFwiLi4vcnVubmluZy9leGVjdXRlLmpzXCI7XG5pbXBvcnQgeyBQYWNrYWdlIH0gZnJvbSBcIi4uL3V0aWwvcGFja2FnZS5qc1wiO1xuaW1wb3J0IHsgUHJvZ3Jlc3MgfSBmcm9tIFwiLi4vdXRpbC9wcm9ncmVzcy5qc1wiO1xuXG5jb25zdCBWRVJTSU9OX0ZJTEUgPSBcInZlcnNpb24udHh0XCI7XG5cbmV4cG9ydCBjbGFzcyBWZXJzaW9uZXIge1xuICAgICNwa2c6IFBhY2thZ2U7XG4gICAgI3ZlcnNpb24/OiBzdHJpbmc7XG4gICAgI21lbWJlcnMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICAgIGdldCBwa2coKSB7XG4gICAgICAgIHJldHVybiB0aGlzLiNwa2c7XG4gICAgfVxuXG4gICAgZ2V0IHZlcnNpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLiN2ZXJzaW9uO1xuICAgIH1cblxuICAgIGdldCBhcHBsaWVkVmVyc2lvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuI3BrZy5qc29uLnZlcnNpb247XG4gICAgfVxuXG4gICAgY29uc3RydWN0b3IocGtnOiBQYWNrYWdlLCB2ZXJzaW9uPzogc3RyaW5nKSB7XG4gICAgICAgIHRoaXMuI3BrZyA9IHBrZy53b3Jrc3BhY2U7XG5cbiAgICAgICAgaWYgKHZlcnNpb24gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdmVyc2lvbiA9IHRoaXMuI3JlYWRWZXJzaW9uKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodmVyc2lvbiAmJiAhdmVyc2lvbi5tYXRjaCgvXig/OlxcZCtcXC5cXGQrXFwuXFxkKyg/Oi1bYS16MC05Li1dKyk/fFthLXpdKykkLykpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVmVyc2lvbiAke3ZlcnNpb259IGlzIGludmFsaWQgKG11c3QgYmUgc2VtYW50aWMgb3Igc2luZ2xlIGxvd2VyY2FzZSB3b3JkKWApO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy4jdmVyc2lvbiA9IHZlcnNpb247XG4gICAgfVxuXG4gICAgYXN5bmMgc2V0KCkge1xuICAgICAgICBhd2FpdCB3cml0ZUZpbGUodGhpcy4jdmVyc2lvbkZpbGUsIHRoaXMuI2RlZmluaXRlVmVyc2lvbik7XG4gICAgfVxuXG4gICAgYXN5bmMgYXBwbHkocHJvZ3Jlc3M/OiBQcm9ncmVzcykge1xuICAgICAgICBjb25zdCBncmFwaCA9IGF3YWl0IEdyYXBoLmxvYWQodGhpcy4jcGtnKTtcbiAgICAgICAgdGhpcy4jbWVtYmVycyA9IG5ldyBTZXQoZ3JhcGgubm9kZXMubWFwKG5vZGUgPT4gbm9kZS5wa2cubmFtZSkpO1xuXG4gICAgICAgIGZvciAoY29uc3Qgbm9kZSBvZiBncmFwaC5ub2Rlcykge1xuICAgICAgICAgICAgY29uc3Qgd2hhdCA9IGBBcHBseSAke2Fuc2kuYm9sZCh0aGlzLiNkZWZpbml0ZVZlcnNpb24pfSB0byAke2Fuc2kuYm9sZChub2RlLnBrZy5uYW1lKX1gO1xuICAgICAgICAgICAgcHJvZ3Jlc3M/LnVwZGF0ZSh3aGF0KTtcbiAgICAgICAgICAgIGlmICh0aGlzLiNhcHBseU9uZShub2RlLnBrZykpIHtcbiAgICAgICAgICAgICAgICBwcm9ncmVzcz8uc3VjY2Vzcyh3aGF0KTtcbiAgICAgICAgICAgICAgICBhd2FpdCBub2RlLnBrZy5zYXZlKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHByb2dyZXNzPy5zdWNjZXNzKGAke3doYXR9IChubyBjaGFuZ2UpYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhd2FpdCBjcCh0aGlzLiNwa2cucmVzb2x2ZShcIkxJQ0VOU0VcIiksIG5vZGUucGtnLnJlc29sdmUoXCJMSUNFTlNFXCIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIHRhZygpIHtcbiAgICAgICAgYXdhaXQgZXhlY3V0ZShcImdpdFwiLCBbXCJ0YWdcIiwgXCItZlwiLCBgdiR7dGhpcy4jZGVmaW5pdGVWZXJzaW9ufWBdKTtcbiAgICB9XG5cbiAgICBnZXQgI2RlZmluaXRlVmVyc2lvbigpIHtcbiAgICAgICAgaWYgKHRoaXMuI3ZlcnNpb24gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBObyB2ZXJzaW9uIHN1cHBsaWVkIGFuZCAke3RoaXMuI3ZlcnNpb25GaWxlfSBkb2VzIG5vdCBleGlzdGApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLiN2ZXJzaW9uO1xuICAgIH1cblxuICAgIGdldCAjdmVyc2lvbkZpbGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLiNwa2cucmVzb2x2ZShWRVJTSU9OX0ZJTEUpO1xuICAgIH1cblxuICAgICNyZWFkVmVyc2lvbigpIHtcbiAgICAgICAgY29uc3QgdmVyc2lvbkZpbGUgPSB0aGlzLiN2ZXJzaW9uRmlsZTtcbiAgICAgICAgaWYgKCFleGlzdHNTeW5jKHZlcnNpb25GaWxlKSkge1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHZlcnNpb24gPSByZWFkRmlsZVN5bmModmVyc2lvbkZpbGUpLnRvU3RyaW5nKCkudHJpbSgpO1xuICAgICAgICBpZiAodmVyc2lvbi5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVmVyc2lvbiBmaWxlICR7dmVyc2lvbkZpbGV9IGlzIGVtcHR5YCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdmVyc2lvbjtcbiAgICB9XG5cbiAgICAjYXBwbHlPbmUocGtnOiBQYWNrYWdlKSB7XG4gICAgICAgIGNvbnN0IGpzb24gPSBwa2cuanNvbjtcbiAgICAgICAgbGV0IGNoYW5nZWQgPSBmYWxzZTtcblxuICAgICAgICBpZiAoanNvbi52ZXJzaW9uICE9PSB0aGlzLiNkZWZpbml0ZVZlcnNpb24pIHtcbiAgICAgICAgICAgIGpzb24udmVyc2lvbiA9IHRoaXMuI2RlZmluaXRlVmVyc2lvbjtcbiAgICAgICAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4ganNvbikge1xuICAgICAgICAgICAgaWYgKGtleSAhPT0gXCJkZXBlbmRlbmNpZXNcIiAmJiAha2V5LmVuZHNXaXRoKFwiRGVwZW5kZW5jaWVzXCIpKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGRlcHMgPSBqc29uW2tleV07XG4gICAgICAgICAgICBpZiAodHlwZW9mIGRlcHMgIT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuI2FwcGx5VG9EZXBzKGRlcHMpKSB7XG4gICAgICAgICAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY2hhbmdlZDtcbiAgICB9XG5cbiAgICAjYXBwbHlUb0RlcHMoZGVwczogUmVjb3JkPHN0cmluZywgc3RyaW5nPikge1xuICAgICAgICBsZXQgY2hhbmdlZCA9IGZhbHNlO1xuICAgICAgICBjb25zdCB2ZXJzaW9uID0gdGhpcy4jZGVmaW5pdGVWZXJzaW9uO1xuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBkZXBzKSB7XG4gICAgICAgICAgICBpZiAodGhpcy4jbWVtYmVycy5oYXMoa2V5KSkge1xuICAgICAgICAgICAgICAgIGlmIChkZXBzW2tleV0gPT09IHZlcnNpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGRlcHNba2V5XSA9IHRoaXMuI2RlZmluaXRlVmVyc2lvbjtcbiAgICAgICAgICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2hhbmdlZDtcbiAgICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBTUEsU0FBUyxZQUFZLG9CQUFvQjtBQUN6QyxTQUFTLElBQUksaUJBQWlCO0FBQzlCLFNBQVMsWUFBWTtBQUNyQixTQUFTLGFBQWE7QUFDdEIsU0FBUyxlQUFlO0FBSXhCLE1BQU0sZUFBZTtBQUVkLE1BQU0sVUFBVTtBQUFBLEVBQ25CO0FBQUEsRUFDQTtBQUFBLEVBQ0EsV0FBVyxvQkFBSSxJQUFZO0FBQUEsRUFFM0IsSUFBSSxNQUFNO0FBQ04sV0FBTyxLQUFLO0FBQUEsRUFDaEI7QUFBQSxFQUVBLElBQUksVUFBVTtBQUNWLFdBQU8sS0FBSztBQUFBLEVBQ2hCO0FBQUEsRUFFQSxJQUFJLGlCQUFpQjtBQUNqQixXQUFPLEtBQUssS0FBSyxLQUFLO0FBQUEsRUFDMUI7QUFBQSxFQUVBLFlBQVksS0FBYyxTQUFrQjtBQUN4QyxTQUFLLE9BQU8sSUFBSTtBQUVoQixRQUFJLFlBQVksUUFBVztBQUN2QixnQkFBVSxLQUFLLGFBQWE7QUFBQSxJQUNoQztB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
