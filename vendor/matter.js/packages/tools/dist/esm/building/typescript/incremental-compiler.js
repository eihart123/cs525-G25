/**
 * @license
 * Copyright 2022-2025 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */
import { existsSync } from "node:fs";
import { createIncrementalCompilerHost, createIncrementalProgram } from "typescript";
import { Package } from "../../util/package.js";
import { InternalBuildError } from "../error.js";
import { TypescriptContext } from "./context.js";
function createIncrementalCompilerContext(_workspace, _graph) {
  const baseOptions = {
    ...TypescriptContext.compilerOptionsFor(Package.tools.resolve("tsc/tsconfig.base.json")),
    incremental: true,
    isolatedModules: true,
    skipLibCheck: true
  };
  return { build };
  async function build(pkg, path, refreshCallback, emit) {
    let options;
    if (emit) {
      options = {
        outDir: pkg.resolve("build/types"),
        emitDeclarationOnly: true,
        sourceMap: true,
        declarationMap: true
      };
    } else {
      options = {
        noEmit: true
      };
    }
    options = {
      ...baseOptions,
      tsBuildInfoFile: pkg.resolve("build/tsbuildinfo"),
      rootDir: pkg.path,
      ...options
    };
    delete options.composite;
    if (pkg.hasSrc) {
      loadConfiguredOptions(pkg.resolve("src/tsconfig.json"), options);
    }
    if (pkg.hasTests) {
      loadConfiguredOptions(pkg.resolve("src/tsconfig.json"), options);
    }
    const host = createIncrementalCompilerHost(options);
    TypescriptContext.instrumentHostForSpinner(host, refreshCallback);
    const sources = Array();
    if (path === "src") {
      if (pkg.hasSrc) {
        sources.push(...await pkg.glob("src/**/*.ts"));
      }
    } else if (path === "test") {
      if (pkg.hasTests) {
        sources.push(...await pkg.glob("test/**/*.ts"));
      }
    } else {
      throw new InternalBuildError(`Unsupported build path "${path}"`);
    }
    const program = createIncrementalProgram({
      rootNames: sources,
      options,
      host
    });
    const diagnostics = [
      ...program.getConfigFileParsingDiagnostics(),
      ...program.getSyntacticDiagnostics(),
      ...program.getOptionsDiagnostics(),
      ...program.getSemanticDiagnostics()
    ];
    if (!options.noEmit) {
      diagnostics.push(...program.emit().diagnostics);
    }
    TypescriptContext.diagnose(diagnostics);
  }
  function loadConfiguredOptions(path, into) {
    if (!existsSync(path)) {
      return;
    }
    const options = TypescriptContext.compilerOptionsFor(path);
    delete options?.composite;
    const types = options?.types;
    if (types) {
      if (into.types) {
        const merged = new Set(into.types);
        for (const type of types) {
          merged.add(type);
        }
        into.types = [...merged];
      } else {
        into.types = types;
      }
    }
  }
}
export {
  createIncrementalCompilerContext
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vc3JjL2J1aWxkaW5nL3R5cGVzY3JpcHQvaW5jcmVtZW50YWwtY29tcGlsZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCAyMDIyLTIwMjUgTWF0dGVyLmpzIEF1dGhvcnNcbiAqIFNQRFgtTGljZW5zZS1JZGVudGlmaWVyOiBBcGFjaGUtMi4wXG4gKi9cblxuaW1wb3J0IHsgZXhpc3RzU3luYyB9IGZyb20gXCJub2RlOmZzXCI7XG5pbXBvcnQgeyBDb21waWxlck9wdGlvbnMsIGNyZWF0ZUluY3JlbWVudGFsQ29tcGlsZXJIb3N0LCBjcmVhdGVJbmNyZW1lbnRhbFByb2dyYW0gfSBmcm9tIFwidHlwZXNjcmlwdFwiO1xuaW1wb3J0IHsgUGFja2FnZSB9IGZyb20gXCIuLi8uLi91dGlsL3BhY2thZ2UuanNcIjtcbmltcG9ydCB7IEludGVybmFsQnVpbGRFcnJvciB9IGZyb20gXCIuLi9lcnJvci5qc1wiO1xuaW1wb3J0IHsgR3JhcGggfSBmcm9tIFwiLi4vZ3JhcGguanNcIjtcbmltcG9ydCB7IFR5cGVzY3JpcHRDb250ZXh0IH0gZnJvbSBcIi4vY29udGV4dC5qc1wiO1xuXG4vLyBUT0RPIC0gaWYgd2UgZXZlciBtb3ZlIGJhY2sgdG8gdGhpcyB3ZSBuZWVkIHRvIGNvcHkgdHlwZSBmaWxlcyB3aGljaCB3YXMgcHJldmlvdXNseSBoYW5kbGVkIHNlcGFyYXRlbHlcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVJbmNyZW1lbnRhbENvbXBpbGVyQ29udGV4dChfd29ya3NwYWNlOiBQYWNrYWdlLCBfZ3JhcGg6IEdyYXBoIHwgdW5kZWZpbmVkKTogVHlwZXNjcmlwdENvbnRleHQge1xuICAgIGNvbnN0IGJhc2VPcHRpb25zID0ge1xuICAgICAgICAuLi5UeXBlc2NyaXB0Q29udGV4dC5jb21waWxlck9wdGlvbnNGb3IoUGFja2FnZS50b29scy5yZXNvbHZlKFwidHNjL3RzY29uZmlnLmJhc2UuanNvblwiKSksXG5cbiAgICAgICAgaW5jcmVtZW50YWw6IHRydWUsXG4gICAgICAgIGlzb2xhdGVkTW9kdWxlczogdHJ1ZSxcbiAgICAgICAgc2tpcExpYkNoZWNrOiB0cnVlLFxuICAgIH07XG5cbiAgICByZXR1cm4geyBidWlsZCB9O1xuXG4gICAgYXN5bmMgZnVuY3Rpb24gYnVpbGQocGtnOiBQYWNrYWdlLCBwYXRoOiBzdHJpbmcsIHJlZnJlc2hDYWxsYmFjazogKCkgPT4gdm9pZCwgZW1pdD86IGJvb2xlYW4pIHtcbiAgICAgICAgbGV0IG9wdGlvbnM7XG4gICAgICAgIGlmIChlbWl0KSB7XG4gICAgICAgICAgICBvcHRpb25zID0ge1xuICAgICAgICAgICAgICAgIG91dERpcjogcGtnLnJlc29sdmUoXCJidWlsZC90eXBlc1wiKSxcbiAgICAgICAgICAgICAgICBlbWl0RGVjbGFyYXRpb25Pbmx5OiB0cnVlLFxuICAgICAgICAgICAgICAgIHNvdXJjZU1hcDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBkZWNsYXJhdGlvbk1hcDogdHJ1ZSxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvcHRpb25zID0ge1xuICAgICAgICAgICAgICAgIG5vRW1pdDogdHJ1ZSxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBvcHRpb25zID0ge1xuICAgICAgICAgICAgLi4uYmFzZU9wdGlvbnMsXG4gICAgICAgICAgICB0c0J1aWxkSW5mb0ZpbGU6IHBrZy5yZXNvbHZlKFwiYnVpbGQvdHNidWlsZGluZm9cIiksXG4gICAgICAgICAgICByb290RGlyOiBwa2cucGF0aCxcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIH07XG5cbiAgICAgICAgZGVsZXRlIG9wdGlvbnMuY29tcG9zaXRlO1xuXG4gICAgICAgIGlmIChwa2cuaGFzU3JjKSB7XG4gICAgICAgICAgICBsb2FkQ29uZmlndXJlZE9wdGlvbnMocGtnLnJlc29sdmUoXCJzcmMvdHNjb25maWcuanNvblwiKSwgb3B0aW9ucyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocGtnLmhhc1Rlc3RzKSB7XG4gICAgICAgICAgICBsb2FkQ29uZmlndXJlZE9wdGlvbnMocGtnLnJlc29sdmUoXCJzcmMvdHNjb25maWcuanNvblwiKSwgb3B0aW9ucyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBob3N0ID0gY3JlYXRlSW5jcmVtZW50YWxDb21waWxlckhvc3Qob3B0aW9ucyk7XG5cbiAgICAgICAgVHlwZXNjcmlwdENvbnRleHQuaW5zdHJ1bWVudEhvc3RGb3JTcGlubmVyKGhvc3QsIHJlZnJlc2hDYWxsYmFjayk7XG4gICAgICAgIGNvbnN0IHNvdXJjZXMgPSBBcnJheTxzdHJpbmc+KCk7XG5cbiAgICAgICAgaWYgKHBhdGggPT09IFwic3JjXCIpIHtcbiAgICAgICAgICAgIGlmIChwa2cuaGFzU3JjKSB7XG4gICAgICAgICAgICAgICAgc291cmNlcy5wdXNoKC4uLihhd2FpdCBwa2cuZ2xvYihcInNyYy8qKi8qLnRzXCIpKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAocGF0aCA9PT0gXCJ0ZXN0XCIpIHtcbiAgICAgICAgICAgIGlmIChwa2cuaGFzVGVzdHMpIHtcbiAgICAgICAgICAgICAgICBzb3VyY2VzLnB1c2goLi4uKGF3YWl0IHBrZy5nbG9iKFwidGVzdC8qKi8qLnRzXCIpKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgSW50ZXJuYWxCdWlsZEVycm9yKGBVbnN1cHBvcnRlZCBidWlsZCBwYXRoIFwiJHtwYXRofVwiYCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwcm9ncmFtID0gY3JlYXRlSW5jcmVtZW50YWxQcm9ncmFtKHtcbiAgICAgICAgICAgIHJvb3ROYW1lczogc291cmNlcyxcbiAgICAgICAgICAgIG9wdGlvbnMsXG4gICAgICAgICAgICBob3N0LFxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC9UeXBlU2NyaXB0L2lzc3Vlcy8zMTg0OVxuICAgICAgICBjb25zdCBkaWFnbm9zdGljcyA9IFtcbiAgICAgICAgICAgIC4uLnByb2dyYW0uZ2V0Q29uZmlnRmlsZVBhcnNpbmdEaWFnbm9zdGljcygpLFxuICAgICAgICAgICAgLi4ucHJvZ3JhbS5nZXRTeW50YWN0aWNEaWFnbm9zdGljcygpLFxuICAgICAgICAgICAgLi4ucHJvZ3JhbS5nZXRPcHRpb25zRGlhZ25vc3RpY3MoKSxcbiAgICAgICAgICAgIC4uLnByb2dyYW0uZ2V0U2VtYW50aWNEaWFnbm9zdGljcygpLFxuICAgICAgICBdO1xuXG4gICAgICAgIGlmICghb3B0aW9ucy5ub0VtaXQpIHtcbiAgICAgICAgICAgIGRpYWdub3N0aWNzLnB1c2goLi4ucHJvZ3JhbS5lbWl0KCkuZGlhZ25vc3RpY3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgVHlwZXNjcmlwdENvbnRleHQuZGlhZ25vc2UoZGlhZ25vc3RpY3MpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFzIHdlIGxhcmdlbHkgY29uZmlndXJlIGJhc2VkIG9uIGNvbnZlbnRpb24sIHdlIG1vc3RseSBpZ25vcmUgdHNjb25maWcuanNvbiBmaWxlcyBpbiBwcm9qZWN0IGRpcmVjdG9yaWVzLiAgVGhlXG4gICAgICogbGltaXRlZCBudW1iZXIgb2YgcHJvamVjdC1zcGVjaWZpYyBvcHRpb25zIHdlIGFsbG93IGxvYWQgaGVyZS5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBsb2FkQ29uZmlndXJlZE9wdGlvbnMocGF0aDogc3RyaW5nLCBpbnRvOiBDb21waWxlck9wdGlvbnMpIHtcbiAgICAgICAgaWYgKCFleGlzdHNTeW5jKHBhdGgpKSB7XG4gICAgICAgICAgICAvLyBQYWNrYWdlIHRzY29uZmlncyBhcmUgb3B0aW9uYWxcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSBUeXBlc2NyaXB0Q29udGV4dC5jb21waWxlck9wdGlvbnNGb3IocGF0aCk7XG5cbiAgICAgICAgZGVsZXRlIG9wdGlvbnM/LmNvbXBvc2l0ZTtcblxuICAgICAgICBjb25zdCB0eXBlcyA9IG9wdGlvbnM/LnR5cGVzO1xuICAgICAgICBpZiAodHlwZXMpIHtcbiAgICAgICAgICAgIGlmIChpbnRvLnR5cGVzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVyZ2VkID0gbmV3IFNldChpbnRvLnR5cGVzKTtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHR5cGUgb2YgdHlwZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgbWVyZ2VkLmFkZCh0eXBlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaW50by50eXBlcyA9IFsuLi5tZXJnZWRdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpbnRvLnR5cGVzID0gdHlwZXM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBTUEsU0FBUyxrQkFBa0I7QUFDM0IsU0FBMEIsK0JBQStCLGdDQUFnQztBQUN6RixTQUFTLGVBQWU7QUFDeEIsU0FBUywwQkFBMEI7QUFFbkMsU0FBUyx5QkFBeUI7QUFHM0IsU0FBUyxpQ0FBaUMsWUFBcUIsUUFBOEM7QUFDaEgsUUFBTSxjQUFjO0FBQUEsSUFDaEIsR0FBRyxrQkFBa0IsbUJBQW1CLFFBQVEsTUFBTSxRQUFRLHdCQUF3QixDQUFDO0FBQUEsSUFFdkYsYUFBYTtBQUFBLElBQ2IsaUJBQWlCO0FBQUEsSUFDakIsY0FBYztBQUFBLEVBQ2xCO0FBRUEsU0FBTyxFQUFFLE1BQU07QUFFZixpQkFBZSxNQUFNLEtBQWMsTUFBYyxpQkFBNkIsTUFBZ0I7QUFDMUYsUUFBSTtBQUNKLFFBQUksTUFBTTtBQUNOLGdCQUFVO0FBQUEsUUFDTixRQUFRLElBQUksUUFBUSxhQUFhO0FBQUEsUUFDakMscUJBQXFCO0FBQUEsUUFDckIsV0FBVztBQUFBLFFBQ1gsZ0JBQWdCO0FBQUEsTUFDcEI7QUFBQSxJQUNKLE9BQU87QUFDSCxnQkFBVTtBQUFBLFFBQ04sUUFBUTtBQUFBLE1BQ1o7QUFBQSxJQUNKO0FBRUEsY0FBVTtBQUFBLE1BQ04sR0FBRztBQUFBLE1BQ0gsaUJBQWlCLElBQUksUUFBUSxtQkFBbUI7QUFBQSxNQUNoRCxTQUFTLElBQUk7QUFBQSxNQUNiLEdBQUc7QUFBQSxJQUNQO0FBRUEsV0FBTyxRQUFRO0FBRWYsUUFBSSxJQUFJLFFBQVE7QUFDWiw0QkFBc0IsSUFBSSxRQUFRLG1CQUFtQixHQUFHLE9BQU87QUFBQSxJQUNuRTtBQUVBLFFBQUksSUFBSSxVQUFVO0FBQ2QsNEJBQXNCLElBQUksUUFBUSxtQkFBbUIsR0FBRyxPQUFPO0FBQUEsSUFDbkU7QUFFQSxVQUFNLE9BQU8sOEJBQThCLE9BQU87QUFFbEQsc0JBQWtCLHlCQUF5QixNQUFNLGVBQWU7QUFDaEUsVUFBTSxVQUFVLE1BQWM7QUFFOUIsUUFBSSxTQUFTLE9BQU87QUFDaEIsVUFBSSxJQUFJLFFBQVE7QUFDWixnQkFBUSxLQUFLLEdBQUksTUFBTSxJQUFJLEtBQUssYUFBYSxDQUFFO0FBQUEsTUFDbkQ7QUFBQSxJQUNKLFdBQVcsU0FBUyxRQUFRO0FBQ3hCLFVBQUksSUFBSSxVQUFVO0FBQ2QsZ0JBQVEsS0FBSyxHQUFJLE1BQU0sSUFBSSxLQUFLLGNBQWMsQ0FBRTtBQUFBLE1BQ3BEO0FBQUEsSUFDSixPQUFPO0FBQ0gsWUFBTSxJQUFJLG1CQUFtQiwyQkFBMkIsSUFBSSxHQUFHO0FBQUEsSUFDbkU7QUFFQSxVQUFNLFVBQVUseUJBQXlCO0FBQUEsTUFDckMsV0FBVztBQUFBLE1BQ1g7QUFBQSxNQUNBO0FBQUEsSUFDSixDQUFDO0FBR0QsVUFBTSxjQUFjO0FBQUEsTUFDaEIsR0FBRyxRQUFRLGdDQUFnQztBQUFBLE1BQzNDLEdBQUcsUUFBUSx3QkFBd0I7QUFBQSxNQUNuQyxHQUFHLFFBQVEsc0JBQXNCO0FBQUEsTUFDakMsR0FBRyxRQUFRLHVCQUF1QjtBQUFBLElBQ3RDO0FBRUEsUUFBSSxDQUFDLFFBQVEsUUFBUTtBQUNqQixrQkFBWSxLQUFLLEdBQUcsUUFBUSxLQUFLLEVBQUUsV0FBVztBQUFBLElBQ2xEO0FBRUEsc0JBQWtCLFNBQVMsV0FBVztBQUFBLEVBQzFDO0FBTUEsV0FBUyxzQkFBc0IsTUFBYyxNQUF1QjtBQUNoRSxRQUFJLENBQUMsV0FBVyxJQUFJLEdBQUc7QUFFbkI7QUFBQSxJQUNKO0FBRUEsVUFBTSxVQUFVLGtCQUFrQixtQkFBbUIsSUFBSTtBQUV6RCxXQUFPLFNBQVM7QUFFaEIsVUFBTSxRQUFRLFNBQVM7QUFDdkIsUUFBSSxPQUFPO0FBQ1AsVUFBSSxLQUFLLE9BQU87QUFDWixjQUFNLFNBQVMsSUFBSSxJQUFJLEtBQUssS0FBSztBQUNqQyxtQkFBVyxRQUFRLE9BQU87QUFDdEIsaUJBQU8sSUFBSSxJQUFJO0FBQUEsUUFDbkI7QUFDQSxhQUFLLFFBQVEsQ0FBQyxHQUFHLE1BQU07QUFBQSxNQUMzQixPQUFPO0FBQ0gsYUFBSyxRQUFRO0FBQUEsTUFDakI7QUFBQSxJQUNKO0FBQUEsRUFDSjtBQUNKOyIsCiAgIm5hbWVzIjogW10KfQo=
