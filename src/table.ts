import { createRequire } from "node:module";

import chalk from "chalk";
import type { UI } from "cliui";

// FIXME: Swap to ESM imports
//  `cliui` have issues with ANSI formatting running in ESM
//  Ref: https://github.com/yargs/cliui/issues/113
const require = createRequire(import.meta.url);
const cliui = require("cliui");

const maxLengthLastPublish = 24;

type Options = {
  depsMaxLength: number;
  path: string;

  name?: string;
};

export default class UITable {
  private _ui: UI;

  private _depsMaxLength: number;
  private _name: string;
  private _path: string;

  constructor(options: Options) {
    this._ui = cliui({});

    this._depsMaxLength =
      options.depsMaxLength === 0 ? 6 : Math.max(options.depsMaxLength, 4);
    this._name = options.name ?? "unknown";
    this._path = options.path;

    this._ui.div({
      padding: [1, 1, 0, 1],
      text: chalk.cyan.bold(`Report for ${this._name} (${this._path})`),
    });
    this._ui.div(
      this.toRowColumn(chalk.bold("Name"), this._depsMaxLength),
      this.toRowColumn(chalk.bold("Last Publish"), maxLengthLastPublish)
    );
  }

  private toRowColumn(text: string, width?: number) {
    return {
      padding: [0, 1, 0, 1],
      text,
      ...(width && { width: width + 2 }),
    };
  }

  addRow(dep: string, lastUpdate: string): void {
    this._ui.div(
      this.toRowColumn(dep, this._depsMaxLength),
      this.toRowColumn(lastUpdate, maxLengthLastPublish)
    );
  }

  resetOutput(): void {
    return this._ui.resetOutput();
  }

  toString(): string {
    return this._ui.toString();
  }
}
