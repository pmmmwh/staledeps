#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { URL } from "node:url";
import { TextDecoder } from "node:util";

import type { StringValue } from "ms";
import ms from "ms";
import ora, { oraPromise } from "ora";
import pLimit from "p-limit";
import type { PackageJson } from "type-fest";
import undici from "undici";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { packageJson, t, toAgo, toISOString, typedBoolean } from "./helpers.js";
import { outputs } from "./outputs.js";
import type {
  DependencyResult,
  ManifestData,
  ManifestOutputData,
  Options,
} from "./types/commons.js";

type RegistryResponse = {
  readonly ["dist-tags"]: {
    latest: string;
  };
  readonly time: {
    readonly [key: string]: string;
  };
};

const formatters = {
  absolute: toISOString,
  relative: toAgo,
} as const;

async function main(
  paths: ReadonlyArray<string | number>,
  options: Options
): Promise<void> {
  const processPaths = [...paths];
  if (processPaths.length === 0) {
    ora().info("Auto-loading package.json in current directory");
    processPaths.push("package.json");
  }

  const now = Date.now();

  const fileMsg = t("file", processPaths.length);
  const manifestData = await oraPromise(
    async (ora) => {
      const results = await Promise.all(
        processPaths.map(async (maybePath) => {
          const filePath = path.normalize(String(maybePath));
          try {
            const buffer = await fs.readFile(filePath);
            const data = new TextDecoder().decode(buffer);
            const {
              dependencies = {},
              devDependencies = {},
              name,
            }: PackageJson = JSON.parse(data);
            return [
              filePath,
              {
                dependencies: [
                  ...new Set([
                    ...Object.keys(dependencies),
                    ...Object.keys(devDependencies),
                  ]),
                ].sort(),
                name,
              },
            ] as const;
          } catch (_) {
            ora.fail(`Failed to load package.json from ${filePath}`);
          }
        })
      );

      return new Map<string, ManifestData>(results.filter(typedBoolean));
    },
    {
      discardStdin: false,
      text: `Loading package.json ${fileMsg}`,
      failText: `Failed to load package.json ${fileMsg}`,
      successText: (results) =>
        `Loaded ${results.size} package.json ${fileMsg}`,
    }
  );

  const depSet = new Set<string>();
  for (const { dependencies } of manifestData.values()) {
    dependencies.forEach((dep) => {
      depSet.add(dep);
    });
  }

  const depMsg = t("dependency", depSet.size);
  const depResults = await oraPromise(
    async (ora) => {
      // Rate-limit calls to `npm` to be safe,
      // in case we're pulling for a lot of dependencies
      const limit = pLimit(300);
      const results = await Promise.all(
        Array.from(depSet, (d) => {
          return limit(async (dep) => {
            const packageUrl = new URL(dep, options.registry);
            const { body, statusCode } = await undici.request(packageUrl, {
              maxRedirections: 2,
              method: "GET",
            });
            if (statusCode >= 400) {
              ora.fail(`Failed to fetch metadata for ${dep}`);
              return;
            }

            try {
              const res: RegistryResponse = await body.json();
              const lastPublishTime = res.time[res["dist-tags"].latest];

              let stale = false;
              let lastPublish: number | undefined = undefined;
              if (lastPublishTime) {
                lastPublish = Date.parse(lastPublishTime);
                stale = now - lastPublish > options.threshold;
              }

              return [dep, { lastPublish, stale }] as const;
            } catch (_) {
              ora.fail(`Failed to parse metadata for ${dep}`);
              return;
            }
          }, d);
        })
      );

      return new Map<string, DependencyResult>(results.filter(typedBoolean));
    },
    {
      discardStdin: false,
      text: `Fetching metadata for ${depMsg}`,
      failText: `Failed to fetch metadata for ${depMsg}`,
      successText: (results) =>
        `Fetched metadata for ${results.size} ${depMsg}`,
    }
  );

  const outputData = new Map<string, ManifestOutputData>();
  for (const [path, data] of manifestData.entries()) {
    outputData.set(path, {
      ...data,
      dependencies: data.dependencies
        .map((dep) => {
          const result = depResults.get(dep);
          if (result == null || result.lastPublish == null) {
            return [dep, null, null] as const;
          } else if (result.stale || options.full) {
            return [dep, result.lastPublish, result.stale] as const;
          }
        })
        .filter(typedBoolean)
        .sort((a, b) => {
          if (options.sort === "name") return a[0].localeCompare(b[0]);
          return (a[1] ?? 0) - (b[1] ?? 0);
        })
        .map(([name, lastPublish, stale]) => [
          name,
          lastPublish != null
            ? formatters[options.dateFormat](lastPublish, now)
            : null,
          stale,
        ]),
    });
  }

  outputs[options.output](outputData);
}

yargs(hideBin(process.argv))
  .usage("Usage: $0 <path(s)> [options]")
  .example("$0 ./package.json", packageJson.description)
  .version(packageJson.version)
  .help("h")
  .alias("h", "help")
  .showHelpOnFail(false, "Specify --help for available options")
  .option("d", {
    alias: "date-format",
    coerce: (value): Options["dateFormat"] => {
      if (!["absolute", "relative"].includes(value)) {
        throw new Error(`Date format ${value} is not supported!`);
      }
      return value;
    },
    default: "relative",
    describe: "Format to output dates",
    nargs: 1,
  })
  .option("f", {
    alias: "full",
    default: false,
    describe: "Show full report (including non-stale dependencies)",
    nargs: 0,
    type: "boolean",
  })
  .option("o", {
    alias: "output",
    coerce: (value): "json" | "table" => {
      if (!["json", "table"].includes(value)) {
        throw new Error(`Output to ${value} is not supported!`);
      }
      return value;
    },
    default: "table",
    describe: "Format to output data",
    ngargs: 1,
  })
  .option("r", {
    alias: "registry",
    coerce: (value) => {
      try {
        const url = new URL(String(value));
        if (url.protocol !== "https:") {
          ora().warn("Using non-HTTPS registry URL");
        }
        return url;
      } catch (_) {
        throw new Error("Failed to parse registry URL!");
      }
    },
    default: "https://registry.npmjs.org",
    describe: "URL of registry to check against",
    ngargs: 1,
  })
  .option("s", {
    alias: "sort",
    coerce: (value): "name" | "lastPublish" => {
      if (!["name", "lastPublish"].includes(value)) {
        throw new Error(`Format ${value} is not supported!`);
      }
      return value;
    },
    default: "name",
    describe: "Field to sort data",
    ngargs: 1,
  })
  .option("t", {
    alias: "threshold",
    coerce: (value) => {
      try {
        const result = ms(String(value) as StringValue);
        if (Number.isNaN(result)) {
          throw new Error();
        }
        return result;
      } catch (_) {
        throw new Error("Failed to parse threshold value!");
      }
    },
    default: "2y",
    describe: "Threshold to be determined as stale (see vercel/ms)",
    ngargs: 1,
  })
  .strictOptions()
  .command(
    "$0",
    packageJson.description,
    () => {
      // Do nothing
    },
    (argv) => {
      return main(argv._, {
        dateFormat: argv.d,
        full: argv.f,
        output: argv.o,
        registry: argv.r,
        sort: argv.s,
        threshold: argv.t,
      });
    }
  ).argv;
