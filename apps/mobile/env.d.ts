// Metro statically replaces `process.env.EXPO_PUBLIC_*` at bundle time; no
// @types/node dependency needed, just enough of an ambient declaration for
// tsc to recognize `process.env` in app code.
declare const process: {
  env: Record<string, string | undefined>;
};
