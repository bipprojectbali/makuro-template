// Output of `react-router build`; only exists after a build, so the compiler must
// not depend on the file being present (prod.ts imports it statically for --compile).
declare module '*/build/server/index.js' {
  const build: unknown;
  export = build;
}
