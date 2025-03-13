/**
 * @license
 * Copyright 2022-2025 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { ignoreError, ignoreErrorSync } from "./errors.js";
import { isFile, maybeReadJsonSync, maybeStatSync } from "./file.js";
import { globSync } from "./glob.js";
import { ImportAliases } from "./import-aliases.js";
import { Progress } from "./progress.js";
import { toolsPath } from "./tools-path.cjs";
class JsonNotFoundError extends Error {
}
const CONFIG_PATH = `src/build.config.ts`;
const CODEGEN_PATH = `codegen`;
const packageForPath = {};
function findJson(filename, path = ".", title) {
  path = resolve(path);
  while (true) {
    const json = ignoreErrorSync(
      ["ENOENT", "ENOTDIR"],
      () => JSON.parse(readFileSync(resolve(path, filename)).toString())
    );
    if (json) {
      if (title === void 0 || json.name === title) {
        return { root: path, json };
      }
    }
    const parent = dirname(path);
    if (parent === path) {
      throw new JsonNotFoundError(`Could not locate ${title ?? filename}`);
    }
    path = parent;
  }
}
function isDirectory(path) {
  return !!ignoreErrorSync("ENOENT", () => statSync(path).isDirectory());
}
class Package {
  path;
  json;
  supportsEsm;
  supportsCjs;
  hasSrc;
  hasTests;
  hasConfig;
  isLibrary;
  #importAliases;
  constructor({
    path = ".",
    name
  } = {}) {
    const { root, json } = findJson("package.json", path, name);
    this.path = root;
    this.json = json;
    const { esm, cjs } = selectFormats(this.json);
    this.supportsEsm = esm;
    this.supportsCjs = cjs;
    this.hasSrc = isDirectory(this.resolve("src"));
    this.hasTests = isDirectory(this.resolve("test"));
    const refs = maybeReadJsonSync(this.resolve("tsconfig.json"))?.references;
    if (refs !== void 0) {
      if (!refs.find((ref) => this.resolve(ref.path) === this.resolve("src"))) {
        this.hasSrc = false;
      }
      if (!refs.find((ref) => this.resolve(ref.path) === this.resolve("test"))) {
        this.hasTests = false;
      }
    }
    this.isLibrary = !!(this.json.main || this.json.module || this.json.exports);
    this.hasConfig = this.hasFile(this.resolve(CONFIG_PATH));
  }
  get name() {
    return this.json.name;
  }
  get version() {
    return this.json.version;
  }
  get exports() {
    return this.json.exports;
  }
  get hasCodegen() {
    return this.hasDirectory(CODEGEN_PATH);
  }
  resolve(...paths) {
    return resolve(this.path, ...paths);
  }
  relative(path) {
    return relative(this.path, path);
  }
  async glob(pattern) {
    if (typeof pattern === "string") {
      pattern = this.resolve(pattern).replace(/\\/g, "/");
    } else {
      pattern = pattern.map((s) => this.resolve(s).replace(/\\/g, "/"));
    }
    return globSync(pattern);
  }
  start(what) {
    const progress = new Progress();
    progress.startup(what, this);
    return progress;
  }
  async lastModified(...paths) {
    return this.lastModifiedAbsolute(paths.map((p) => this.resolve(p)));
  }
  async lastModifiedAbsolute(paths) {
    let mtime = 0;
    await Promise.all(
      paths.map(async (p) => {
        const stats = await ignoreError("ENOENT", async () => await stat(p));
        if (!stats) {
          return;
        }
        let thisMtime;
        if (stats.isDirectory()) {
          const paths2 = (await readdir(p)).map((p2) => resolve(p, p2));
          thisMtime = await this.lastModifiedAbsolute(paths2);
        } else {
          thisMtime = stats.mtimeMs;
        }
        if (thisMtime > mtime) {
          mtime = thisMtime;
        }
      })
    );
    return mtime;
  }
  get dependencies() {
    let result = Array();
    for (const type of ["dependencies", "optionalDependencies", "devDependencies", "peerDependencies"]) {
      if (typeof this.json[type] === "object" && this.json[type] !== null) {
        result = [...result, ...Object.keys(this.json[type])];
      }
    }
    return [...new Set(result)];
  }
  get workspace() {
    return Package.workspaceFor(this.path);
  }
  get isWorkspace() {
    return Array.isArray(this.json.workspaces);
  }
  get root() {
    try {
      return this.workspace;
    } catch (e) {
      if (!(e instanceof JsonNotFoundError)) {
        throw e;
      }
    }
    return this;
  }
  static set workingDir(wd) {
    workingDir = wd;
  }
  static get workspace() {
    return this.workspaceFor(workingDir);
  }
  static workspaceFor(cwd) {
    if (!workspace) {
      workspace = find(cwd, (pkg) => Array.isArray(pkg.json.workspaces));
    }
    return workspace;
  }
  static get tools() {
    if (!tools) {
      tools = new Package({ path: toolsPath });
    }
    return tools;
  }
  static findExport(name, type = "esm") {
    return this.workspace.resolveImport(name, type);
  }
  resolveExport(name, type = "esm") {
    if (!name.startsWith(".")) {
      name = `./${name}`;
    }
    const exportDetail = this.exports?.[name];
    if (exportDetail) {
      const exp = findExportCondition(exportDetail, type);
      if (exp) {
        return this.resolve(exp);
      }
    }
    if (name === ".") {
      if (type === "esm" && this.json.module) {
        return this.resolve(this.json.module);
      }
      if (this.json.main) {
        return this.resolve(this.json.main);
      }
    }
    throw new Error(`Cannot resolve export ${name} in package ${this.name}`);
  }
  findPackage(name) {
    let resolveIn = this.path;
    while (true) {
      if (isDirectory(resolve(resolveIn, "node_modules", name))) {
        break;
      }
      const nextResolveIn = dirname(resolveIn);
      if (nextResolveIn === resolveIn) {
        throw new Error(`Cannot find module ${name} from ${this.path}`);
      }
      resolveIn = nextResolveIn;
    }
    return Package.forPath(resolve(resolveIn, "node_modules", name));
  }
  resolveImport(name, type = "esm") {
    const segments = name.split("/");
    let packageName = segments.shift();
    if (packageName.startsWith("@") && segments.length) {
      packageName = `${packageName}/${segments.shift()}`;
    }
    const pkg = this.findPackage(packageName);
    return pkg.resolveExport(segments.length ? segments.join("/") : ".", type);
  }
  hasFile(path) {
    return !!this.#maybeStat(path)?.isFile();
  }
  hasDirectory(path) {
    return !!this.#maybeStat(path)?.isDirectory();
  }
  async readFile(path) {
    return readFile(this.resolve(path), "utf-8");
  }
  readFileSync(path) {
    return readFileSync(this.resolve(path), "utf-8");
  }
  async writeFile(path, contents) {
    await writeFile(this.resolve(path), `${contents}`);
  }
  async save() {
    await this.writeFile(join(this.path, "package.json"), JSON.stringify(this.json, void 0, 4));
  }
  async readJson(path) {
    const text = await this.readFile(path);
    try {
      return JSON.parse(text);
    } catch (e) {
      if (!(e instanceof Error)) {
        e = new Error(`${e}`);
      }
      e.message = `Error parsing "${this.resolve(path)}": ${e.message}`;
      throw e;
    }
  }
  async writeJson(path, value) {
    await this.writeFile(path, JSON.stringify(value, void 0, 4));
  }
  static maybeForPath(path) {
    function find2(path2) {
      let result2 = packageForPath[path2];
      if (result2 === void 0) {
        if (existsSync(join(path2, "package.json"))) {
          result2 = new Package({ path: path2 });
        } else {
          const parentDir = dirname(path2);
          if (parentDir === path2) {
            return null;
          }
          result2 = find2(parentDir);
        }
        packageForPath[path2] = result2;
      }
      return result2;
    }
    const result = find2(path);
    return result ?? void 0;
  }
  static forPath(path) {
    const result = this.maybeForPath(path);
    if (result !== void 0) {
      return result;
    }
    throw new Error(`Cannot find package.json for "${path}"`);
  }
  get importAliases() {
    if (this.#importAliases !== void 0) {
      return this.#importAliases;
    }
    this.#importAliases = new ImportAliases(
      this.json.imports,
      Package.maybeForPath(dirname(this.path))?.importAliases
    );
    return this.#importAliases;
  }
  get modules() {
    return this.listModules(false);
  }
  get sourceModules() {
    return this.listModules(true);
  }
  /**
   * Create a map of module name -> implementation file.  If "source" is true, searches source files rather than
   * transpiled files.  We do this rather than finding transpilation files then mapping to source files so this works
   * even if there isn't a build.
   */
  listModules(source, ...conditions) {
    if (!conditions.length) {
      conditions = [this.supportsEsm ? "import" : "require", "default"];
    }
    const modules = {};
    const exports = this.exports;
    if (typeof exports === "object" && exports !== null) {
      findModules(source, new Set(conditions), modules, this.name, this.path, exports);
    }
    return modules;
  }
  #maybeStat(path) {
    return maybeStatSync(this.resolve(path));
  }
}
let workingDir = ".";
let workspace;
let tools;
function find(startDir, selector) {
  let pkg = new Package({ path: startDir });
  while (!selector(pkg)) {
    pkg = new Package({ path: dirname(pkg.path) });
  }
  return pkg;
}
function selectFormats(json) {
  let esm, cjs;
  if (json.type === "module") {
    esm = true;
    cjs = json.main !== void 0 && json.module !== void 0 || !!Object.values(json.exports ?? {}).find((exp) => exp.require);
  } else {
    cjs = true;
    esm = !!json.module || !!Object.values(json.exports ?? {}).find((exp) => exp.import);
  }
  return { esm, cjs };
}
function findExportCondition(detail, type) {
  if (type === "esm" && detail.import) {
    let exp2 = detail.import;
    if (exp2 && typeof exp2 !== "string") {
      exp2 = findExportCondition(exp2, type);
    }
    if (exp2) {
      return exp2;
    }
  }
  let exp = detail.require ?? detail.node ?? detail.default;
  if (exp && typeof exp !== "string") {
    exp = findExportCondition(exp, type);
  }
  if (typeof exp === "string") {
    return exp;
  }
}
function findModules(source, conditions, target, prefix, path, exports) {
  if (typeof exports === "string") {
    addModuleGlobs(source, target, prefix, path, exports);
  } else if (Array.isArray(exports)) {
    for (const entry of exports) {
      findModules(source, conditions, target, prefix, path, entry);
    }
  } else if (typeof exports === "object" && exports !== null) {
    let selectedCondition = false;
    for (const key in exports) {
      if (key.startsWith(".")) {
        findModules(source, conditions, target, join(prefix, key), path, exports[key]);
      } else if (!selectedCondition && conditions.has(key)) {
        findModules(source, conditions, target, prefix, path, exports[key]);
        selectedCondition = true;
      }
    }
  } else {
    throw new Error("Malformed exports field in package.json");
  }
}
function addModuleGlobs(source, target, name, base, pattern) {
  let path = join(base, pattern);
  if (source) {
    path = path.replace(/\/dist\/(?:esm|cjs)\//, "/src/");
  }
  if (name.includes("*")) {
    if (!name.endsWith("/*")) {
      throw new Error(`Wildcard in module ${name} does not appear as final path segment`);
    }
    name = name.substring(0, name.length - 2);
    const paths = globSync(source ? path.replace(/\.js$/, ".{ts,js,cjs,mjs}") : path);
    if (!paths.length) {
      throw new Error(`No match for module ${name} pattern ${pattern}`);
    }
    const [prefix, suffix] = path.split(/\*+/);
    const prefixLength = prefix === void 0 ? 0 : prefix.length;
    const suffixLength = suffix === void 0 ? 0 : suffix.length;
    for (const thisPath of paths) {
      const qualifier = thisPath.substring(prefixLength, thisPath.length - suffixLength);
      const thisName = join(name, qualifier);
      target[thisName] = thisPath;
    }
  } else if (path.includes("*")) {
    throw new Error(`Wildcard in module path "${path}" but not in module "${name}"`);
  } else {
    name = name.replace(/\/(?:export|index)$/, "");
    let found = false;
    if (isFile(path)) {
      found = true;
    } else if (source && path.endsWith(".js")) {
      path = path.replace(/\.js$/, ".ts");
      if (isFile(path)) {
        found = true;
      }
    }
    if (!found) {
      throw new Error(`Module "${name}" path "${path}" not found`);
    }
    target[name] = path;
  }
}
export {
  CODEGEN_PATH,
  CONFIG_PATH,
  JsonNotFoundError,
  Package
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vc3JjL3V0aWwvcGFja2FnZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IDIwMjItMjAyNSBNYXR0ZXIuanMgQXV0aG9yc1xuICogU1BEWC1MaWNlbnNlLUlkZW50aWZpZXI6IEFwYWNoZS0yLjBcbiAqL1xuXG5pbXBvcnQgeyBleGlzdHNTeW5jLCByZWFkRmlsZVN5bmMsIHN0YXRTeW5jIH0gZnJvbSBcIm5vZGU6ZnNcIjtcbmltcG9ydCB7IHJlYWRkaXIsIHJlYWRGaWxlLCBzdGF0LCB3cml0ZUZpbGUgfSBmcm9tIFwibm9kZTpmcy9wcm9taXNlc1wiO1xuaW1wb3J0IHsgZGlybmFtZSwgam9pbiwgcmVsYXRpdmUsIHJlc29sdmUgfSBmcm9tIFwibm9kZTpwYXRoXCI7XG5pbXBvcnQgeyBpZ25vcmVFcnJvciwgaWdub3JlRXJyb3JTeW5jIH0gZnJvbSBcIi4vZXJyb3JzLmpzXCI7XG5pbXBvcnQgeyBpc0ZpbGUsIG1heWJlUmVhZEpzb25TeW5jLCBtYXliZVN0YXRTeW5jIH0gZnJvbSBcIi4vZmlsZS5qc1wiO1xuaW1wb3J0IHsgZ2xvYlN5bmMgfSBmcm9tIFwiLi9nbG9iLmpzXCI7XG5pbXBvcnQgeyBJbXBvcnRBbGlhc2VzIH0gZnJvbSBcIi4vaW1wb3J0LWFsaWFzZXMuanNcIjtcbmltcG9ydCB7IFByb2dyZXNzIH0gZnJvbSBcIi4vcHJvZ3Jlc3MuanNcIjtcbmltcG9ydCB7IHRvb2xzUGF0aCB9IGZyb20gXCIuL3Rvb2xzLXBhdGguY2pzXCI7XG5cbmV4cG9ydCBjbGFzcyBKc29uTm90Rm91bmRFcnJvciBleHRlbmRzIEVycm9yIHt9XG5cbmV4cG9ydCBjb25zdCBDT05GSUdfUEFUSCA9IGBzcmMvYnVpbGQuY29uZmlnLnRzYDtcbmV4cG9ydCBjb25zdCBDT0RFR0VOX1BBVEggPSBgY29kZWdlbmA7XG5cbmNvbnN0IHBhY2thZ2VGb3JQYXRoID0ge30gYXMgUmVjb3JkPHN0cmluZywgUGFja2FnZSB8IHVuZGVmaW5lZCB8IG51bGw+O1xuXG5mdW5jdGlvbiBmaW5kSnNvbihmaWxlbmFtZTogc3RyaW5nLCBwYXRoOiBzdHJpbmcgPSBcIi5cIiwgdGl0bGU/OiBzdHJpbmcpIHtcbiAgICBwYXRoID0gcmVzb2x2ZShwYXRoKTtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICBjb25zdCBqc29uID0gaWdub3JlRXJyb3JTeW5jKFtcIkVOT0VOVFwiLCBcIkVOT1RESVJcIl0sICgpID0+XG4gICAgICAgICAgICBKU09OLnBhcnNlKHJlYWRGaWxlU3luYyhyZXNvbHZlKHBhdGgsIGZpbGVuYW1lKSkudG9TdHJpbmcoKSksXG4gICAgICAgICk7XG5cbiAgICAgICAgaWYgKGpzb24pIHtcbiAgICAgICAgICAgIGlmICh0aXRsZSA9PT0gdW5kZWZpbmVkIHx8IGpzb24ubmFtZSA9PT0gdGl0bGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyByb290OiBwYXRoLCBqc29uIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcGFyZW50ID0gZGlybmFtZShwYXRoKTtcbiAgICAgICAgaWYgKHBhcmVudCA9PT0gcGF0aCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEpzb25Ob3RGb3VuZEVycm9yKGBDb3VsZCBub3QgbG9jYXRlICR7dGl0bGUgPz8gZmlsZW5hbWV9YCk7XG4gICAgICAgIH1cbiAgICAgICAgcGF0aCA9IHBhcmVudDtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGlzRGlyZWN0b3J5KHBhdGg6IHN0cmluZykge1xuICAgIHJldHVybiAhIWlnbm9yZUVycm9yU3luYyhcIkVOT0VOVFwiLCAoKSA9PiBzdGF0U3luYyhwYXRoKS5pc0RpcmVjdG9yeSgpKTtcbn1cblxuZXhwb3J0IGNsYXNzIFBhY2thZ2Uge1xuICAgIHBhdGg6IHN0cmluZztcbiAgICBqc29uOiBQYWNrYWdlSnNvbjtcbiAgICBzdXBwb3J0c0VzbTogYm9vbGVhbjtcbiAgICBzdXBwb3J0c0NqczogYm9vbGVhbjtcbiAgICBoYXNTcmM6IGJvb2xlYW47XG4gICAgaGFzVGVzdHM6IGJvb2xlYW47XG4gICAgaGFzQ29uZmlnOiBib29sZWFuO1xuICAgIGlzTGlicmFyeTogYm9vbGVhbjtcbiAgICAjaW1wb3J0QWxpYXNlcz86IEltcG9ydEFsaWFzZXM7XG5cbiAgICBjb25zdHJ1Y3Rvcih7XG4gICAgICAgIHBhdGggPSBcIi5cIixcbiAgICAgICAgbmFtZSxcbiAgICB9OiB7XG4gICAgICAgIHBhdGg/OiBzdHJpbmc7XG4gICAgICAgIG5hbWU/OiBzdHJpbmc7XG4gICAgfSA9IHt9KSB7XG4gICAgICAgIGNvbnN0IHsgcm9vdCwganNvbiB9ID0gZmluZEpzb24oXCJwYWNrYWdlLmpzb25cIiwgcGF0aCwgbmFtZSk7XG4gICAgICAgIHRoaXMucGF0aCA9IHJvb3Q7XG4gICAgICAgIHRoaXMuanNvbiA9IGpzb247XG5cbiAgICAgICAgY29uc3QgeyBlc20sIGNqcyB9ID0gc2VsZWN0Rm9ybWF0cyh0aGlzLmpzb24pO1xuICAgICAgICB0aGlzLnN1cHBvcnRzRXNtID0gZXNtO1xuICAgICAgICB0aGlzLnN1cHBvcnRzQ2pzID0gY2pzO1xuXG4gICAgICAgIHRoaXMuaGFzU3JjID0gaXNEaXJlY3RvcnkodGhpcy5yZXNvbHZlKFwic3JjXCIpKTtcbiAgICAgICAgdGhpcy5oYXNUZXN0cyA9IGlzRGlyZWN0b3J5KHRoaXMucmVzb2x2ZShcInRlc3RcIikpO1xuXG4gICAgICAgIGNvbnN0IHJlZnMgPSBtYXliZVJlYWRKc29uU3luYyh0aGlzLnJlc29sdmUoXCJ0c2NvbmZpZy5qc29uXCIpKT8ucmVmZXJlbmNlcyBhcyB1bmRlZmluZWQgfCB7IHBhdGg6IHN0cmluZyB9W107XG4gICAgICAgIGlmIChyZWZzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmICghcmVmcy5maW5kKHJlZiA9PiB0aGlzLnJlc29sdmUocmVmLnBhdGgpID09PSB0aGlzLnJlc29sdmUoXCJzcmNcIikpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5oYXNTcmMgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghcmVmcy5maW5kKHJlZiA9PiB0aGlzLnJlc29sdmUocmVmLnBhdGgpID09PSB0aGlzLnJlc29sdmUoXCJ0ZXN0XCIpKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuaGFzVGVzdHMgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuaXNMaWJyYXJ5ID0gISEodGhpcy5qc29uLm1haW4gfHwgdGhpcy5qc29uLm1vZHVsZSB8fCB0aGlzLmpzb24uZXhwb3J0cyk7XG5cbiAgICAgICAgdGhpcy5oYXNDb25maWcgPSB0aGlzLmhhc0ZpbGUodGhpcy5yZXNvbHZlKENPTkZJR19QQVRIKSk7XG4gICAgfVxuXG4gICAgZ2V0IG5hbWUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmpzb24ubmFtZTtcbiAgICB9XG5cbiAgICBnZXQgdmVyc2lvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuanNvbi52ZXJzaW9uO1xuICAgIH1cblxuICAgIGdldCBleHBvcnRzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5qc29uLmV4cG9ydHM7XG4gICAgfVxuXG4gICAgZ2V0IGhhc0NvZGVnZW4oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmhhc0RpcmVjdG9yeShDT0RFR0VOX1BBVEgpO1xuICAgIH1cblxuICAgIHJlc29sdmUoLi4ucGF0aHM6IHN0cmluZ1tdKSB7XG4gICAgICAgIHJldHVybiByZXNvbHZlKHRoaXMucGF0aCwgLi4ucGF0aHMpO1xuICAgIH1cblxuICAgIHJlbGF0aXZlKHBhdGg6IHN0cmluZykge1xuICAgICAgICByZXR1cm4gcmVsYXRpdmUodGhpcy5wYXRoLCBwYXRoKTtcbiAgICB9XG5cbiAgICBhc3luYyBnbG9iKHBhdHRlcm46IHN0cmluZyB8IHN0cmluZ1tdKSB7XG4gICAgICAgIC8vIEdsb2Igb25seSB1bmRlcnN0YW5kcyBmb3J3YXJkLXNsYXNoIGFzIHNlcGFyYXRvciBiZWNhdXNlIHJlYXNvbnNcbiAgICAgICAgaWYgKHR5cGVvZiBwYXR0ZXJuID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICBwYXR0ZXJuID0gdGhpcy5yZXNvbHZlKHBhdHRlcm4pLnJlcGxhY2UoL1xcXFwvZywgXCIvXCIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGF0dGVybiA9IHBhdHRlcm4ubWFwKHMgPT4gdGhpcy5yZXNvbHZlKHMpLnJlcGxhY2UoL1xcXFwvZywgXCIvXCIpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEN1cnJlbnQgZ2xvYiBpbXBsZW1lbnRhdGlvbiBpc24ndCBhY3R1YWxseSBhc3luYyBhcyB0aGlzIGlzIGZhc3RlciBhbmQgd2Ugb25seSB3YWxrIHNtYWxsIGRpcmVjdG9yeSB0cmVlc1xuICAgICAgICByZXR1cm4gZ2xvYlN5bmMocGF0dGVybik7XG4gICAgfVxuXG4gICAgc3RhcnQod2hhdDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHByb2dyZXNzID0gbmV3IFByb2dyZXNzKCk7XG4gICAgICAgIHByb2dyZXNzLnN0YXJ0dXAod2hhdCwgdGhpcyk7XG4gICAgICAgIHJldHVybiBwcm9ncmVzcztcbiAgICB9XG5cbiAgICBhc3luYyBsYXN0TW9kaWZpZWQoLi4ucGF0aHM6IHN0cmluZ1tdKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxhc3RNb2RpZmllZEFic29sdXRlKHBhdGhzLm1hcChwID0+IHRoaXMucmVzb2x2ZShwKSkpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgbGFzdE1vZGlmaWVkQWJzb2x1dGUocGF0aHM6IHN0cmluZ1tdKSB7XG4gICAgICAgIGxldCBtdGltZSA9IDA7XG4gICAgICAgIGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgICAgICAgcGF0aHMubWFwKGFzeW5jIHAgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHN0YXRzID0gYXdhaXQgaWdub3JlRXJyb3IoXCJFTk9FTlRcIiwgYXN5bmMgKCkgPT4gYXdhaXQgc3RhdChwKSk7XG4gICAgICAgICAgICAgICAgaWYgKCFzdGF0cykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbGV0IHRoaXNNdGltZTtcbiAgICAgICAgICAgICAgICBpZiAoc3RhdHMuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXRocyA9IChhd2FpdCByZWFkZGlyKHApKS5tYXAocDIgPT4gcmVzb2x2ZShwLCBwMikpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzTXRpbWUgPSBhd2FpdCB0aGlzLmxhc3RNb2RpZmllZEFic29sdXRlKHBhdGhzKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzTXRpbWUgPSBzdGF0cy5tdGltZU1zO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAodGhpc010aW1lID4gbXRpbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgbXRpbWUgPSB0aGlzTXRpbWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSksXG4gICAgICAgICk7XG4gICAgICAgIHJldHVybiBtdGltZTtcbiAgICB9XG5cbiAgICBnZXQgZGVwZW5kZW5jaWVzKCkge1xuICAgICAgICBsZXQgcmVzdWx0ID0gQXJyYXk8c3RyaW5nPigpO1xuICAgICAgICBmb3IgKGNvbnN0IHR5cGUgb2YgW1wiZGVwZW5kZW5jaWVzXCIsIFwib3B0aW9uYWxEZXBlbmRlbmNpZXNcIiwgXCJkZXZEZXBlbmRlbmNpZXNcIiwgXCJwZWVyRGVwZW5kZW5jaWVzXCJdKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMuanNvblt0eXBlXSA9PT0gXCJvYmplY3RcIiAmJiB0aGlzLmpzb25bdHlwZV0gIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBbLi4ucmVzdWx0LCAuLi5PYmplY3Qua2V5cyh0aGlzLmpzb25bdHlwZV0pXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gWy4uLm5ldyBTZXQocmVzdWx0KV07XG4gICAgfVxuXG4gICAgZ2V0IHdvcmtzcGFjZSgpIHtcbiAgICAgICAgcmV0dXJuIFBhY2thZ2Uud29ya3NwYWNlRm9yKHRoaXMucGF0aCk7XG4gICAgfVxuXG4gICAgZ2V0IGlzV29ya3NwYWNlKCkge1xuICAgICAgICByZXR1cm4gQXJyYXkuaXNBcnJheSh0aGlzLmpzb24ud29ya3NwYWNlcyk7XG4gICAgfVxuXG4gICAgZ2V0IHJvb3QoKTogUGFja2FnZSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy53b3Jrc3BhY2U7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGlmICghKGUgaW5zdGFuY2VvZiBKc29uTm90Rm91bmRFcnJvcikpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIHN0YXRpYyBzZXQgd29ya2luZ0Rpcih3ZDogc3RyaW5nKSB7XG4gICAgICAgIHdvcmtpbmdEaXIgPSB3ZDtcbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IHdvcmtzcGFjZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMud29ya3NwYWNlRm9yKHdvcmtpbmdEaXIpO1xuICAgIH1cblxuICAgIHN0YXRpYyB3b3Jrc3BhY2VGb3IoY3dkOiBzdHJpbmcpIHtcbiAgICAgICAgaWYgKCF3b3Jrc3BhY2UpIHtcbiAgICAgICAgICAgIHdvcmtzcGFjZSA9IGZpbmQoY3dkLCBwa2cgPT4gQXJyYXkuaXNBcnJheShwa2cuanNvbi53b3Jrc3BhY2VzKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHdvcmtzcGFjZTtcbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IHRvb2xzKCkge1xuICAgICAgICBpZiAoIXRvb2xzKSB7XG4gICAgICAgICAgICB0b29scyA9IG5ldyBQYWNrYWdlKHsgcGF0aDogdG9vbHNQYXRoIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0b29scztcbiAgICB9XG5cbiAgICBzdGF0aWMgZmluZEV4cG9ydChuYW1lOiBzdHJpbmcsIHR5cGU6IFwiY2pzXCIgfCBcImVzbVwiID0gXCJlc21cIikge1xuICAgICAgICByZXR1cm4gdGhpcy53b3Jrc3BhY2UucmVzb2x2ZUltcG9ydChuYW1lLCB0eXBlKTtcbiAgICB9XG5cbiAgICByZXNvbHZlRXhwb3J0KG5hbWU6IHN0cmluZywgdHlwZTogXCJjanNcIiB8IFwiZXNtXCIgPSBcImVzbVwiKSB7XG4gICAgICAgIGlmICghbmFtZS5zdGFydHNXaXRoKFwiLlwiKSkge1xuICAgICAgICAgICAgbmFtZSA9IGAuLyR7bmFtZX1gO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGV4cG9ydERldGFpbCA9IHRoaXMuZXhwb3J0cz8uW25hbWVdO1xuXG4gICAgICAgIGlmIChleHBvcnREZXRhaWwpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4cCA9IGZpbmRFeHBvcnRDb25kaXRpb24oZXhwb3J0RGV0YWlsLCB0eXBlKTtcbiAgICAgICAgICAgIGlmIChleHApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5yZXNvbHZlKGV4cCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobmFtZSA9PT0gXCIuXCIpIHtcbiAgICAgICAgICAgIGlmICh0eXBlID09PSBcImVzbVwiICYmIHRoaXMuanNvbi5tb2R1bGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5yZXNvbHZlKHRoaXMuanNvbi5tb2R1bGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMuanNvbi5tYWluKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVzb2x2ZSh0aGlzLmpzb24ubWFpbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbm5vdCByZXNvbHZlIGV4cG9ydCAke25hbWV9IGluIHBhY2thZ2UgJHt0aGlzLm5hbWV9YCk7XG4gICAgfVxuXG4gICAgZmluZFBhY2thZ2UobmFtZTogc3RyaW5nKSB7XG4gICAgICAgIGxldCByZXNvbHZlSW4gPSB0aGlzLnBhdGg7XG4gICAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgICAgICBpZiAoaXNEaXJlY3RvcnkocmVzb2x2ZShyZXNvbHZlSW4sIFwibm9kZV9tb2R1bGVzXCIsIG5hbWUpKSkge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgbmV4dFJlc29sdmVJbiA9IGRpcm5hbWUocmVzb2x2ZUluKTtcbiAgICAgICAgICAgIGlmIChuZXh0UmVzb2x2ZUluID09PSByZXNvbHZlSW4pIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbm5vdCBmaW5kIG1vZHVsZSAke25hbWV9IGZyb20gJHt0aGlzLnBhdGh9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXNvbHZlSW4gPSBuZXh0UmVzb2x2ZUluO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIFBhY2thZ2UuZm9yUGF0aChyZXNvbHZlKHJlc29sdmVJbiwgXCJub2RlX21vZHVsZXNcIiwgbmFtZSkpO1xuICAgIH1cblxuICAgIHJlc29sdmVJbXBvcnQobmFtZTogc3RyaW5nLCB0eXBlOiBcImNqc1wiIHwgXCJlc21cIiA9IFwiZXNtXCIpIHtcbiAgICAgICAgY29uc3Qgc2VnbWVudHMgPSBuYW1lLnNwbGl0KFwiL1wiKTtcbiAgICAgICAgbGV0IHBhY2thZ2VOYW1lID0gc2VnbWVudHMuc2hpZnQoKSBhcyBzdHJpbmc7XG4gICAgICAgIGlmIChwYWNrYWdlTmFtZS5zdGFydHNXaXRoKFwiQFwiKSAmJiBzZWdtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHBhY2thZ2VOYW1lID0gYCR7cGFja2FnZU5hbWV9LyR7c2VnbWVudHMuc2hpZnQoKX1gO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcGtnID0gdGhpcy5maW5kUGFja2FnZShwYWNrYWdlTmFtZSk7XG5cbiAgICAgICAgcmV0dXJuIHBrZy5yZXNvbHZlRXhwb3J0KHNlZ21lbnRzLmxlbmd0aCA/IHNlZ21lbnRzLmpvaW4oXCIvXCIpIDogXCIuXCIsIHR5cGUpO1xuICAgIH1cblxuICAgIGhhc0ZpbGUocGF0aDogc3RyaW5nKSB7XG4gICAgICAgIHJldHVybiAhIXRoaXMuI21heWJlU3RhdChwYXRoKT8uaXNGaWxlKCk7XG4gICAgfVxuXG4gICAgaGFzRGlyZWN0b3J5KHBhdGg6IHN0cmluZykge1xuICAgICAgICByZXR1cm4gISF0aGlzLiNtYXliZVN0YXQocGF0aCk/LmlzRGlyZWN0b3J5KCk7XG4gICAgfVxuXG4gICAgYXN5bmMgcmVhZEZpbGUocGF0aDogc3RyaW5nKSB7XG4gICAgICAgIHJldHVybiByZWFkRmlsZSh0aGlzLnJlc29sdmUocGF0aCksIFwidXRmLThcIik7XG4gICAgfVxuXG4gICAgcmVhZEZpbGVTeW5jKHBhdGg6IHN0cmluZykge1xuICAgICAgICByZXR1cm4gcmVhZEZpbGVTeW5jKHRoaXMucmVzb2x2ZShwYXRoKSwgXCJ1dGYtOFwiKTtcbiAgICB9XG5cbiAgICBhc3luYyB3cml0ZUZpbGUocGF0aDogc3RyaW5nLCBjb250ZW50czogdW5rbm93bikge1xuICAgICAgICBhd2FpdCB3cml0ZUZpbGUodGhpcy5yZXNvbHZlKHBhdGgpLCBgJHtjb250ZW50c31gKTtcbiAgICB9XG5cbiAgICBhc3luYyBzYXZlKCkge1xuICAgICAgICBhd2FpdCB0aGlzLndyaXRlRmlsZShqb2luKHRoaXMucGF0aCwgXCJwYWNrYWdlLmpzb25cIiksIEpTT04uc3RyaW5naWZ5KHRoaXMuanNvbiwgdW5kZWZpbmVkLCA0KSk7XG4gICAgfVxuXG4gICAgYXN5bmMgcmVhZEpzb24ocGF0aDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHRleHQgPSBhd2FpdCB0aGlzLnJlYWRGaWxlKHBhdGgpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UodGV4dCk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGlmICghKGUgaW5zdGFuY2VvZiBFcnJvcikpIHtcbiAgICAgICAgICAgICAgICBlID0gbmV3IEVycm9yKGAke2V9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAoZSBhcyBFcnJvcikubWVzc2FnZSA9IGBFcnJvciBwYXJzaW5nIFwiJHt0aGlzLnJlc29sdmUocGF0aCl9XCI6ICR7KGUgYXMgRXJyb3IpLm1lc3NhZ2V9YDtcbiAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyB3cml0ZUpzb24ocGF0aDogc3RyaW5nLCB2YWx1ZToge30pIHtcbiAgICAgICAgYXdhaXQgdGhpcy53cml0ZUZpbGUocGF0aCwgSlNPTi5zdHJpbmdpZnkodmFsdWUsIHVuZGVmaW5lZCwgNCkpO1xuICAgIH1cblxuICAgIHN0YXRpYyBtYXliZUZvclBhdGgocGF0aDogc3RyaW5nKSB7XG4gICAgICAgIGZ1bmN0aW9uIGZpbmQocGF0aDogc3RyaW5nKTogUGFja2FnZSB8IG51bGwge1xuICAgICAgICAgICAgbGV0IHJlc3VsdCA9IHBhY2thZ2VGb3JQYXRoW3BhdGhdO1xuICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgaWYgKGV4aXN0c1N5bmMoam9pbihwYXRoLCBcInBhY2thZ2UuanNvblwiKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gbmV3IFBhY2thZ2UoeyBwYXRoIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcmVudERpciA9IGRpcm5hbWUocGF0aCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwYXJlbnREaXIgPT09IHBhdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGZpbmQocGFyZW50RGlyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcGFja2FnZUZvclBhdGhbcGF0aF0gPSByZXN1bHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcmVzdWx0ID0gZmluZChwYXRoKTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0ID8/IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBzdGF0aWMgZm9yUGF0aChwYXRoOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gdGhpcy5tYXliZUZvclBhdGgocGF0aCk7XG4gICAgICAgIGlmIChyZXN1bHQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbm5vdCBmaW5kIHBhY2thZ2UuanNvbiBmb3IgXCIke3BhdGh9XCJgKTtcbiAgICB9XG5cbiAgICBnZXQgaW1wb3J0QWxpYXNlcygpOiBJbXBvcnRBbGlhc2VzIHtcbiAgICAgICAgaWYgKHRoaXMuI2ltcG9ydEFsaWFzZXMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuI2ltcG9ydEFsaWFzZXM7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLiNpbXBvcnRBbGlhc2VzID0gbmV3IEltcG9ydEFsaWFzZXMoXG4gICAgICAgICAgICB0aGlzLmpzb24uaW1wb3J0cyxcbiAgICAgICAgICAgIFBhY2thZ2UubWF5YmVGb3JQYXRoKGRpcm5hbWUodGhpcy5wYXRoKSk/LmltcG9ydEFsaWFzZXMsXG4gICAgICAgICk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuI2ltcG9ydEFsaWFzZXM7XG4gICAgfVxuXG4gICAgZ2V0IG1vZHVsZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxpc3RNb2R1bGVzKGZhbHNlKTtcbiAgICB9XG5cbiAgICBnZXQgc291cmNlTW9kdWxlcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubGlzdE1vZHVsZXModHJ1ZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbWFwIG9mIG1vZHVsZSBuYW1lIC0+IGltcGxlbWVudGF0aW9uIGZpbGUuICBJZiBcInNvdXJjZVwiIGlzIHRydWUsIHNlYXJjaGVzIHNvdXJjZSBmaWxlcyByYXRoZXIgdGhhblxuICAgICAqIHRyYW5zcGlsZWQgZmlsZXMuICBXZSBkbyB0aGlzIHJhdGhlciB0aGFuIGZpbmRpbmcgdHJhbnNwaWxhdGlvbiBmaWxlcyB0aGVuIG1hcHBpbmcgdG8gc291cmNlIGZpbGVzIHNvIHRoaXMgd29ya3NcbiAgICAgKiBldmVuIGlmIHRoZXJlIGlzbid0IGEgYnVpbGQuXG4gICAgICovXG4gICAgbGlzdE1vZHVsZXMoc291cmNlOiBib29sZWFuLCAuLi5jb25kaXRpb25zOiBzdHJpbmdbXSkge1xuICAgICAgICBpZiAoIWNvbmRpdGlvbnMubGVuZ3RoKSB7XG4gICAgICAgICAgICBjb25kaXRpb25zID0gW3RoaXMuc3VwcG9ydHNFc20gPyBcImltcG9ydFwiIDogXCJyZXF1aXJlXCIsIFwiZGVmYXVsdFwiXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG1vZHVsZXMgPSB7fSBhcyBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuXG4gICAgICAgIGNvbnN0IGV4cG9ydHMgPSB0aGlzLmV4cG9ydHM7XG4gICAgICAgIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gXCJvYmplY3RcIiAmJiBleHBvcnRzICE9PSBudWxsKSB7XG4gICAgICAgICAgICBmaW5kTW9kdWxlcyhzb3VyY2UsIG5ldyBTZXQoY29uZGl0aW9ucyksIG1vZHVsZXMsIHRoaXMubmFtZSwgdGhpcy5wYXRoLCBleHBvcnRzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBtb2R1bGVzO1xuICAgIH1cblxuICAgICNtYXliZVN0YXQocGF0aDogc3RyaW5nKSB7XG4gICAgICAgIHJldHVybiBtYXliZVN0YXRTeW5jKHRoaXMucmVzb2x2ZShwYXRoKSk7XG4gICAgfVxufVxuXG5leHBvcnQgdHlwZSBQYWNrYWdlSnNvbiA9IHtcbiAgICBuYW1lOiBzdHJpbmc7XG4gICAgdmVyc2lvbjogc3RyaW5nO1xuICAgIGltcG9ydHM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gICAgbWF0dGVyPzoge1xuICAgICAgICB0ZXN0PzogYm9vbGVhbjtcbiAgICB9O1xuICAgIHNjcmlwdHM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICAgIFtrZXk6IHN0cmluZ106IGFueTtcbn07XG5cbmxldCB3b3JraW5nRGlyID0gXCIuXCI7XG5sZXQgd29ya3NwYWNlOiBQYWNrYWdlIHwgdW5kZWZpbmVkO1xubGV0IHRvb2xzOiBQYWNrYWdlIHwgdW5kZWZpbmVkO1xuXG5mdW5jdGlvbiBmaW5kKHN0YXJ0RGlyOiBzdHJpbmcsIHNlbGVjdG9yOiAocGtnOiBQYWNrYWdlKSA9PiBib29sZWFuKTogUGFja2FnZSB7XG4gICAgbGV0IHBrZyA9IG5ldyBQYWNrYWdlKHsgcGF0aDogc3RhcnREaXIgfSk7XG4gICAgd2hpbGUgKCFzZWxlY3Rvcihwa2cpKSB7XG4gICAgICAgIHBrZyA9IG5ldyBQYWNrYWdlKHsgcGF0aDogZGlybmFtZShwa2cucGF0aCkgfSk7XG4gICAgfVxuICAgIHJldHVybiBwa2c7XG59XG5cbmZ1bmN0aW9uIHNlbGVjdEZvcm1hdHMoanNvbjogYW55KSB7XG4gICAgbGV0IGVzbTogYm9vbGVhbiwgY2pzOiBib29sZWFuO1xuXG4gICAgaWYgKGpzb24udHlwZSA9PT0gXCJtb2R1bGVcIikge1xuICAgICAgICBlc20gPSB0cnVlO1xuICAgICAgICBjanMgPVxuICAgICAgICAgICAgKGpzb24ubWFpbiAhPT0gdW5kZWZpbmVkICYmIGpzb24ubW9kdWxlICE9PSB1bmRlZmluZWQpIHx8XG4gICAgICAgICAgICAhIU9iamVjdC52YWx1ZXMoanNvbi5leHBvcnRzID8/IHt9KS5maW5kKChleHA6IGFueSkgPT4gZXhwLnJlcXVpcmUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNqcyA9IHRydWU7XG4gICAgICAgIGVzbSA9ICEhanNvbi5tb2R1bGUgfHwgISFPYmplY3QudmFsdWVzKGpzb24uZXhwb3J0cyA/PyB7fSkuZmluZCgoZXhwOiBhbnkpID0+IGV4cC5pbXBvcnQpO1xuICAgIH1cblxuICAgIHJldHVybiB7IGVzbSwgY2pzIH07XG59XG5cbmZ1bmN0aW9uIGZpbmRFeHBvcnRDb25kaXRpb24oZGV0YWlsOiBSZWNvcmQ8c3RyaW5nLCBhbnk+LCB0eXBlOiBcImVzbVwiIHwgXCJjanNcIik6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gICAgaWYgKHR5cGUgPT09IFwiZXNtXCIgJiYgZGV0YWlsLmltcG9ydCkge1xuICAgICAgICBsZXQgZXhwID0gZGV0YWlsLmltcG9ydDtcbiAgICAgICAgaWYgKGV4cCAmJiB0eXBlb2YgZXhwICE9PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICBleHAgPSBmaW5kRXhwb3J0Q29uZGl0aW9uKGV4cCwgdHlwZSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGV4cCkge1xuICAgICAgICAgICAgcmV0dXJuIGV4cDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGxldCBleHAgPSBkZXRhaWwucmVxdWlyZSA/PyBkZXRhaWwubm9kZSA/PyBkZXRhaWwuZGVmYXVsdDtcbiAgICBpZiAoZXhwICYmIHR5cGVvZiBleHAgIT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgZXhwID0gZmluZEV4cG9ydENvbmRpdGlvbihleHAsIHR5cGUpO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgZXhwID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIHJldHVybiBleHA7XG4gICAgfVxufVxuXG50eXBlIENvbmRpdGlvbnMgPSB7IFtuYW1lOiBzdHJpbmddOiBFeHBvcnRzIH07XG5cbnR5cGUgRXhwb3J0cyA9IHN0cmluZyB8IENvbmRpdGlvbnMgfCBSZWNvcmQ8c3RyaW5nLCBDb25kaXRpb25zPjtcblxuZnVuY3Rpb24gZmluZE1vZHVsZXMoXG4gICAgc291cmNlOiBib29sZWFuLFxuICAgIGNvbmRpdGlvbnM6IFNldDxzdHJpbmc+LFxuICAgIHRhcmdldDogUmVjb3JkPHN0cmluZywgc3RyaW5nPixcbiAgICBwcmVmaXg6IHN0cmluZyxcbiAgICBwYXRoOiBzdHJpbmcsXG4gICAgZXhwb3J0czogRXhwb3J0cyxcbikge1xuICAgIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICBhZGRNb2R1bGVHbG9icyhzb3VyY2UsIHRhcmdldCwgcHJlZml4LCBwYXRoLCBleHBvcnRzKTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoZXhwb3J0cykpIHtcbiAgICAgICAgZm9yIChjb25zdCBlbnRyeSBvZiBleHBvcnRzKSB7XG4gICAgICAgICAgICBmaW5kTW9kdWxlcyhzb3VyY2UsIGNvbmRpdGlvbnMsIHRhcmdldCwgcHJlZml4LCBwYXRoLCBlbnRyeSk7XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBleHBvcnRzID09PSBcIm9iamVjdFwiICYmIGV4cG9ydHMgIT09IG51bGwpIHtcbiAgICAgICAgbGV0IHNlbGVjdGVkQ29uZGl0aW9uID0gZmFsc2U7XG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIGV4cG9ydHMpIHtcbiAgICAgICAgICAgIGlmIChrZXkuc3RhcnRzV2l0aChcIi5cIikpIHtcbiAgICAgICAgICAgICAgICBmaW5kTW9kdWxlcyhzb3VyY2UsIGNvbmRpdGlvbnMsIHRhcmdldCwgam9pbihwcmVmaXgsIGtleSksIHBhdGgsIGV4cG9ydHNba2V5XSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCFzZWxlY3RlZENvbmRpdGlvbiAmJiBjb25kaXRpb25zLmhhcyhrZXkpKSB7XG4gICAgICAgICAgICAgICAgZmluZE1vZHVsZXMoc291cmNlLCBjb25kaXRpb25zLCB0YXJnZXQsIHByZWZpeCwgcGF0aCwgZXhwb3J0c1trZXldKTtcbiAgICAgICAgICAgICAgICBzZWxlY3RlZENvbmRpdGlvbiA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJNYWxmb3JtZWQgZXhwb3J0cyBmaWVsZCBpbiBwYWNrYWdlLmpzb25cIik7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBhZGRNb2R1bGVHbG9icyhzb3VyY2U6IGJvb2xlYW4sIHRhcmdldDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiwgbmFtZTogc3RyaW5nLCBiYXNlOiBzdHJpbmcsIHBhdHRlcm46IHN0cmluZykge1xuICAgIGxldCBwYXRoID0gam9pbihiYXNlLCBwYXR0ZXJuKTtcbiAgICBpZiAoc291cmNlKSB7XG4gICAgICAgIHBhdGggPSBwYXRoLnJlcGxhY2UoL1xcL2Rpc3RcXC8oPzplc218Y2pzKVxcLy8sIFwiL3NyYy9cIik7XG4gICAgfVxuXG4gICAgaWYgKG5hbWUuaW5jbHVkZXMoXCIqXCIpKSB7XG4gICAgICAgIC8vIFdpbGRjYXJkXG4gICAgICAgIGlmICghbmFtZS5lbmRzV2l0aChcIi8qXCIpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFdpbGRjYXJkIGluIG1vZHVsZSAke25hbWV9IGRvZXMgbm90IGFwcGVhciBhcyBmaW5hbCBwYXRoIHNlZ21lbnRgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG5hbWUgPSBuYW1lLnN1YnN0cmluZygwLCBuYW1lLmxlbmd0aCAtIDIpO1xuICAgICAgICBjb25zdCBwYXRocyA9IGdsb2JTeW5jKHNvdXJjZSA/IHBhdGgucmVwbGFjZSgvXFwuanMkLywgXCIue3RzLGpzLGNqcyxtanN9XCIpIDogcGF0aCk7XG4gICAgICAgIGlmICghcGF0aHMubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vIG1hdGNoIGZvciBtb2R1bGUgJHtuYW1lfSBwYXR0ZXJuICR7cGF0dGVybn1gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IFtwcmVmaXgsIHN1ZmZpeF0gPSBwYXRoLnNwbGl0KC9cXCorLyk7XG4gICAgICAgIGNvbnN0IHByZWZpeExlbmd0aCA9IHByZWZpeCA9PT0gdW5kZWZpbmVkID8gMCA6IHByZWZpeC5sZW5ndGg7XG4gICAgICAgIGNvbnN0IHN1ZmZpeExlbmd0aCA9IHN1ZmZpeCA9PT0gdW5kZWZpbmVkID8gMCA6IHN1ZmZpeC5sZW5ndGg7XG5cbiAgICAgICAgZm9yIChjb25zdCB0aGlzUGF0aCBvZiBwYXRocykge1xuICAgICAgICAgICAgY29uc3QgcXVhbGlmaWVyID0gdGhpc1BhdGguc3Vic3RyaW5nKHByZWZpeExlbmd0aCwgdGhpc1BhdGgubGVuZ3RoIC0gc3VmZml4TGVuZ3RoKTtcbiAgICAgICAgICAgIGNvbnN0IHRoaXNOYW1lID0gam9pbihuYW1lLCBxdWFsaWZpZXIpO1xuICAgICAgICAgICAgdGFyZ2V0W3RoaXNOYW1lXSA9IHRoaXNQYXRoO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChwYXRoLmluY2x1ZGVzKFwiKlwiKSkge1xuICAgICAgICAvLyBBIHdpbGRjYXJkIHBhdGggaXMgb25seSB2YWxpZCB3aXRoIHdpbGRjYXJkIG5hbWVcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBXaWxkY2FyZCBpbiBtb2R1bGUgcGF0aCBcIiR7cGF0aH1cIiBidXQgbm90IGluIG1vZHVsZSBcIiR7bmFtZX1cImApO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE5vIHdpbGRjYXJkIC0tIHJlbW92ZSBkaXJlY3RvcnlcbiAgICAgICAgbmFtZSA9IG5hbWUucmVwbGFjZSgvXFwvKD86ZXhwb3J0fGluZGV4KSQvLCBcIlwiKTtcblxuICAgICAgICAvLyBMb29rIGZvciBzb3VyY2UgaWYgZmlsZSBpc24ndCBwcmVzZW50XG4gICAgICAgIGxldCBmb3VuZCA9IGZhbHNlO1xuICAgICAgICBpZiAoaXNGaWxlKHBhdGgpKSB7XG4gICAgICAgICAgICBmb3VuZCA9IHRydWU7XG4gICAgICAgIH0gZWxzZSBpZiAoc291cmNlICYmIHBhdGguZW5kc1dpdGgoXCIuanNcIikpIHtcbiAgICAgICAgICAgIHBhdGggPSBwYXRoLnJlcGxhY2UoL1xcLmpzJC8sIFwiLnRzXCIpO1xuICAgICAgICAgICAgaWYgKGlzRmlsZShwYXRoKSkge1xuICAgICAgICAgICAgICAgIGZvdW5kID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghZm91bmQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgTW9kdWxlIFwiJHtuYW1lfVwiIHBhdGggXCIke3BhdGh9XCIgbm90IGZvdW5kYCk7XG4gICAgICAgIH1cblxuICAgICAgICB0YXJnZXRbbmFtZV0gPSBwYXRoO1xuICAgIH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFNQSxTQUFTLFlBQVksY0FBYyxnQkFBZ0I7QUFDbkQsU0FBUyxTQUFTLFVBQVUsTUFBTSxpQkFBaUI7QUFDbkQsU0FBUyxTQUFTLE1BQU0sVUFBVSxlQUFlO0FBQ2pELFNBQVMsYUFBYSx1QkFBdUI7QUFDN0MsU0FBUyxRQUFRLG1CQUFtQixxQkFBcUI7QUFDekQsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxpQkFBaUI7QUFFbkIsTUFBTSwwQkFBMEIsTUFBTTtBQUFDO0FBRXZDLE1BQU0sY0FBYztBQUNwQixNQUFNLGVBQWU7QUFFNUIsTUFBTSxpQkFBaUIsQ0FBQztBQUV4QixTQUFTLFNBQVMsVUFBa0Is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R0FBRztBQUUzQixVQUFNLElBQUksTUFBTSw0QkFBNEIsSUFBSSx3QkFBd0IsSUFBSSxHQUFHO0FBQUEsRUFDbkYsT0FBTztBQUVILFdBQU8sS0FBSyxRQUFRLHVCQUF1QixFQUFFO0FBRzdDLFFBQUksUUFBUTtBQUNaLFFBQUksT0FBTyxJQUFJLEdBQUc7QUFDZCxjQUFRO0FBQUEsSUFDWixXQUFXLFVBQVUsS0FBSyxTQUFTLEtBQUssR0FBRztBQUN2QyxhQUFPLEtBQUssUUFBUSxTQUFTLEtBQUs7QUFDbEMsVUFBSSxPQUFPLElBQUksR0FBRztBQUNkLGdCQUFRO0FBQUEsTUFDWjtBQUFBLElBQ0o7QUFFQSxRQUFJLENBQUMsT0FBTztBQUNSLFlBQU0sSUFBSSxNQUFNLFdBQVcsSUFBSSxXQUFXLElBQUksYUFBYTtBQUFBLElBQy9EO0FBRUEsV0FBTyxJQUFJLElBQUk7QUFBQSxFQUNuQjtBQUNKOyIsCiAgIm5hbWVzIjogWyJwYXRocyIsICJmaW5kIiwgInBhdGgiLCAicmVzdWx0IiwgImV4cCJdCn0K
