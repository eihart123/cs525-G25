/**
 * @license
 * Copyright 2022-2025 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { ignoreErrorSync } from "./errors.js";
function isNotFoundError(e) {
  return typeof e === "object" && e !== null && "code" in e && (e.code === "ENOENT" || e.code === "ENOTDIR");
}
function maybeStatSync(path) {
  try {
    return statSync(path);
  } catch (e) {
    if (isNotFoundError(e)) {
      return;
    }
    throw e;
  }
}
function maybeReadJsonSync(path) {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (e) {
    if (isNotFoundError(e)) {
      return;
    }
    if (e instanceof SyntaxError) {
      e.message = `Error parsing ${path}: ${e.message}`;
      throw e;
    }
    throw e;
  }
}
function maybeReaddirSync(path) {
  try {
    return readdirSync(path);
  } catch (e) {
    if (isNotFoundError(e)) {
      return;
    }
  }
}
function isDirectory(path) {
  return !!ignoreErrorSync("ENOENT", () => statSync(path).isDirectory());
}
function isFile(path) {
  return !!ignoreErrorSync("ENOENT", () => statSync(path).isFile());
}
function FilesystemSync() {
  return {
    resolve(...segments) {
      return resolve(...segments);
    },
    readdir(path) {
      return maybeReaddirSync(path);
    },
    stat(path) {
      const stats = maybeStatSync(path);
      if (stats) {
        return {
          get isFile() {
            return stats.isFile();
          },
          get isDirectory() {
            return stats.isDirectory();
          }
        };
      }
    }
  };
}
export {
  FilesystemSync,
  isDirectory,
  isFile,
  maybeReadJsonSync,
  maybeReaddirSync,
  maybeStatSync
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vc3JjL3V0aWwvZmlsZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IDIwMjItMjAyNSBNYXR0ZXIuanMgQXV0aG9yc1xuICogU1BEWC1MaWNlbnNlLUlkZW50aWZpZXI6IEFwYWNoZS0yLjBcbiAqL1xuXG5pbXBvcnQgeyByZWFkZGlyU3luYywgcmVhZEZpbGVTeW5jLCBzdGF0U3luYyB9IGZyb20gXCJub2RlOmZzXCI7XG5pbXBvcnQgeyByZXNvbHZlIH0gZnJvbSBcIm5vZGU6cGF0aFwiO1xuaW1wb3J0IHsgaWdub3JlRXJyb3JTeW5jIH0gZnJvbSBcIi4vZXJyb3JzLmpzXCI7XG5cbmZ1bmN0aW9uIGlzTm90Rm91bmRFcnJvcihlOiB1bmtub3duKSB7XG4gICAgcmV0dXJuIHR5cGVvZiBlID09PSBcIm9iamVjdFwiICYmIGUgIT09IG51bGwgJiYgXCJjb2RlXCIgaW4gZSAmJiAoZS5jb2RlID09PSBcIkVOT0VOVFwiIHx8IGUuY29kZSA9PT0gXCJFTk9URElSXCIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWF5YmVTdGF0U3luYyhwYXRoOiBzdHJpbmcpIHtcbiAgICB0cnkge1xuICAgICAgICByZXR1cm4gc3RhdFN5bmMocGF0aCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBpZiAoaXNOb3RGb3VuZEVycm9yKGUpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgZTtcbiAgICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtYXliZVJlYWRKc29uU3luYyhwYXRoOiBzdHJpbmcpIHtcbiAgICB0cnkge1xuICAgICAgICByZXR1cm4gSlNPTi5wYXJzZShyZWFkRmlsZVN5bmMocGF0aCwgXCJ1dGYtOFwiKSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBpZiAoaXNOb3RGb3VuZEVycm9yKGUpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGUgaW5zdGFuY2VvZiBTeW50YXhFcnJvcikge1xuICAgICAgICAgICAgZS5tZXNzYWdlID0gYEVycm9yIHBhcnNpbmcgJHtwYXRofTogJHtlLm1lc3NhZ2V9YDtcbiAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgZTtcbiAgICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtYXliZVJlYWRkaXJTeW5jKHBhdGg6IHN0cmluZykge1xuICAgIHRyeSB7XG4gICAgICAgIHJldHVybiByZWFkZGlyU3luYyhwYXRoKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGlmIChpc05vdEZvdW5kRXJyb3IoZSkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzRGlyZWN0b3J5KHBhdGg6IHN0cmluZykge1xuICAgIHJldHVybiAhIWlnbm9yZUVycm9yU3luYyhcIkVOT0VOVFwiLCAoKSA9PiBzdGF0U3luYyhwYXRoKS5pc0RpcmVjdG9yeSgpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzRmlsZShwYXRoOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gISFpZ25vcmVFcnJvclN5bmMoXCJFTk9FTlRcIiwgKCkgPT4gc3RhdFN5bmMocGF0aCkuaXNGaWxlKCkpO1xufVxuXG4vKipcbiAqIFRpbnkgdmlydHVhbCBmaWxlc3lzdGVtIGRyaXZlci4gIEN1cnJlbnRseSB1c2VkIG9ubHkgZm9yIHByb2Nlc3NpbmcgZ2xvYnMuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRmlsZXN5c3RlbVN5bmM8VCBleHRlbmRzIEZpbGVzeXN0ZW1TeW5jLlN0YXQgPSBGaWxlc3lzdGVtU3luYy5TdGF0PiB7XG4gICAgcmVzb2x2ZSguLi5zZWdtZW50czogc3RyaW5nW10pOiBzdHJpbmc7XG4gICAgcmVhZGRpcihwYXRoOiBzdHJpbmcpOiBzdHJpbmdbXSB8IHVuZGVmaW5lZDtcbiAgICBzdGF0KHBhdGg6IHN0cmluZyk6IFQgfCB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBGaWxlc3lzdGVtU3luYygpOiBGaWxlc3lzdGVtU3luYzxGaWxlc3lzdGVtU3luYy5TdGF0PiB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzb2x2ZSguLi5zZWdtZW50cykge1xuICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUoLi4uc2VnbWVudHMpO1xuICAgICAgICB9LFxuXG4gICAgICAgIHJlYWRkaXIocGF0aCkge1xuICAgICAgICAgICAgcmV0dXJuIG1heWJlUmVhZGRpclN5bmMocGF0aCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgc3RhdChwYXRoKSB7XG4gICAgICAgICAgICBjb25zdCBzdGF0cyA9IG1heWJlU3RhdFN5bmMocGF0aCk7XG4gICAgICAgICAgICBpZiAoc3RhdHMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBnZXQgaXNGaWxlKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN0YXRzLmlzRmlsZSgpO1xuICAgICAgICAgICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICAgICAgICAgIGdldCBpc0RpcmVjdG9yeSgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBzdGF0cy5pc0RpcmVjdG9yeSgpO1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgfTtcbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBGaWxlc3lzdGVtU3luYyB7XG4gICAgZXhwb3J0IGludGVyZmFjZSBTdGF0IHtcbiAgICAgICAgaXNEaXJlY3Rvcnk/OiBib29sZWFuO1xuICAgICAgICBpc0ZpbGU/OiBib29sZWFuO1xuICAgIH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFNQSxTQUFTLGFBQWEsY0FBYyxnQkFBZ0I7QUFDcEQsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsdUJBQXVCO0FBRWhDLFNBQVMsZ0JBQWdCLEdBQVk7QUFDakMsU0FBTyxPQUFPLE1BQU0sWUFBWSxNQUFNLFFBQVEsVUFBVSxNQUFNLEVBQUUsU0FBUyxZQUFZLEVBQUUsU0FBUztBQUNwRztBQUVPLFNBQVMsY0FBYyxNQUFjO0FBQ3hDLE1BQUk7QUFDQSxXQUFPLFNBQVMsSUFBSTtBQUFBLEVBQ3hCLFNBQVMsR0FBRztBQUNSLFFBQUksZ0JBQWdCLENBQUMsR0FBRztBQUNwQjtBQUFBLElBQ0o7QUFDQSxVQUFNO0FBQUEsRUFDVjtBQUNKO0FBRU8sU0FBUyxrQkFBa0IsTUFBYztBQUM1QyxNQUFJO0FBQ0EsV0FBTyxLQUFLLE1BQU0sYUFBYSxNQUFNLE9BQU8sQ0FBQztBQUFBLEVBQ2pELFNBQVMsR0FBRztBQUNSLFFBQUksZ0JBQWdCLENBQUMsR0FBRztBQUNwQjtBQUFBLElBQ0o7QUFDQSxRQUFJLGFBQWEsYUFBYTtBQUMxQixRQUFFLFVBQVUsaUJBQWlCLElBQUksS0FBSyxFQUFFLE9BQU87QUFDL0MsWUFBTTtBQUFBLElBQ1Y7QUFDQSxVQUFNO0FBQUEsRUFDVjtBQUNKO0FBRU8sU0FBUyxpQkFBaUIsTUFBYztBQUMzQyxNQUFJO0FBQ0EsV0FBTyxZQUFZLElBQUk7QUFBQSxFQUMzQixTQUFTLEdBQUc7QUFDUixRQUFJLGdCQUFnQixDQUFDLEdBQUc7QUFDcEI7QUFBQSxJQUNKO0FBQUEsRUFDSjtBQUNKO0FBRU8sU0FBUyxZQUFZLE1BQWM7QUFDdEMsU0FBTyxDQUFDLENBQUMsZ0JBQWdCLFVBQVUsTUFBTSxTQUFTLElBQUksRUFBRSxZQUFZLENBQUM7QUFDekU7QUFFTyxTQUFTLE9BQU8sTUFBYztBQUNqQyxTQUFPLENBQUMsQ0FBQyxnQkFBZ0IsVUFBVSxNQUFNLFNBQVMsSUFBSSxFQUFFLE9BQU8sQ0FBQztBQUNwRTtBQVdPLFNBQVMsaUJBQXNEO0FBQ2xFLFNBQU87QUFBQSxJQUNILFdBQVcsVUFBVTtBQUNqQixhQUFPLFFBQVEsR0FBRyxRQUFRO0FBQUEsSUFDOUI7QUFBQSxJQUVBLFFBQVEsTUFBTTtBQUNWLGFBQU8saUJBQWlCLElBQUk7QUFBQSxJQUNoQztBQUFBLElBRUEsS0FBSyxNQUFNO0FBQ1AsWUFBTSxRQUFRLGNBQWMsSUFBSTtBQUNoQyxVQUFJLE9BQU87QUFDUCxlQUFPO0FBQUEsVUFDSCxJQUFJLFNBQVM7QUFDVCxtQkFBTyxNQUFNLE9BQU87QUFBQSxVQUN4QjtBQUFBLFVBRUEsSUFBSSxjQUFjO0FBQ2QsbUJBQU8sTUFBTSxZQUFZO0FBQUEsVUFDN0I7QUFBQSxRQUNKO0FBQUEsTUFDSjtBQUFBLElBQ0o7QUFBQSxFQUNKO0FBQ0o7IiwKICAibmFtZXMiOiBbXQp9Cg==
