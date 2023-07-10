import chalk from "chalk";

import { toAgo, toISOString } from "./helpers.js";
import Table from "./table.js";
import type { ManifestOutputData } from "./types/commons.js";

function jsonOutput(raw: Map<string, ManifestOutputData>) {
  const output: Record<string, Record<string, string | null>> = {};
  for (const [path, data] of raw.entries()) {
    output[data.name ?? path] = Object.fromEntries(
      data.dependencies.map(([name, lastPublish, latestVersion, stale]) => {
        return [
          name,
          lastPublish != null ? toISOString(lastPublish) : null,
          latestVersion,
          stale,
        ];
      })
    );
  }

  console.log(JSON.stringify(output, null, 2));
}

function tableOutput(raw: Map<string, ManifestOutputData>, now: number) {
  for (const [path, data] of raw.entries()) {
    const rowData: [string, string, string][] = [];
    let depsMaxLength = 0;
    for (const [name, lastPublish, latestVersion, stale] of data.dependencies) {
      let pushed = false;
      if (lastPublish == null) {
        rowData.push([
          chalk.yellow(name),
          chalk.yellow("Failed to fetch"),
          chalk.yellow("Failed to fetch"),
        ]);
        pushed = true;
      } else {
        const color = stale ? chalk.red : chalk.green;
        rowData.push([
          color(name),
          color(toAgo(lastPublish, now)),
          color(latestVersion),
        ]);
        pushed = true;
      }

      if (pushed && name.length > depsMaxLength) {
        depsMaxLength = name.length;
      }
    }

    const table = new Table({ depsMaxLength, name: data.name, path });
    rowData.forEach((d) => {
      table.addRow(...d);
    });

    console.log(table.toString());
  }
}

export const outputs = {
  json: jsonOutput,
  table: tableOutput,
} as const;
