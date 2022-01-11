import { createRequire } from "node:module";
import type { PackageJson, SetRequired } from "type-fest";

const require = createRequire(import.meta.url);
export const packageJson: SetRequired<
  PackageJson,
  "description" | "version"
> = require("../package.json");

const strings = {
  file: {
    0: "files",
    1: "file",
    default: "files",
  },
  dependency: {
    0: "dependencies",
    1: "dependency",
    default: "dependencies",
  },
} as const;

export function t(key: keyof typeof strings, value: number) {
  const o = strings[key];
  return o[value as keyof typeof o] ?? o.default;
}

type FalsyValues = false | null | undefined | "" | 0;
export function typedBoolean<ValueType>(
  value: ValueType
): value is Exclude<ValueType, FalsyValues> {
  return Boolean(value);
}
