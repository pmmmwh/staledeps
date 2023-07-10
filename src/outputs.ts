import chalk from "chalk";

import Table from "./table.js";
import type { ManifestOutputData } from "./types/commons.js";

function jsonOutput(raw: Map<string, ManifestOutputData>) {
  const output: Record<string, Record<string, string | null>> = {};
  for (const [path, data] of raw.entries()) {
    output[data.name ?? path] = Object.fromEntries(data.dependencies);
  }

  console.log(JSON.stringify(output, null, 2));
}

function tableOutput(raw: Map<string, ManifestOutputData>) {
  for (const [path, data] of raw.entries()) {
    const rowData: [string, string][] = [];
    let depsMaxLength = 0;
    for (const [name, lastPublish, stale] of data.dependencies) {
      let pushed = false;
      if (lastPublish == null) {
        rowData.push([chalk.yellow(name), chalk.yellow("Failed to fetch")]);
        pushed = true;
      } else {
        const color = stale ? chalk.red : chalk.green;
        rowData.push([color(name), color(lastPublish)]);
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
