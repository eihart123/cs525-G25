/**
 * @license
 * Copyright 2022-2025 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */
var SgrOpcode = /* @__PURE__ */ ((SgrOpcode2) => {
  SgrOpcode2[SgrOpcode2["reset"] = 0] = "reset";
  SgrOpcode2[SgrOpcode2["bold"] = 1] = "bold";
  SgrOpcode2[SgrOpcode2["dim"] = 2] = "dim";
  SgrOpcode2[SgrOpcode2["italic"] = 3] = "italic";
  SgrOpcode2[SgrOpcode2["underline"] = 4] = "underline";
  SgrOpcode2[SgrOpcode2["slowBlink"] = 5] = "slowBlink";
  SgrOpcode2[SgrOpcode2["fastBlink"] = 6] = "fastBlink";
  SgrOpcode2[SgrOpcode2["invert"] = 7] = "invert";
  SgrOpcode2[SgrOpcode2["conceal"] = 8] = "conceal";
  SgrOpcode2[SgrOpcode2["strike"] = 9] = "strike";
  SgrOpcode2[SgrOpcode2["normalFont"] = 10] = "normalFont";
  SgrOpcode2[SgrOpcode2["gothic"] = 20] = "gothic";
  SgrOpcode2[SgrOpcode2["doubleUnderline"] = 21] = "doubleUnderline";
  SgrOpcode2[SgrOpcode2["normalIntensity"] = 22] = "normalIntensity";
  SgrOpcode2[SgrOpcode2["notItalic"] = 23] = "notItalic";
  SgrOpcode2[SgrOpcode2["notUnderline"] = 24] = "notUnderline";
  SgrOpcode2[SgrOpcode2["notBlink"] = 25] = "notBlink";
  SgrOpcode2[SgrOpcode2["notInvert"] = 27] = "notInvert";
  SgrOpcode2[SgrOpcode2["notConceal"] = 28] = "notConceal";
  SgrOpcode2[SgrOpcode2["notStrike"] = 29] = "notStrike";
  SgrOpcode2[SgrOpcode2["normalFg"] = 39] = "normalFg";
  SgrOpcode2[SgrOpcode2["normalBg"] = 49] = "normalBg";
  return SgrOpcode2;
})(SgrOpcode || {});
var SgrCategory = /* @__PURE__ */ ((SgrCategory2) => {
  SgrCategory2[SgrCategory2["reset"] = 0] = "reset";
  SgrCategory2[SgrCategory2["intensity"] = 1] = "intensity";
  SgrCategory2[SgrCategory2["italic"] = 2] = "italic";
  SgrCategory2[SgrCategory2["underline"] = 3] = "underline";
  SgrCategory2[SgrCategory2["blink"] = 4] = "blink";
  SgrCategory2[SgrCategory2["invert"] = 5] = "invert";
  SgrCategory2[SgrCategory2["conceal"] = 6] = "conceal";
  SgrCategory2[SgrCategory2["strike"] = 7] = "strike";
  SgrCategory2[SgrCategory2["font"] = 8] = "font";
  SgrCategory2[SgrCategory2["fg"] = 9] = "fg";
  SgrCategory2[SgrCategory2["bg"] = 10] = "bg";
  return SgrCategory2;
})(SgrCategory || {});
var SgrOpcodeBlock = /* @__PURE__ */ ((SgrOpcodeBlock2) => {
  SgrOpcodeBlock2[SgrOpcodeBlock2["font"] = 10] = "font";
  SgrOpcodeBlock2[SgrOpcodeBlock2["fg"] = 30] = "fg";
  SgrOpcodeBlock2[SgrOpcodeBlock2["bg"] = 40] = "bg";
  SgrOpcodeBlock2[SgrOpcodeBlock2["fgBright"] = 90] = "fgBright";
  SgrOpcodeBlock2[SgrOpcodeBlock2["bgBright"] = 100] = "bgBright";
  return SgrOpcodeBlock2;
})(SgrOpcodeBlock || {});
var Color = /* @__PURE__ */ ((Color2) => {
  Color2[Color2["black"] = 0] = "black";
  Color2[Color2["red"] = 1] = "red";
  Color2[Color2["green"] = 2] = "green";
  Color2[Color2["yellow"] = 3] = "yellow";
  Color2[Color2["blue"] = 4] = "blue";
  Color2[Color2["magenta"] = 5] = "magenta";
  Color2[Color2["cyan"] = 6] = "cyan";
  Color2[Color2["white"] = 7] = "white";
  Color2[Color2["extended"] = 8] = "extended";
  return Color2;
})(Color || {});
var ExtendedColor = /* @__PURE__ */ ((ExtendedColor2) => {
  ExtendedColor2[ExtendedColor2["rgb"] = 2] = "rgb";
  ExtendedColor2[ExtendedColor2["eightBit"] = 5] = "eightBit";
  return ExtendedColor2;
})(ExtendedColor || {});
const SgrOpcodeToCategory = Array(110);
const SgrOpcodeToUndoOpcode = Array(110);
{
  let setCat = function(code, category, undo) {
    const opcode = SgrOpcode[code];
    SgrOpcodeToCategory[opcode] = SgrCategory[category];
    if (undo !== void 0) {
      SgrOpcodeToUndoOpcode[opcode] = SgrOpcode[undo];
    }
  }, setBlockCat = function(block, category, undo) {
    const start = SgrOpcodeBlock[block];
    for (let i = SgrOpcodeBlock[block]; i < start + 10; i++) {
      SgrOpcodeToCategory[i] = SgrCategory[category];
      SgrOpcodeToUndoOpcode[i] = SgrOpcode[undo];
    }
  };
  var setCat2 = setCat, setBlockCat2 = setBlockCat;
  setCat("reset", "reset");
  setCat("dim", "intensity", "normalIntensity");
  setCat("bold", "intensity", "normalIntensity");
  setCat("normalIntensity", "intensity");
  setCat("italic", "italic", "notItalic");
  setCat("notItalic", "italic");
  setCat("underline", "underline", "notUnderline");
  setCat("doubleUnderline", "underline", "notUnderline");
  setCat("notUnderline", "underline");
  setCat("fastBlink", "blink", "notBlink");
  setCat("slowBlink", "blink", "notBlink");
  setCat("notBlink", "blink");
  setCat("invert", "invert", "notInvert");
  setCat("notInvert", "invert");
  setCat("conceal", "conceal", "notConceal");
  setCat("notConceal", "conceal");
  setCat("strike", "strike", "notStrike");
  setCat("notStrike", "strike");
  setBlockCat("font", "font", "normalFont");
  setBlockCat("fg", "fg", "normalFg");
  setBlockCat("fgBright", "fg", "normalFg");
  setBlockCat("bg", "bg", "normalBg");
  setBlockCat("bgBright", "bg", "normalBg");
}
export {
  Color,
  ExtendedColor,
  SgrCategory,
  SgrOpcode,
  SgrOpcodeBlock,
  SgrOpcodeToCategory,
  SgrOpcodeToUndoOpcode
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vc3JjL2Fuc2ktdGV4dC9zZ3IudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCAyMDIyLTIwMjUgTWF0dGVyLmpzIEF1dGhvcnNcbiAqIFNQRFgtTGljZW5zZS1JZGVudGlmaWVyOiBBcGFjaGUtMi4wXG4gKi9cblxuLyoqXG4gKiBTR1IgKHNlbGVjdCBncmFwaGljcyByZW5kaXRpb24pIG9wY29kZXMuXG4gKlxuICogU0dSIGlzIGEgQ1NJIChBTlNJIFwiY29udHJvbCBzZXF1ZW5jZSBpbnRyb2R1Y2VyXCIsIG9yIEVTQy1bKSBzZXF1ZW5jZSB0ZXJtaW5hdGVkIGJ5IFwibVwiLlxuICovXG5leHBvcnQgZW51bSBTZ3JPcGNvZGUge1xuICAgIHJlc2V0ID0gMCxcbiAgICBib2xkID0gMSxcbiAgICBkaW0gPSAyLFxuICAgIGl0YWxpYyA9IDMsXG4gICAgdW5kZXJsaW5lID0gNCxcbiAgICBzbG93QmxpbmsgPSA1LFxuICAgIGZhc3RCbGluayA9IDYsXG4gICAgaW52ZXJ0ID0gNyxcbiAgICBjb25jZWFsID0gOCxcbiAgICBzdHJpa2UgPSA5LFxuICAgIG5vcm1hbEZvbnQgPSAxMCxcbiAgICBnb3RoaWMgPSAyMCxcbiAgICBkb3VibGVVbmRlcmxpbmUgPSAyMSxcbiAgICBub3JtYWxJbnRlbnNpdHkgPSAyMixcbiAgICBub3RJdGFsaWMgPSAyMyxcbiAgICBub3RVbmRlcmxpbmUgPSAyNCxcbiAgICBub3RCbGluayA9IDI1LFxuICAgIG5vdEludmVydCA9IDI3LFxuICAgIG5vdENvbmNlYWwgPSAyOCxcbiAgICBub3RTdHJpa2UgPSAyOSxcbiAgICBub3JtYWxGZyA9IDM5LFxuICAgIG5vcm1hbEJnID0gNDksXG59XG5cbi8qKlxuICogU0dSIGNhdGVnb3JpZXMuXG4gKlxuICogRWFjaCBvZiB0aGVzZSBpcyBjbGVhcmVkIHZpYSBhIHNpbmdsZSBvcGNvZGUuICBFeGNlcHQgZm9yIGludGVuc2l0eSAoZGltL2JvbGQpIG9ubHkgb25lIHZhbHVlIG1heSBiZSBpbiBlZmZlY3QuXG4gKi9cbmV4cG9ydCBlbnVtIFNnckNhdGVnb3J5IHtcbiAgICByZXNldCxcbiAgICBpbnRlbnNpdHksXG4gICAgaXRhbGljLFxuICAgIHVuZGVybGluZSxcbiAgICBibGluayxcbiAgICBpbnZlcnQsXG4gICAgY29uY2VhbCxcbiAgICBzdHJpa2UsXG4gICAgZm9udCxcbiAgICBmZyxcbiAgICBiZyxcbn1cblxuLyoqXG4gKiBNYXNrcyBmb3IgbWVhbmluZ2Z1bCBncm91cHMgb2YgQ1NJIGNvZGVzLlxuICovXG5leHBvcnQgZW51bSBTZ3JPcGNvZGVCbG9jayB7XG4gICAgZm9udCA9IDEwLFxuICAgIGZnID0gMzAsXG4gICAgYmcgPSA0MCxcbiAgICBmZ0JyaWdodCA9IDkwLFxuICAgIGJnQnJpZ2h0ID0gMTAwLFxufVxuXG4vKipcbiAqIENvbG9yIHNlbGVjdG9ycy5cbiAqL1xuZXhwb3J0IGVudW0gQ29sb3Ige1xuICAgIGJsYWNrID0gMCxcbiAgICByZWQgPSAxLFxuICAgIGdyZWVuID0gMixcbiAgICB5ZWxsb3cgPSAzLFxuICAgIGJsdWUgPSA0LFxuICAgIG1hZ2VudGEgPSA1LFxuICAgIGN5YW4gPSA2LFxuICAgIHdoaXRlID0gNyxcbiAgICBleHRlbmRlZCA9IDgsXG59XG5cbi8qKlxuICogRXh0ZW5kZWQgY29sb3Igc3Vic2VsZWN0b3JzLlxuICovXG5leHBvcnQgZW51bSBFeHRlbmRlZENvbG9yIHtcbiAgICByZ2IgPSAyLFxuICAgIGVpZ2h0Qml0ID0gNSxcbn1cblxuLyoqXG4gKiBNYXBwaW5nIG9mIG9wY29kZXMgdG8gY2F0ZWdvcmllcy5cbiAqL1xuZXhwb3J0IGNvbnN0IFNnck9wY29kZVRvQ2F0ZWdvcnkgPSBBcnJheTxudW1iZXIgfCB1bmRlZmluZWQ+KDExMCk7XG5cbi8qKlxuICogTWFwcGluZyBvZiBvcGNvZGVzIHRvIG9wY29kZXMgdGhhdCBkaXNhYmxlIHRoZSBhdHRyaWJ1dGUuXG4gKi9cbmV4cG9ydCBjb25zdCBTZ3JPcGNvZGVUb1VuZG9PcGNvZGUgPSBBcnJheTxudW1iZXIgfCB1bmRlZmluZWQ+KDExMCk7XG5cbntcbiAgICBmdW5jdGlvbiBzZXRDYXQoY29kZToga2V5b2YgdHlwZW9mIFNnck9wY29kZSwgY2F0ZWdvcnk6IGtleW9mIHR5cGVvZiBTZ3JDYXRlZ29yeSwgdW5kbz86IGtleW9mIHR5cGVvZiBTZ3JPcGNvZGUpIHtcbiAgICAgICAgY29uc3Qgb3Bjb2RlID0gU2dyT3Bjb2RlW2NvZGVdO1xuICAgICAgICBTZ3JPcGNvZGVUb0NhdGVnb3J5W29wY29kZV0gPSBTZ3JDYXRlZ29yeVtjYXRlZ29yeV07XG4gICAgICAgIGlmICh1bmRvICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIFNnck9wY29kZVRvVW5kb09wY29kZVtvcGNvZGVdID0gU2dyT3Bjb2RlW3VuZG9dO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2V0QmxvY2tDYXQoXG4gICAgICAgIGJsb2NrOiBrZXlvZiB0eXBlb2YgU2dyT3Bjb2RlQmxvY2ssXG4gICAgICAgIGNhdGVnb3J5OiBrZXlvZiB0eXBlb2YgU2dyQ2F0ZWdvcnksXG4gICAgICAgIHVuZG86IGtleW9mIHR5cGVvZiBTZ3JPcGNvZGUsXG4gICAgKSB7XG4gICAgICAgIGNvbnN0IHN0YXJ0ID0gU2dyT3Bjb2RlQmxvY2tbYmxvY2tdO1xuICAgICAgICBmb3IgKGxldCBpID0gU2dyT3Bjb2RlQmxvY2tbYmxvY2tdOyBpIDwgc3RhcnQgKyAxMDsgaSsrKSB7XG4gICAgICAgICAgICBTZ3JPcGNvZGVUb0NhdGVnb3J5W2ldID0gU2dyQ2F0ZWdvcnlbY2F0ZWdvcnldO1xuICAgICAgICAgICAgU2dyT3Bjb2RlVG9VbmRvT3Bjb2RlW2ldID0gU2dyT3Bjb2RlW3VuZG9dO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0Q2F0KFwicmVzZXRcIiwgXCJyZXNldFwiKTtcbiAgICBzZXRDYXQoXCJkaW1cIiwgXCJpbnRlbnNpdHlcIiwgXCJub3JtYWxJbnRlbnNpdHlcIik7XG4gICAgc2V0Q2F0KFwiYm9sZFwiLCBcImludGVuc2l0eVwiLCBcIm5vcm1hbEludGVuc2l0eVwiKTtcbiAgICBzZXRDYXQoXCJub3JtYWxJbnRlbnNpdHlcIiwgXCJpbnRlbnNpdHlcIik7XG4gICAgc2V0Q2F0KFwiaXRhbGljXCIsIFwiaXRhbGljXCIsIFwibm90SXRhbGljXCIpO1xuICAgIHNldENhdChcIm5vdEl0YWxpY1wiLCBcIml0YWxpY1wiKTtcbiAgICBzZXRDYXQoXCJ1bmRlcmxpbmVcIiwgXCJ1bmRlcmxpbmVcIiwgXCJub3RVbmRlcmxpbmVcIik7XG4gICAgc2V0Q2F0KFwiZG91YmxlVW5kZXJsaW5lXCIsIFwidW5kZXJsaW5lXCIsIFwibm90VW5kZXJsaW5lXCIpO1xuICAgIHNldENhdChcIm5vdFVuZGVybGluZVwiLCBcInVuZGVybGluZVwiKTtcbiAgICBzZXRDYXQoXCJmYXN0QmxpbmtcIiwgXCJibGlua1wiLCBcIm5vdEJsaW5rXCIpO1xuICAgIHNldENhdChcInNsb3dCbGlua1wiLCBcImJsaW5rXCIsIFwibm90QmxpbmtcIik7XG4gICAgc2V0Q2F0KFwibm90QmxpbmtcIiwgXCJibGlua1wiKTtcbiAgICBzZXRDYXQoXCJpbnZlcnRcIiwgXCJpbnZlcnRcIiwgXCJub3RJbnZlcnRcIik7XG4gICAgc2V0Q2F0KFwibm90SW52ZXJ0XCIsIFwiaW52ZXJ0XCIpO1xuICAgIHNldENhdChcImNvbmNlYWxcIiwgXCJjb25jZWFsXCIsIFwibm90Q29uY2VhbFwiKTtcbiAgICBzZXRDYXQoXCJub3RDb25jZWFsXCIsIFwiY29uY2VhbFwiKTtcbiAgICBzZXRDYXQoXCJzdHJpa2VcIiwgXCJzdHJpa2VcIiwgXCJub3RTdHJpa2VcIik7XG4gICAgc2V0Q2F0KFwibm90U3RyaWtlXCIsIFwic3RyaWtlXCIpO1xuICAgIHNldEJsb2NrQ2F0KFwiZm9udFwiLCBcImZvbnRcIiwgXCJub3JtYWxGb250XCIpO1xuICAgIHNldEJsb2NrQ2F0KFwiZmdcIiwgXCJmZ1wiLCBcIm5vcm1hbEZnXCIpO1xuICAgIHNldEJsb2NrQ2F0KFwiZmdCcmlnaHRcIiwgXCJmZ1wiLCBcIm5vcm1hbEZnXCIpO1xuICAgIHNldEJsb2NrQ2F0KFwiYmdcIiwgXCJiZ1wiLCBcIm5vcm1hbEJnXCIpO1xuICAgIHNldEJsb2NrQ2F0KFwiYmdCcmlnaHRcIiwgXCJiZ1wiLCBcIm5vcm1hbEJnXCIpO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEVpZ2h0Qml0Q29sb3Ige1xuICAgIGNvbG9yOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmdiQ29sb3Ige1xuICAgIHI/OiBudW1iZXI7XG4gICAgZz86IG51bWJlcjtcbiAgICBiPzogbnVtYmVyO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQVdPLElBQUssWUFBTCxrQkFBS0EsZUFBTDtBQUNILEVBQUFBLHNCQUFBLFdBQVEsS0FBUjtBQUNBLEVBQUFBLHNCQUFBLFVBQU8sS0FBUDtBQUNBLEVBQUFBLHNCQUFBLFNBQU0sS0FBTjtBQUNBLEVBQUFBLHNCQUFBLFlBQVMsS0FBVDtBQUNBLEVBQUFBLHNCQUFBLGVBQVksS0FBWjtBQUNBLEVBQUFBLHNCQUFBLGVBQVksS0FBWjtBQUNBLEVBQUFBLHNCQUFBLGVBQVksS0FBWjtBQUNBLEVBQUFBLHNCQUFBLFlBQVMsS0FBVDtBQUNBLEVBQUFBLHNCQUFBLGFBQVUsS0FBVjtBQUNBLEVBQUFBLHNCQUFBLFlBQVMsS0FBVDtBQUNBLEVBQUFBLHNCQUFBLGdCQUFhLE1BQWI7QUFDQSxFQUFBQSxzQkFBQSxZQUFTLE1BQVQ7QUFDQSxFQUFBQSxzQkFBQSxxQkFBa0IsTUFBbEI7QUFDQSxFQUFBQSxzQkFBQSxxQkFBa0IsTUFBbEI7QUFDQSxFQUFBQSxzQkFBQSxlQUFZLE1BQVo7QUFDQSxFQUFBQSxzQkFBQSxrQkFBZSxNQUFmO0FBQ0EsRUFBQUEsc0JBQUEsY0FBVyxNQUFYO0FBQ0EsRUFBQUEsc0JBQUEsZUFBWSxNQUFaO0FBQ0EsRUFBQUEsc0JBQUEsZ0JBQWEsTUFBYjtBQUNBLEVBQUFBLHNCQUFBLGVBQVksTUFBWjtBQUNBLEVBQUFBLHNCQUFBLGNBQVcsTUFBWDtBQUNBLEVBQUFBLHNCQUFBLGNBQVcsTUFBWDtBQXRCUSxTQUFBQTtBQUFBLEdBQUE7QUE4QkwsSUFBSyxjQUFMLGtCQUFLQyxpQkFBTDtBQUNILEVBQUFBLDBCQUFBO0FBQ0EsRUFBQUEsMEJBQUE7QUFDQSxFQUFBQSwwQkFBQTtBQUNBLEVBQUFBLDBCQUFBO0FBQ0EsRUFBQUEsMEJBQUE7QUFDQSxFQUFBQSwwQkFBQTtBQUNBLEVBQUFBLDBCQUFBO0FBQ0EsRUFBQUEsMEJBQUE7QUFDQSxFQUFBQSwwQkFBQTtBQUNBLEVBQUFBLDBCQUFBO0FBQ0EsRUFBQUEsMEJBQUE7QUFYUSxTQUFBQTtBQUFBLEdBQUE7QUFpQkwsSUFBSyxpQkFBTCxrQkFBS0Msb0JBQUw7QUFDSCxFQUFBQSxnQ0FBQSxVQUFPLE1BQVA7QUFDQSxFQUFBQSxnQ0FBQSxRQUFLLE1BQUw7QUFDQSxFQUFBQSxnQ0FBQSxRQUFLLE1BQUw7QUFDQSxFQUFBQSxnQ0FBQSxjQUFXLE1BQVg7QUFDQSxFQUFBQSxnQ0FBQSxjQUFXLE9BQVg7QUFMUSxTQUFBQTtBQUFBLEdBQUE7QUFXTCxJQUFLLFFBQUwsa0JBQUtDLFdBQUw7QUFDSCxFQUFBQSxjQUFBLFdBQVEsS0FBUjtBQUNBLEVBQUFBLGNBQUEsU0FBTSxLQUFOO0FBQ0EsRUFBQUEsY0FBQSxXQUFRLEtBQVI7QUFDQSxFQUFBQSxjQUFBLFlBQVMsS0FBVDtBQUNBLEVBQUFBLGNBQUEsVUFBTyxLQUFQO0FBQ0EsRUFBQUEsY0FBQSxhQUFVLEtBQVY7QUFDQSxFQUFBQSxjQUFBLFVBQU8sS0FBUDtBQUNBLEVBQUFBLGNBQUEsV0FBUSxLQUFSO0FBQ0EsRUFBQUEsY0FBQSxjQUFXLEtBQVg7QUFUUSxTQUFBQTtBQUFBLEdBQUE7QUFlTCxJQUFLLGdCQUFMLGtCQUFLQyxtQkFBTDtBQUNILEVBQUFBLDhCQUFBLFNBQU0sS0FBTjtBQUNBLEVBQUFBLDhCQUFBLGNBQVcsS0FBWDtBQUZRLFNBQUFBO0FBQUEsR0FBQTtBQVFMLE1BQU0sc0JBQXNCLE1BQTBCLEdBQUc7QUFLekQsTUFBTSx3QkFBd0IsTUFBMEIsR0FBRztBQUVsRTtBQUNJLE1BQVMsU0FBVCxTQUFnQixNQUE4QixVQUFvQyxNQUErQjtBQUM3RyxVQUFNLFNBQVMsVUFBVSxJQUFJO0FBQzdCLHdCQUFvQixNQUFNLElBQUksWUFBWSxRQUFRO0FBQ2xELFFBQUksU0FBUyxRQUFXO0FBQ3BCLDRCQUFzQixNQUFNLElBQUksVUFBVSxJQUFJO0FBQUEsSUFDbEQ7QUFBQSxFQUNKLEdBRVMsY0FBVCxTQUNJLE9BQ0EsVUFDQSxNQUNGO0FBQ0UsVUFBTSxRQUFRLGVBQWUsS0FBSztBQUNsQyxhQUFTLElBQUksZUFBZSxLQUFLLEdBQUcsSUFBSSxRQUFRLElBQUksS0FBSztBQUNyRCwwQkFBb0IsQ0FBQyxJQUFJLFlBQVksUUFBUTtBQUM3Qyw0QkFBc0IsQ0FBQyxJQUFJLFVBQVUsSUFBSTtBQUFBLElBQzdDO0FBQUEsRUFDSjtBQWxCUyxNQUFBQyxVQUFBLFFBUUFDLGVBQUE7QUFZVCxTQUFPLFNBQVMsT0FBTztBQUN2QixTQUFPLE9BQU8sYUFBYSxpQkFBaUI7QUFDNUMsU0FBTyxRQUFRLGFBQWEsaUJBQWlCO0FBQzdDLFNBQU8sbUJBQW1CLFdBQVc7QUFDckMsU0FBTyxVQUFVLFVBQVUsV0FBVztBQUN0QyxTQUFPLGFBQWEsUUFBUTtBQUM1QixTQUFPLGFBQWEsYUFBYSxjQUFjO0FBQy9DLFNBQU8sbUJBQW1CLGFBQWEsY0FBYztBQUNyRCxTQUFPLGdCQUFnQixXQUFXO0FBQ2xDLFNBQU8sYUFBYSxTQUFTLFVBQVU7QUFDdkMsU0FBTyxhQUFhLFNBQVMsVUFBVTtBQUN2QyxTQUFPLFlBQVksT0FBTztBQUMxQixTQUFPLFVBQVUsVUFBVSxXQUFXO0FBQ3RDLFNBQU8sYUFBYSxRQUFRO0FBQzVCLFNBQU8sV0FBVyxXQUFXLFlBQVk7QUFDekMsU0FBTyxjQUFjLFNBQVM7QUFDOUIsU0FBTyxVQUFVLFVBQVUsV0FBVztBQUN0QyxTQUFPLGFBQWEsUUFBUTtBQUM1QixjQUFZLFFBQVEsUUFBUSxZQUFZO0FBQ3hDLGNBQVksTUFBTSxNQUFNLFVBQVU7QUFDbEMsY0FBWSxZQUFZLE1BQU0sVUFBVTtBQUN4QyxjQUFZLE1BQU0sTUFBTSxVQUFVO0FBQ2xDLGNBQVksWUFBWSxNQUFNLFVBQVU7QUFDNUM7IiwKICAibmFtZXMiOiBbIlNnck9wY29kZSIsICJTZ3JDYXRlZ29yeSIsICJTZ3JPcGNvZGVCbG9jayIsICJDb2xvciIsICJFeHRlbmRlZENvbG9yIiwgInNldENhdCIsICJzZXRCbG9ja0NhdCJdCn0K
