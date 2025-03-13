/**
 * @license
 * Copyright 2022-2025 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */
import { Command } from "commander";
import process from "node:process";
import { ansi } from "../ansi-text/text-builder.js";
function commander(name, description) {
  return new Command(name).description(description).allowExcessArguments(false).configureOutput({
    writeOut: (str) => process.stdout.write(`
${formatHelp(str)}
`),
    writeErr: (str) => process.stderr.write(`
${ansi.red(str)}
`)
  });
}
function formatHelp(help) {
  if (!help.startsWith("Usage: ")) {
    return help;
  }
  help = help.replace(/^Usage: (\S+)/, (_match, name) => `Usage: ${ansi.bold(name)}`);
  help = help.replace(
    /^( {2}.+ {2})/gm,
    (_match, input) => input.split(",").map((item) => item.replace(/(-*\w+)/, (_match2, word) => ansi.blue(word).toString())).join(",")
  );
  return help;
}
export {
  commander
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vc3JjL3V0aWwvY29tbWFuZGVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgMjAyMi0yMDI1IE1hdHRlci5qcyBBdXRob3JzXG4gKiBTUERYLUxpY2Vuc2UtSWRlbnRpZmllcjogQXBhY2hlLTIuMFxuICovXG5cbmltcG9ydCB7IENvbW1hbmQgfSBmcm9tIFwiY29tbWFuZGVyXCI7XG5pbXBvcnQgcHJvY2VzcyBmcm9tIFwibm9kZTpwcm9jZXNzXCI7XG5pbXBvcnQgeyBhbnNpIH0gZnJvbSBcIi4uL2Fuc2ktdGV4dC90ZXh0LWJ1aWxkZXIuanNcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGNvbW1hbmRlcihuYW1lOiBzdHJpbmcsIGRlc2NyaXB0aW9uOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gbmV3IENvbW1hbmQobmFtZSlcbiAgICAgICAgLmRlc2NyaXB0aW9uKGRlc2NyaXB0aW9uKVxuICAgICAgICAuYWxsb3dFeGNlc3NBcmd1bWVudHMoZmFsc2UpXG4gICAgICAgIC5jb25maWd1cmVPdXRwdXQoe1xuICAgICAgICAgICAgd3JpdGVPdXQ6IHN0ciA9PiBwcm9jZXNzLnN0ZG91dC53cml0ZShgXFxuJHtmb3JtYXRIZWxwKHN0cil9XFxuYCksXG4gICAgICAgICAgICB3cml0ZUVycjogc3RyID0+IHByb2Nlc3Muc3RkZXJyLndyaXRlKGBcXG4ke2Fuc2kucmVkKHN0cil9XFxuYCksXG4gICAgICAgIH0pO1xufVxuZnVuY3Rpb24gZm9ybWF0SGVscChoZWxwOiBzdHJpbmcpIHtcbiAgICBpZiAoIWhlbHAuc3RhcnRzV2l0aChcIlVzYWdlOiBcIikpIHtcbiAgICAgICAgcmV0dXJuIGhlbHA7XG4gICAgfVxuXG4gICAgaGVscCA9IGhlbHAucmVwbGFjZSgvXlVzYWdlOiAoXFxTKykvLCAoX21hdGNoLCBuYW1lKSA9PiBgVXNhZ2U6ICR7YW5zaS5ib2xkKG5hbWUpfWApO1xuICAgIGhlbHAgPSBoZWxwLnJlcGxhY2UoL14oIHsyfS4rIHsyfSkvZ20sIChfbWF0Y2gsIGlucHV0OiBzdHJpbmcpID0+XG4gICAgICAgIGlucHV0XG4gICAgICAgICAgICAuc3BsaXQoXCIsXCIpXG4gICAgICAgICAgICAubWFwKGl0ZW0gPT4gaXRlbS5yZXBsYWNlKC8oLSpcXHcrKS8sIChfbWF0Y2gsIHdvcmQpID0+IGFuc2kuYmx1ZSh3b3JkKS50b1N0cmluZygpKSlcbiAgICAgICAgICAgIC5qb2luKFwiLFwiKSxcbiAgICApO1xuICAgIHJldHVybiBoZWxwO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQU1BLFNBQVMsZUFBZTtBQUN4QixPQUFPLGFBQWE7QUFDcEIsU0FBUyxZQUFZO0FBRWQsU0FBUyxVQUFVLE1BQWMsYUFBcUI7QUFDekQsU0FBTyxJQUFJLFFBQVEsSUFBSSxFQUNsQixZQUFZLFdBQVcsRUFDdkIscUJBQXFCLEtBQUssRUFDMUIsZ0JBQWdCO0FBQUEsSUFDYixVQUFVLFNBQU8sUUFBUSxPQUFPLE1BQU07QUFBQSxFQUFLLFdBQVcsR0FBRyxDQUFDO0FBQUEsQ0FBSTtBQUFBLElBQzlELFVBQVUsU0FBTyxRQUFRLE9BQU8sTUFBTTtBQUFBLEVBQUssS0FBSyxJQUFJLEdBQUcsQ0FBQztBQUFBLENBQUk7QUFBQSxFQUNoRSxDQUFDO0FBQ1Q7QUFDQSxTQUFTLFdBQVcsTUFBYztBQUM5QixNQUFJLENBQUMsS0FBSyxXQUFXLFNBQVMsR0FBRztBQUM3QixXQUFPO0FBQUEsRUFDWDtBQUVBLFNBQU8sS0FBSyxRQUFRLGlCQUFpQixDQUFDLFFBQVEsU0FBUyxVQUFVLEtBQUssS0FBSyxJQUFJLENBQUMsRUFBRTtBQUNsRixTQUFPLEtBQUs7QUFBQSxJQUFRO0FBQUEsSUFBbUIsQ0FBQyxRQUFRLFVBQzVDLE1BQ0ssTUFBTSxHQUFHLEVBQ1QsSUFBSSxVQUFRLEtBQUssUUFBUSxXQUFXLENBQUNBLFNBQVEsU0FBUyxLQUFLLEtBQUssSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDLEVBQ2pGLEtBQUssR0FBRztBQUFBLEVBQ2pCO0FBQ0EsU0FBTztBQUNYOyIsCiAgIm5hbWVzIjogWyJfbWF0Y2giXQp9Cg==
