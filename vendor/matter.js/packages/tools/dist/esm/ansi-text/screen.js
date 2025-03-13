/**
 * @license
 * Copyright 2022-2025 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */
var screen;
((screen2) => {
  let erase;
  ((erase2) => {
    erase2.toEol = "\x1B[K";
    erase2.line = `\r${erase2.toEol}`;
  })(erase = screen2.erase || (screen2.erase = {}));
  screen2.clear = "\x1B[K";
})(screen || (screen = {}));
export {
  screen
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vc3JjL2Fuc2ktdGV4dC9zY3JlZW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCAyMDIyLTIwMjUgTWF0dGVyLmpzIEF1dGhvcnNcbiAqIFNQRFgtTGljZW5zZS1JZGVudGlmaWVyOiBBcGFjaGUtMi4wXG4gKi9cblxuZXhwb3J0IG5hbWVzcGFjZSBzY3JlZW4ge1xuICAgIGV4cG9ydCBuYW1lc3BhY2UgZXJhc2Uge1xuICAgICAgICAvLyBFcmFzZSB0byBlbmQgb2YgbGluZVxuICAgICAgICBleHBvcnQgY29uc3QgdG9Fb2wgPSBcIlxceDFiW0tcIjtcblxuICAgICAgICAvLyBNb3ZlIHRvIHN0YXJ0IG9mIGxpbmUgYW5kIGVyYXNlXG4gICAgICAgIGV4cG9ydCBjb25zdCBsaW5lID0gYFxcciR7dG9Fb2x9YDtcbiAgICB9XG5cbiAgICAvLyBDbGVhciBhbGwgbGluZXNcbiAgICBleHBvcnQgY29uc3QgY2xlYXIgPSBcIlxceDFiW0tcIjtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFNTyxJQUFVO0FBQUEsQ0FBVixDQUFVQSxZQUFWO0FBQ0ksTUFBVTtBQUFWLElBQVVDLFdBQVY7QUFFSSxJQUFNQSxPQUFBLFFBQVE7QUFHZCxJQUFNQSxPQUFBLE9BQU8sS0FBS0EsT0FBQSxLQUFLO0FBQUEsS0FMakIsUUFBQUQsUUFBQSxVQUFBQSxRQUFBO0FBU1YsRUFBTUEsUUFBQSxRQUFRO0FBQUEsR0FWUjsiLAogICJuYW1lcyI6IFsic2NyZWVuIiwgImVyYXNlIl0KfQo=
