/**
 * @license
 * Copyright 2022-2025 Project CHIP Authors
 * SPDX-License-Identifier: Apache-2.0
 */
import { readFile } from "node:fs/promises";
import detective from "detective-typescript";
import { dirname, relative, resolve } from "node:path";
import { std } from "../ansi-text/std.js";
import { ansi } from "../ansi-text/text-builder.js";
async function reportCycles(pkg, progress) {
  const cycles = await progress.run(pkg.name, () => identifyCycles(pkg, progress));
  if (cycles) {
    printCycles(pkg, cycles);
  }
}
async function identifyCycles(pkg, progress) {
  const deps = {};
  for (const filename of await pkg.glob("{src,test}/**/*.ts")) {
    const contents = await readFile(filename, "utf-8");
    const fileDeps = detective(contents, {
      skipTypeImports: true,
      skipAsyncImports: true
    });
    deps[filename] = resolveDeps(pkg, filename, fileDeps);
  }
  const cycles = [];
  for (const filename in deps) {
    visit(filename, []);
  }
  function visit(filename, breadcrumb) {
    progress.refresh();
    const fileDeps = deps[filename] ?? deps[filename.replace(/\.js$/, ".ts")];
    if (fileDeps === void 0) {
      return;
    }
    const previousIndex = breadcrumb.indexOf(filename);
    if (previousIndex !== -1) {
      const newCycle = breadcrumb.slice(previousIndex);
      for (const cycle of cycles) {
        const filenameOffset = cycle.indexOf(filename);
        if (cycle.length !== newCycle.length) {
          continue;
        }
        if (filenameOffset === -1) {
          continue;
        }
        let i = 0;
        for (i = 0; i < newCycle.length; i++) {
          if (newCycle[i] !== cycle[(filenameOffset + i) % newCycle.length]) {
            break;
          }
        }
        if (i === newCycle.length) {
          return;
        }
      }
      cycles.push(newCycle);
      return;
    }
    breadcrumb = [...breadcrumb, filename];
    for (const dep of fileDeps) {
      visit(dep, breadcrumb);
    }
  }
  return cycles.length ? cycles : void 0;
}
function printCycles(pkg, cycles) {
  std.out(ansi.red("Cycles detected:"), "\n");
  const src = pkg.resolve("src");
  for (const cycle of cycles) {
    std.out("  ", cycle.map((name) => ansi.bright.blue(relative(src, name))).join(" \u2192 "), " \u21A9\n");
  }
}
function resolveDeps(pkg, sourceFilename, deps) {
  const dir = dirname(sourceFilename);
  const aliases = pkg.importAliases;
  const resolved = Array();
  for (let dep of deps) {
    let base = dir;
    if (dep.startsWith("#")) {
      dep = aliases.rewrite(dep);
      base = pkg.path;
    }
    if (dep.startsWith("./")) {
      resolved.push(resolve(base, dep));
    }
  }
  return resolved;
}
export {
  reportCycles
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vc3JjL2J1aWxkaW5nL2N5Y2xlcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IDIwMjItMjAyNSBQcm9qZWN0IENISVAgQXV0aG9yc1xuICogU1BEWC1MaWNlbnNlLUlkZW50aWZpZXI6IEFwYWNoZS0yLjBcbiAqL1xuXG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gXCJub2RlOmZzL3Byb21pc2VzXCI7XG5pbXBvcnQgeyBQYWNrYWdlIH0gZnJvbSBcIi4uL3V0aWwvcGFja2FnZS5qc1wiO1xuaW1wb3J0IHsgUHJvZ3Jlc3MgfSBmcm9tIFwiLi4vdXRpbC9wcm9ncmVzcy5qc1wiO1xuXG4vLyBAdHMtZXhwZWN0LWVycm9yIHdlIGRvbid0IGhhdmUgdHlwZXMgZm9yIGRldGVjdGl2ZS10eXBlc2NyaXB0XG5pbXBvcnQgZGV0ZWN0aXZlIGZyb20gXCJkZXRlY3RpdmUtdHlwZXNjcmlwdFwiO1xuaW1wb3J0IHsgZGlybmFtZSwgcmVsYXRpdmUsIHJlc29sdmUgfSBmcm9tIFwibm9kZTpwYXRoXCI7XG5pbXBvcnQgeyBzdGQgfSBmcm9tIFwiLi4vYW5zaS10ZXh0L3N0ZC5qc1wiO1xuaW1wb3J0IHsgYW5zaSB9IGZyb20gXCIuLi9hbnNpLXRleHQvdGV4dC1idWlsZGVyLmpzXCI7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZXBvcnRDeWNsZXMocGtnOiBQYWNrYWdlLCBwcm9ncmVzczogUHJvZ3Jlc3MpIHtcbiAgICBjb25zdCBjeWNsZXMgPSBhd2FpdCBwcm9ncmVzcy5ydW4ocGtnLm5hbWUsICgpID0+IGlkZW50aWZ5Q3ljbGVzKHBrZywgcHJvZ3Jlc3MpKTtcbiAgICBpZiAoY3ljbGVzKSB7XG4gICAgICAgIHByaW50Q3ljbGVzKHBrZywgY3ljbGVzKTtcbiAgICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGlkZW50aWZ5Q3ljbGVzKHBrZzogUGFja2FnZSwgcHJvZ3Jlc3M6IFByb2dyZXNzKSB7XG4gICAgY29uc3QgZGVwcyA9IHt9IGFzIFJlY29yZDxzdHJpbmcsIHN0cmluZ1tdPjtcbiAgICBmb3IgKGNvbnN0IGZpbGVuYW1lIG9mIGF3YWl0IHBrZy5nbG9iKFwie3NyYyx0ZXN0fS8qKi8qLnRzXCIpKSB7XG4gICAgICAgIGNvbnN0IGNvbnRlbnRzID0gYXdhaXQgcmVhZEZpbGUoZmlsZW5hbWUsIFwidXRmLThcIik7XG4gICAgICAgIGNvbnN0IGZpbGVEZXBzID0gZGV0ZWN0aXZlKGNvbnRlbnRzLCB7XG4gICAgICAgICAgICBza2lwVHlwZUltcG9ydHM6IHRydWUsXG4gICAgICAgICAgICBza2lwQXN5bmNJbXBvcnRzOiB0cnVlLFxuICAgICAgICB9KTtcbiAgICAgICAgZGVwc1tmaWxlbmFtZV0gPSByZXNvbHZlRGVwcyhwa2csIGZpbGVuYW1lLCBmaWxlRGVwcyk7XG4gICAgfVxuXG4gICAgY29uc3QgY3ljbGVzID0gW10gYXMgc3RyaW5nW11bXTtcbiAgICBmb3IgKGNvbnN0IGZpbGVuYW1lIGluIGRlcHMpIHtcbiAgICAgICAgdmlzaXQoZmlsZW5hbWUsIFtdKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB2aXNpdChmaWxlbmFtZTogc3RyaW5nLCBicmVhZGNydW1iOiBzdHJpbmdbXSkge1xuICAgICAgICBwcm9ncmVzcy5yZWZyZXNoKCk7XG4gICAgICAgIGNvbnN0IGZpbGVEZXBzID0gZGVwc1tmaWxlbmFtZV0gPz8gZGVwc1tmaWxlbmFtZS5yZXBsYWNlKC9cXC5qcyQvLCBcIi50c1wiKV07XG4gICAgICAgIGlmIChmaWxlRGVwcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwcmV2aW91c0luZGV4ID0gYnJlYWRjcnVtYi5pbmRleE9mKGZpbGVuYW1lKTtcbiAgICAgICAgaWYgKHByZXZpb3VzSW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgICBjb25zdCBuZXdDeWNsZSA9IGJyZWFkY3J1bWIuc2xpY2UocHJldmlvdXNJbmRleCk7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGN5Y2xlIG9mIGN5Y2xlcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVuYW1lT2Zmc2V0ID0gY3ljbGUuaW5kZXhPZihmaWxlbmFtZSk7XG4gICAgICAgICAgICAgICAgaWYgKGN5Y2xlLmxlbmd0aCAhPT0gbmV3Q3ljbGUubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoZmlsZW5hbWVPZmZzZXQgPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGxldCBpID0gMDtcbiAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbmV3Q3ljbGUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5ld0N5Y2xlW2ldICE9PSBjeWNsZVsoZmlsZW5hbWVPZmZzZXQgKyBpKSAlIG5ld0N5Y2xlLmxlbmd0aF0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGkgPT09IG5ld0N5Y2xlLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY3ljbGVzLnB1c2gobmV3Q3ljbGUpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgYnJlYWRjcnVtYiA9IFsuLi5icmVhZGNydW1iLCBmaWxlbmFtZV07XG4gICAgICAgIGZvciAoY29uc3QgZGVwIG9mIGZpbGVEZXBzKSB7XG4gICAgICAgICAgICB2aXNpdChkZXAsIGJyZWFkY3J1bWIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGN5Y2xlcy5sZW5ndGggPyBjeWNsZXMgOiB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIHByaW50Q3ljbGVzKHBrZzogUGFja2FnZSwgY3ljbGVzOiBzdHJpbmdbXVtdKSB7XG4gICAgc3RkLm91dChhbnNpLnJlZChcIkN5Y2xlcyBkZXRlY3RlZDpcIiksIFwiXFxuXCIpO1xuICAgIGNvbnN0IHNyYyA9IHBrZy5yZXNvbHZlKFwic3JjXCIpO1xuICAgIGZvciAoY29uc3QgY3ljbGUgb2YgY3ljbGVzKSB7XG4gICAgICAgIHN0ZC5vdXQoXCIgIFwiLCBjeWNsZS5tYXAobmFtZSA9PiBhbnNpLmJyaWdodC5ibHVlKHJlbGF0aXZlKHNyYywgbmFtZSkpKS5qb2luKFwiIFx1MjE5MiBcIiksIFwiIFx1MjFBOVxcblwiKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVEZXBzKHBrZzogUGFja2FnZSwgc291cmNlRmlsZW5hbWU6IHN0cmluZywgZGVwczogc3RyaW5nW10pIHtcbiAgICBjb25zdCBkaXIgPSBkaXJuYW1lKHNvdXJjZUZpbGVuYW1lKTtcbiAgICBjb25zdCBhbGlhc2VzID0gcGtnLmltcG9ydEFsaWFzZXM7XG4gICAgY29uc3QgcmVzb2x2ZWQgPSBBcnJheTxzdHJpbmc+KCk7XG5cbiAgICBmb3IgKGxldCBkZXAgb2YgZGVwcykge1xuICAgICAgICBsZXQgYmFzZSA9IGRpcjtcbiAgICAgICAgaWYgKGRlcC5zdGFydHNXaXRoKFwiI1wiKSkge1xuICAgICAgICAgICAgZGVwID0gYWxpYXNlcy5yZXdyaXRlKGRlcCk7XG4gICAgICAgICAgICBiYXNlID0gcGtnLnBhdGg7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRlcC5zdGFydHNXaXRoKFwiLi9cIikpIHtcbiAgICAgICAgICAgIHJlc29sdmVkLnB1c2gocmVzb2x2ZShiYXNlLCBkZXApKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByZXNvbHZlZDtcbn1c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
