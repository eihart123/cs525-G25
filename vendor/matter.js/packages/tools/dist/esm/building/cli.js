var __knownSymbol = (name, symbol) => (symbol = Symbol[name]) ? symbol : Symbol.for("Symbol." + name);
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __using = (stack, value, async) => {
  if (value != null) {
    if (typeof value !== "object" && typeof value !== "function") __typeError("Object expected");
    var dispose, inner;
    if (async) dispose = value[__knownSymbol("asyncDispose")];
    if (dispose === void 0) {
      dispose = value[__knownSymbol("dispose")];
      if (async) inner = dispose;
    }
    if (typeof dispose !== "function") __typeError("Object not disposable");
    if (inner) dispose = function() {
      try {
        inner.call(this);
      } catch (e) {
        return Promise.reject(e);
      }
    };
    stack.push([async, dispose, value]);
  } else if (async) {
    stack.push([async]);
  }
  return value;
};
var __callDispose = (stack, error, hasError) => {
  var E = typeof SuppressedError === "function" ? SuppressedError : function(e, s, m, _) {
    return _ = Error(m), _.name = "SuppressedError", _.error = e, _.suppressed = s, _;
  };
  var fail = (e) => error = hasError ? new E(e, error, "An error was suppressed during disposal") : (hasError = true, e);
  var next = (it) => {
    while (it = stack.pop()) {
      try {
        var result = it[1] && it[1].call(it[2]);
        if (it[0]) return Promise.resolve(result).then(next, (e) => (fail(e), next()));
      } catch (e) {
        fail(e);
      }
    }
    if (hasError) throw error;
  };
  return next();
};
/**
 * @license
 * Copyright 2022-2025 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */
import { commander } from "../util/commander.js";
import { Package } from "../util/package.js";
import { reportCycles } from "./cycles.js";
import { buildDocs, mergeDocs } from "./docs.js";
import { Graph } from "./graph.js";
import { ProjectBuilder, Target } from "./project-builder.js";
import { Project } from "./project.js";
import { syncAllTsconfigs } from "./tsconfig.js";
var Mode = /* @__PURE__ */ ((Mode2) => {
  Mode2[Mode2["BuildProject"] = 0] = "BuildProject";
  Mode2[Mode2["BuildProjectWithDependencies"] = 1] = "BuildProjectWithDependencies";
  Mode2[Mode2["BuildWorkspace"] = 2] = "BuildWorkspace";
  Mode2[Mode2["DisplayGraph"] = 3] = "DisplayGraph";
  Mode2[Mode2["BuildDocs"] = 4] = "BuildDocs";
  Mode2[Mode2["SyncTsconfigs"] = 5] = "SyncTsconfigs";
  Mode2[Mode2["Circular"] = 6] = "Circular";
  return Mode2;
})(Mode || {});
async function main(argv = process.argv) {
  const targets = Array();
  let mode = 0 /* BuildProject */;
  const program = commander("matter-build", "Builds packages adhering to matter.js standards.").option("-p, --prefix <path>", "specify build directory", ".").option("-c, --clean", "clean before build", false).option("-d, --dependencies", "build dependencies", false);
  program.command("build").description("(default) build JS and type definitions").action(() => {
  });
  program.command("clean").description("remove build and dist directories").action(() => {
    targets.push(Target.clean);
  });
  program.command("types").description("build type definitions").action(() => {
    targets.push(Target.types);
  });
  program.command("esm").description("build JS (ES6 modules)").action(() => {
    targets.push(Target.esm);
  });
  program.command("cjs").description("build JS (CommonJS modules)").action(() => {
    targets.push(Target.cjs);
  });
  program.command("graph").description("display the workspace graph").action(() => {
    mode = 3 /* DisplayGraph */;
  });
  program.command("tsconfigs").description("sync all tsconfigs with package.json").action(() => {
    mode = 5 /* SyncTsconfigs */;
  });
  program.command("docs").description("build workspace documentation").action(() => {
    mode = 4 /* BuildDocs */;
  });
  program.command("cycles").description("find circular dependencies").action(() => {
    mode = 6 /* Circular */;
  });
  program.action(() => {
  });
  const args = program.parse(argv).opts();
  const pkg = new Package({ path: args.prefix });
  if (mode === 0 /* BuildProject */) {
    if (pkg.isWorkspace) {
      mode = 2 /* BuildWorkspace */;
    } else if (args.dependencies) {
      mode = 1 /* BuildProjectWithDependencies */;
    }
  }
  function builder(graph) {
    return new ProjectBuilder({ ...args, targets: [...targets], graph });
  }
  switch (mode) {
    case 0 /* BuildProject */:
      const project = new Project(args.prefix);
      await builder().build(project);
      break;
    case 1 /* BuildProjectWithDependencies */:
      {
        const graph = await Graph.forProject(args.prefix);
        if (graph === void 0) {
          throw new Error(`Cannot build with dependencies because ${args.prefix} is not in a workspace`);
        }
        await graph.build(builder(graph));
      }
      break;
    case 2 /* BuildWorkspace */:
      {
        const graph = await Graph.load();
        await syncAllTsconfigs(graph);
        await graph.build(builder(graph));
      }
      break;
    case 3 /* DisplayGraph */:
      (await Graph.load()).display();
      break;
    case 5 /* SyncTsconfigs */:
      {
        const graph = await Graph.load();
        await syncAllTsconfigs(graph);
      }
      break;
    case 4 /* BuildDocs */: {
      var _stack = [];
      try {
        const progress = __using(_stack, pkg.start("Documenting"));
        if (pkg.isWorkspace) {
          const graph = await Graph.load();
          for (const node of graph.nodes) {
            if (node.pkg.isLibrary) {
              await progress.run(node.pkg.name, () => buildDocs(node.pkg, progress));
            }
          }
          await mergeDocs(Package.workspace);
        } else {
          await progress.run(pkg.name, () => buildDocs(pkg, progress));
        }
        break;
      } catch (_) {
        var _error = _, _hasError = true;
      } finally {
        __callDispose(_stack, _error, _hasError);
      }
    }
    case 6 /* Circular */: {
      var _stack2 = [];
      try {
        const progress = __using(_stack2, pkg.start("Analyzing dependencies"));
        if (pkg.isWorkspace) {
          const graph = await Graph.load();
          for (const node of graph.nodes) {
            if (node.pkg.isLibrary) {
              await reportCycles(node.pkg, progress);
            }
          }
        } else {
          await reportCycles(pkg, progress);
        }
        break;
      } catch (_2) {
        var _error2 = _2, _hasError2 = true;
      } finally {
        __callDispose(_stack2, _error2, _hasError2);
      }
    }
  }
}
export {
  main
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vc3JjL2J1aWxkaW5nL2NsaS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IDIwMjItMjAyNSBNYXR0ZXIuanMgQXV0aG9yc1xuICogU1BEWC1MaWNlbnNlLUlkZW50aWZpZXI6IEFwYWNoZS0yLjBcbiAqL1xuXG5pbXBvcnQgeyBjb21tYW5kZXIgfSBmcm9tIFwiLi4vdXRpbC9jb21tYW5kZXIuanNcIjtcbmltcG9ydCB7IFBhY2thZ2UgfSBmcm9tIFwiLi4vdXRpbC9wYWNrYWdlLmpzXCI7XG5pbXBvcnQgeyByZXBvcnRDeWNsZXMgfSBmcm9tIFwiLi9jeWNsZXMuanNcIjtcbmltcG9ydCB7IGJ1aWxkRG9jcywgbWVyZ2VEb2NzIH0gZnJvbSBcIi4vZG9jcy5qc1wiO1xuaW1wb3J0IHsgR3JhcGggfSBmcm9tIFwiLi9ncmFwaC5qc1wiO1xuaW1wb3J0IHsgUHJvamVjdEJ1aWxkZXIsIFRhcmdldCB9IGZyb20gXCIuL3Byb2plY3QtYnVpbGRlci5qc1wiO1xuaW1wb3J0IHsgUHJvamVjdCB9IGZyb20gXCIuL3Byb2plY3QuanNcIjtcbmltcG9ydCB7IHN5bmNBbGxUc2NvbmZpZ3MgfSBmcm9tIFwiLi90c2NvbmZpZy5qc1wiO1xuXG5lbnVtIE1vZGUge1xuICAgIEJ1aWxkUHJvamVjdCxcbiAgICBCdWlsZFByb2plY3RXaXRoRGVwZW5kZW5jaWVzLFxuICAgIEJ1aWxkV29ya3NwYWNlLFxuICAgIERpc3BsYXlHcmFwaCxcbiAgICBCdWlsZERvY3MsXG4gICAgU3luY1RzY29uZmlncyxcbiAgICBDaXJjdWxhcixcbn1cblxuaW50ZXJmYWNlIEFyZ3Mge1xuICAgIHByZWZpeDogc3RyaW5nO1xuICAgIGNsZWFuPzogYm9vbGVhbjtcbiAgICB3b3Jrc3BhY2VzPzogYm9vbGVhbjtcbiAgICBkZXBlbmRlbmNpZXM/OiBib29sZWFuO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbWFpbihhcmd2ID0gcHJvY2Vzcy5hcmd2KSB7XG4gICAgY29uc3QgdGFyZ2V0cyA9IEFycmF5PFRhcmdldD4oKTtcbiAgICBsZXQgbW9kZSA9IE1vZGUuQnVpbGRQcm9qZWN0O1xuXG4gICAgY29uc3QgcHJvZ3JhbSA9IGNvbW1hbmRlcihcIm1hdHRlci1idWlsZFwiLCBcIkJ1aWxkcyBwYWNrYWdlcyBhZGhlcmluZyB0byBtYXR0ZXIuanMgc3RhbmRhcmRzLlwiKVxuICAgICAgICAub3B0aW9uKFwiLXAsIC0tcHJlZml4IDxwYXRoPlwiLCBcInNwZWNpZnkgYnVpbGQgZGlyZWN0b3J5XCIsIFwiLlwiKVxuICAgICAgICAub3B0aW9uKFwiLWMsIC0tY2xlYW5cIiwgXCJjbGVhbiBiZWZvcmUgYnVpbGRcIiwgZmFsc2UpXG4gICAgICAgIC5vcHRpb24oXCItZCwgLS1kZXBlbmRlbmNpZXNcIiwgXCJidWlsZCBkZXBlbmRlbmNpZXNcIiwgZmFsc2UpO1xuXG4gICAgcHJvZ3JhbVxuICAgICAgICAuY29tbWFuZChcImJ1aWxkXCIpXG4gICAgICAgIC5kZXNjcmlwdGlvbihcIihkZWZhdWx0KSBidWlsZCBKUyBhbmQgdHlwZSBkZWZpbml0aW9uc1wiKVxuICAgICAgICAuYWN0aW9uKCgpID0+IHt9KTtcblxuICAgIHByb2dyYW1cbiAgICAgICAgLmNvbW1hbmQoXCJjbGVhblwiKVxuICAgICAgICAuZGVzY3JpcHRpb24oXCJyZW1vdmUgYnVpbGQgYW5kIGRpc3QgZGlyZWN0b3JpZXNcIilcbiAgICAgICAgLmFjdGlvbigoKSA9PiB7XG4gICAgICAgICAgICB0YXJnZXRzLnB1c2goVGFyZ2V0LmNsZWFuKTtcbiAgICAgICAgfSk7XG5cbiAgICBwcm9ncmFtXG4gICAgICAgIC5jb21tYW5kKFwidHlwZXNcIilcbiAgICAgICAgLmRlc2NyaXB0aW9uKFwiYnVpbGQgdHlwZSBkZWZpbml0aW9uc1wiKVxuICAgICAgICAuYWN0aW9uKCgpID0+IHtcbiAgICAgICAgICAgIHRhcmdldHMucHVzaChUYXJnZXQudHlwZXMpO1xuICAgICAgICB9KTtcblxuICAgIHByb2dyYW1cbiAgICAgICAgLmNvbW1hbmQoXCJlc21cIilcbiAgICAgICAgLmRlc2NyaXB0aW9uKFwiYnVpbGQgSlMgKEVTNiBtb2R1bGVzKVwiKVxuICAgICAgICAuYWN0aW9uKCgpID0+IHtcbiAgICAgICAgICAgIHRhcmdldHMucHVzaChUYXJnZXQuZXNtKTtcbiAgICAgICAgfSk7XG5cbiAgICBwcm9ncmFtXG4gICAgICAgIC5jb21tYW5kKFwiY2pzXCIpXG4gICAgICAgIC5kZXNjcmlwdGlvbihcImJ1aWxkIEpTIChDb21tb25KUyBtb2R1bGVzKVwiKVxuICAgICAgICAuYWN0aW9uKCgpID0+IHtcbiAgICAgICAgICAgIHRhcmdldHMucHVzaChUYXJnZXQuY2pzKTtcbiAgICAgICAgfSk7XG5cbiAgICBwcm9ncmFtXG4gICAgICAgIC5jb21tYW5kKFwiZ3JhcGhcIilcbiAgICAgICAgLmRlc2NyaXB0aW9uKFwiZGlzcGxheSB0aGUgd29ya3NwYWNlIGdyYXBoXCIpXG4gICAgICAgIC5hY3Rpb24oKCkgPT4ge1xuICAgICAgICAgICAgbW9kZSA9IE1vZGUuRGlzcGxheUdyYXBoO1xuICAgICAgICB9KTtcblxuICAgIHByb2dyYW1cbiAgICAgICAgLmNvbW1hbmQoXCJ0c2NvbmZpZ3NcIilcbiAgICAgICAgLmRlc2NyaXB0aW9uKFwic3luYyBhbGwgdHNjb25maWdzIHdpdGggcGFja2FnZS5qc29uXCIpXG4gICAgICAgIC5hY3Rpb24oKCkgPT4ge1xuICAgICAgICAgICAgbW9kZSA9IE1vZGUuU3luY1RzY29uZmlncztcbiAgICAgICAgfSk7XG5cbiAgICBwcm9ncmFtXG4gICAgICAgIC5jb21tYW5kKFwiZG9jc1wiKVxuICAgICAgICAuZGVzY3JpcHRpb24oXCJidWlsZCB3b3Jrc3BhY2UgZG9jdW1lbnRhdGlvblwiKVxuICAgICAgICAuYWN0aW9uKCgpID0+IHtcbiAgICAgICAgICAgIG1vZGUgPSBNb2RlLkJ1aWxkRG9jcztcbiAgICAgICAgfSk7XG5cbiAgICBwcm9ncmFtXG4gICAgICAgIC5jb21tYW5kKFwiY3ljbGVzXCIpXG4gICAgICAgIC5kZXNjcmlwdGlvbihcImZpbmQgY2lyY3VsYXIgZGVwZW5kZW5jaWVzXCIpXG4gICAgICAgIC5hY3Rpb24oKCkgPT4ge1xuICAgICAgICAgICAgbW9kZSA9IE1vZGUuQ2lyY3VsYXI7XG4gICAgICAgIH0pO1xuXG4gICAgcHJvZ3JhbS5hY3Rpb24oKCkgPT4ge30pO1xuXG4gICAgY29uc3QgYXJncyA9IHByb2dyYW0ucGFyc2UoYXJndikub3B0czxBcmdzPigpO1xuXG4gICAgY29uc3QgcGtnID0gbmV3IFBhY2thZ2UoeyBwYXRoOiBhcmdzLnByZWZpeCB9KTtcbiAgICBpZiAobW9kZSA9PT0gTW9kZS5CdWlsZFByb2plY3QpIHtcbiAgICAgICAgaWYgKHBrZy5pc1dvcmtzcGFjZSkge1xuICAgICAgICAgICAgbW9kZSA9IE1vZGUuQnVpbGRXb3Jrc3BhY2U7XG4gICAgICAgIH0gZWxzZSBpZiAoYXJncy5kZXBlbmRlbmNpZXMpIHtcbiAgICAgICAgICAgIG1vZGUgPSBNb2RlLkJ1aWxkUHJvamVjdFdpdGhEZXBlbmRlbmNpZXM7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBidWlsZGVyKGdyYXBoPzogR3JhcGgpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9qZWN0QnVpbGRlcih7IC4uLmFyZ3MsIHRhcmdldHM6IFsuLi50YXJnZXRzXSwgZ3JhcGggfSk7XG4gICAgfVxuXG4gICAgc3dpdGNoIChtb2RlIGFzIE1vZGUpIHtcbiAgICAgICAgY2FzZSBNb2RlLkJ1aWxkUHJvamVjdDpcbiAgICAgICAgICAgIGNvbnN0IHByb2plY3QgPSBuZXcgUHJvamVjdChhcmdzLnByZWZpeCk7XG4gICAgICAgICAgICBhd2FpdCBidWlsZGVyKCkuYnVpbGQocHJvamVjdCk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlIE1vZGUuQnVpbGRQcm9qZWN0V2l0aERlcGVuZGVuY2llczpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb25zdCBncmFwaCA9IGF3YWl0IEdyYXBoLmZvclByb2plY3QoYXJncy5wcmVmaXgpO1xuICAgICAgICAgICAgICAgIGlmIChncmFwaCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2Fubm90IGJ1aWxkIHdpdGggZGVwZW5kZW5jaWVzIGJlY2F1c2UgJHthcmdzLnByZWZpeH0gaXMgbm90IGluIGEgd29ya3NwYWNlYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGF3YWl0IGdyYXBoLmJ1aWxkKGJ1aWxkZXIoZ3JhcGgpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgTW9kZS5CdWlsZFdvcmtzcGFjZTpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb25zdCBncmFwaCA9IGF3YWl0IEdyYXBoLmxvYWQoKTtcbiAgICAgICAgICAgICAgICBhd2FpdCBzeW5jQWxsVHNjb25maWdzKGdyYXBoKTtcbiAgICAgICAgICAgICAgICBhd2FpdCBncmFwaC5idWlsZChidWlsZGVyKGdyYXBoKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlIE1vZGUuRGlzcGxheUdyYXBoOlxuICAgICAgICAgICAgKGF3YWl0IEdyYXBoLmxvYWQoKSkuZGlzcGxheSgpO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSBNb2RlLlN5bmNUc2NvbmZpZ3M6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29uc3QgZ3JhcGggPSBhd2FpdCBHcmFwaC5sb2FkKCk7XG4gICAgICAgICAgICAgICAgYXdhaXQgc3luY0FsbFRzY29uZmlncyhncmFwaCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlIE1vZGUuQnVpbGREb2NzOiB7XG4gICAgICAgICAgICB1c2luZyBwcm9ncmVzcyA9IHBrZy5zdGFydChcIkRvY3VtZW50aW5nXCIpO1xuICAgICAgICAgICAgaWYgKHBrZy5pc1dvcmtzcGFjZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGdyYXBoID0gYXdhaXQgR3JhcGgubG9hZCgpO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3Qgbm9kZSBvZiBncmFwaC5ub2Rlcykge1xuICAgICAgICAgICAgICAgICAgICBpZiAobm9kZS5wa2cuaXNMaWJyYXJ5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBwcm9ncmVzcy5ydW4obm9kZS5wa2cubmFtZSwgKCkgPT4gYnVpbGREb2NzKG5vZGUucGtnLCBwcm9ncmVzcykpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGF3YWl0IG1lcmdlRG9jcyhQYWNrYWdlLndvcmtzcGFjZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGF3YWl0IHByb2dyZXNzLnJ1bihwa2cubmFtZSwgKCkgPT4gYnVpbGREb2NzKHBrZywgcHJvZ3Jlc3MpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgY2FzZSBNb2RlLkNpcmN1bGFyOiB7XG4gICAgICAgICAgICB1c2luZyBwcm9ncmVzcyA9IHBrZy5zdGFydChcIkFuYWx5emluZyBkZXBlbmRlbmNpZXNcIik7XG4gICAgICAgICAgICBpZiAocGtnLmlzV29ya3NwYWNlKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZ3JhcGggPSBhd2FpdCBHcmFwaC5sb2FkKCk7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBub2RlIG9mIGdyYXBoLm5vZGVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChub2RlLnBrZy5pc0xpYnJhcnkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHJlcG9ydEN5Y2xlcyhub2RlLnBrZywgcHJvZ3Jlc3MpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBhd2FpdCByZXBvcnRDeWNsZXMocGtnLCBwcm9ncmVzcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFNQSxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGVBQWU7QUFDeEIsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxXQUFXLGlCQUFpQjtBQUNyQyxTQUFTLGFBQWE7QUFDdEIsU0FBUyxnQkFBZ0IsY0FBYztBQUN2QyxTQUFTLGVBQWU7QUFDeEIsU0FBUyx3QkFBd0I7QUFFakMsSUFBSyxPQUFMLGtCQUFLQSxVQUFMO0FBQ0ksRUFBQUEsWUFBQTtBQUNBLEVBQUFBLFlBQUE7QUFDQSxFQUFBQSxZQUFBO0FBQ0EsRUFBQUEsWUFBQTtBQUNBLEVBQUFBLFlBQUE7QUFDQSxFQUFBQSxZQUFBO0FBQ0EsRUFBQUEsWUFBQTtBQVBDLFNBQUFBO0FBQUEsR0FBQTtBQWlCTCxlQUFzQixLQUFLLE9BQU8sUUFBUSxNQUFNO0FBQzVDLFFBQU0sVUFBVSxNQUFjO0FBQzlCLE1BQUksT0FBTztBQUVYLFFBQU0sVUFBVSxVQUFVLGdCQUFnQixrREFBa0QsRUFDdkYsT0FBTyx1QkFBdUIsMkJBQTJCLEdBQUcsRUFDNUQsT0FBTyxlQUFlLHNCQUFzQixLQUFLLEVBQ2pELE9BQU8sc0JBQXNCLHNCQUFzQixLQUFLO0FBRTdELFVBQ0ssUUFBUSxPQUFPLEVBQ2YsWUFBWSx5Q0FBeUMsRUFDckQsT0FBTyxNQUFNO0FBQUEsRUFBQyxDQUFDO0FBRXBCLFVBQ0ssUUFBUSxPQUFPLEVBQ2YsWUFBWSxtQ0FBbUMsRUFDL0MsT0FBTyxNQUFNO0FBQ1YsWUFBUSxLQUFLLE9BQU8sS0FBSztBQUFBLEVBQzdCLENBQUM7QUFFTCxVQUNLLFFBQVEsT0FBTyxFQUNmLFlBQVksd0JBQXdCLEVBQ3BDLE9BQU8sTUFBTTtBQUNWLFlBQVEsS0FBSyxPQUFPLEtBQUs7QUFBQSxFQUM3QixDQUFDO0FBRUwsVUFDSyxRQUFRLEtBQUssRUFDYixZQUFZLHdCQUF3QixFQUNwQyxPQUFPLE1BQU07QUFDVixZQUFRLEtBQUssT0FBTyxHQUFHO0FBQUEsRUFDM0IsQ0FBQztBQUVMLFVBQ0ssUUFBUSxLQUFLLEVBQ2IsWUFBWSw2QkFBNkIsRUFDekMsT0FBTyxNQUFNO0FBQ1YsWUFBUSxLQUFLLE9BQU8sR0FBRztBQUFBLEVBQzNCLENBQUM7QUFFTCxVQUNLLFFBQVEsT0FBTyxFQUNmLFlBQVksNkJBQTZCLEVBQ3pDLE9BQU8sTUFBTTtBQUNWLFdBQU87QUFBQSxFQUNYLENBQUM7QUFFTCxVQUNLLFFBQVEsV0FBVyxFQUNuQixZQUFZLHNDQUFzQyxFQUNsRCxPQUFPLE1BQU07QUFDVixXQUFPO0FBQUEsRUFDWCxDQUFDO0FBRUwsVUFDSyxRQUFRLE1BQU0sRUFDZCxZQUFZLCtCQUErQixFQUMzQyxPQUFPLE1BQU07QUFDVixXQUFPO0FBQUEsRUFDWCxDQUFDO0FBRUwsVUFDSyxRQUFRLFFBQVEsRUFDaEIsWUFBWSw0QkFBNEIsRUFDeEMsT0FBTyxNQUFNO0FBQ1YsV0FBTztBQUFBLEVBQ1gsQ0FBQztBQUVMLFVBQVEsT0FBTyxNQUFNO0FBQUEsRUFBQyxDQUFDO0FBRXZCLFFBQU0sT0FBTyxRQUFRLE1BQU0sSUFBSSxFQUFFLEtBQVc7QUFFNUMsUUFBTSxNQUFNLElBQUksUUFBUSxFQUFFLE1BQU0sS0FBSyxPQUFPLENBQUM7QUFDN0MsTUFBSSxTQUFTLHNCQUFtQjtBQUM1QixRQUFJLElBQUksYUFBYTtBQUNqQixhQUFPO0FBQUEsSUFDWCxXQUFXLEtBQUssY0FBYztBQUMxQixhQUFPO0FBQUEsSUFDWDtBQUFBLEVBQ0o7QUFFQSxXQUFTLFFBQVEsT0FBZTtBQUM1QixXQUFPLElBQUksZUFBZSxFQUFFLEdBQUcsTUFBTSxTQUFTLENBQUMsR0FBRyxPQUFPLEdBQUcsTUFBTSxDQUFDO0FBQUEsRUFDdkU7QUFFQSxVQUFRLE1BQWM7QUFBQSxJQUNsQixLQUFLO0FBQ0QsWUFBTSxVQUFVLElBQUksUUFBUSxLQUFLLE1BQU07QUFDdkMsWUFBTSxRQUFRLEVBQUUsTUFBTSxPQUFPO0FBQzdCO0FBQUEsSUFFSixLQUFLO0FBQ0Q7QUFDSSxjQUFNLFFBQVEsTUFBTSxNQUFNLFdBQVcsS0FBSyxNQUFNO0FBQ2hELFlBQUksVUFBVSxRQUFXO0FBQ3JCLGdCQUFNLElBQUksTUFBTSwwQ0FBMEMsS0FBSyxNQUFNLHdCQUF3QjtBQUFBLFFBQ2pHO0FBQ0EsY0FBTSxNQUFNLE1BQU0sUUFBUSxLQUFLLENBQUM7QUFBQSxNQUNwQztBQUNBO0FBQUEsSUFFSixLQUFLO0FBQ0Q7QUFDSSxjQUFNLFFBQVEsTUFBTSxNQUFNLEtBQUs7QUFDL0IsY0FBTSxpQkFBaUIsS0FBSztBQUM1QixjQUFNLE1BQU0sTUFBTSxRQUFRLEtBQUssQ0FBQztBQUFBLE1BQ3BDO0FBQ0E7QUFBQSxJQUVKLEtBQUs7QUFDRCxPQUFDLE1BQU0sTUFBTSxLQUFLLEdBQUcsUUFBUTtBQUM3QjtBQUFBLElBRUosS0FBSztBQUNEO0FBQ0ksY0FBTSxRQUFRLE1BQU0sTUFBTSxLQUFLO0FBQy9CLGNBQU0saUJBQWlCLEtBQUs7QUFBQSxNQUNoQztBQUNBO0FBQUEsSUFFSixLQUFLLG1CQUFnQjtBQUNqQjtBQUFBO0FBQUEsY0FBTSxXQUFXLG9CQUFJLE1BQU0sYUFBYTtBQUN4QyxZQUFJLElBQUksYUFBYTtBQUNqQixnQkFBTSxRQUFRLE1BQU0sTUFBTSxLQUFLO0FBQy9CLHFCQUFXLFFBQVEsTUFBTSxPQUFPO0FBQzVCLGdCQUFJLEtBQUssSUFBSSxXQUFXO0FBQ3BCLG9CQUFNLFNBQVMsSUFBSSxLQUFLLElBQUksTUFBTSxNQUFNLFVBQVUsS0FBSyxLQUFLLFFBQVEsQ0FBQztBQUFBLFlBQ3pFO0FBQUEsVUFDSjtBQUNBLGdCQUFNLFVBQVUsUUFBUSxTQUFTO0FBQUEsUUFDckMsT0FBTztBQUNILGdCQUFNLFNBQVMsSUFBSSxJQUFJLE1BQU0sTUFBTSxVQUFVLEtBQUssUUFBUSxDQUFDO0FBQUEsUUFDL0Q7QUFDQTtBQUFBLGVBWkE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBYUo7QUFBQSxJQUVBLEtBQUssa0JBQWU7QUFDaEIsVUFBQUMsVUFBQTtBQUFBO0FBQUEsY0FBTSxXQUFXLFFBQUFBLFNBQUEsSUFBSSxNQUFNLHdCQUF3QjtBQUNuRCxZQUFJLElBQUksYUFBYTtBQUNqQixnQkFBTSxRQUFRLE1BQU0sTUFBTSxLQUFLO0FBQy9CLHFCQUFXLFFBQVEsTUFBTSxPQUFPO0FBQzVCLGdCQUFJLEtBQUssSUFBSSxXQUFXO0FBQ3BCLG9CQUFNLGFBQWEsS0FBSyxLQUFLLFFBQVE7QUFBQSxZQUN6QztBQUFBLFVBQ0o7QUFBQSxRQUNKLE9BQU87QUFDSCxnQkFBTSxhQUFhLEtBQUssUUFBUTtBQUFBLFFBQ3BDO0FBQ0E7QUFBQSxlQVhBQyxJQUFBO0FBQUEsWUFBQUMsVUFBQUQsSUFBQUUsYUFBQTtBQUFBO0FBQUEsc0JBQUFILFNBQUFFLFNBQUFDO0FBQUE7QUFBQSxJQVlKO0FBQUEsRUFDSjtBQUNKOyIsCiAgIm5hbWVzIjogWyJNb2RlIiwgIl9zdGFjayIsICJfIiwgIl9lcnJvciIsICJfaGFzRXJyb3IiXQp9Cg==
