#!/usr/bin/env node

import chalk from "chalk";
import type { StringValue } from "ms";
import ms from "ms";
import fs from "node:fs/promises";
import path from "node:path";
import { URL } from "node:url";
import { TextDecoder } from "node:util";
import ora, { oraPromise } from "ora";
import pLimit from "p-limit";
import type { PackageJson } from "type-fest";
import undici from "undici";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { packageJson, t, typedBoolean } from "./helpers.js";
import Table from "./table.js";

type Options = {
  readonly full: boolean;
  readonly registry: URL;
  readonly threshold: number;
};

type ManifestData = {
  readonly dependencies: string[];
  readonly name?: string;
};

type RegistryReesponse = {
  readonly ["dist-tags"]: {
    latest: string;
  };
  readonly time: {
    readonly [key: string]: string;
  };
};

type DependencyResult = {
  readonly lastPublish: string;
  readonly stale: boolean;
};

async function main(
  paths: ReadonlyArray<string | number>,
  options: Options
): Promise<void> {
  const processPaths = [...paths];
  if (processPaths.length === 0) {
    ora().info("Auto-loading package.json in current directory");
    processPaths.push("package.json");
  }

  const fileMsg = t("file", processPaths.length);
  const manitestData = await oraPromise(
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
                  ...Object.keys(dependencies),
                  ...Object.keys(devDependencies),
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
      text: `Loading package.json ${fileMsg}`,
      failText: `Failed to load package.json ${fileMsg}`,
      successText: (results) =>
        `Loaded ${results.size} package.json ${fileMsg}`,
    }
  );

  const depSet = new Set<string>();
  for (const { dependencies } of manitestData.values()) {
    dependencies.forEach((dep) => {
      depSet.add(dep);
    });
  }

  const depMsg = t("dependency", depSet.size);
  const depResults = await oraPromise(
    async (ora) => {
      // Rate-limit calls to `npm` to be safe in case we're pulling for a lot of dependencies
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
              const res: RegistryReesponse = await body.json();
              const lastPublishTime = res.time[res["dist-tags"].latest];

              let stale = false;
              let lastPublish = "Unknown";
              if (lastPublishTime) {
                const lastPublishDiff =
                  Date.now() - Date.parse(lastPublishTime);
                lastPublish = `${ms(lastPublishDiff, { long: true })} ago`;
                stale = lastPublishDiff > options.threshold;
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
      text: `Fetching metadata for ${depMsg}`,
      failText: `Failed to fetch metadata for ${depMsg}`,
      successText: (results) =>
        `Fetched metadata for ${results.size} ${depMsg}`,
    }
  );

  for (const [path, data] of manitestData.entries()) {
    const rowData: [string, string][] = [];
    let depsMaxLength = 0;
    for (const dep of data.dependencies) {
      const result = depResults.get(dep);
      let pushed = false;
      if (result == null) {
        rowData.push([chalk.yellow(dep), chalk.yellow("Failed to fetch")]);
        pushed = true;
      } else if (result.stale) {
        rowData.push([chalk.red(dep), chalk.red(result.lastPublish)]);
        pushed = true;
      } else if (options.full) {
        rowData.push([chalk.green(dep), chalk.green(result.lastPublish)]);
        pushed = true;
      }

      if (pushed && dep.length > depsMaxLength) {
        depsMaxLength = dep.length;
      }
    }

    const table = new Table({ depsMaxLength, name: data.name, path });
    rowData.forEach((d) => {
      table.addRow(...d);
    });

    console.log(table.toString());
  }
}

yargs(hideBin(process.argv))
  .usage("Usage: $0 <path(s)> [options]")
  .example("$0 ./package.json", packageJson.description)
  .version(packageJson.version)
  .help("h")
  .alias("h", "help")
  .showHelpOnFail(false, "Specify --help for available options")
  .option("f", {
    alias: "full",
    default: false,
    describe: "Show full report (including non-stale dependencies)",
    nargs: 0,
    type: "boolean",
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
      } catch (error) {
        throw new Error("Failed to parse registry URL!");
      }
    },
    default: "https://registry.npmjs.org",
    describe: "URL of registry to check against",
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
        full: argv.f,
        registry: argv.r,
        threshold: argv.t,
      });
    }
  ).argv;
