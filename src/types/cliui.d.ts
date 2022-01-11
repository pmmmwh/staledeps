// Types for cliui@7.0.4
// Extracted from: https://deno.land/x/cliui@v7.0.4-deno/build/index.cjs.d.ts
declare module "cliui" {
  interface Column {
    padding: number[];
    text: string;

    align?: "left" | "center" | "right";
    border?: boolean;
    width?: number;
  }

  interface ColumnArray extends Array<Column> {
    span: boolean;
  }

  interface Line {
    text: string;

    hidden?: boolean;
    span?: boolean;
  }

  export interface UIOptions {
    width: number;

    rows?: string[];
    wrap?: boolean;
  }

  class UI {
    rows: ColumnArray[];
    width: number;
    wrap: boolean;

    constructor(opts: UIOptions);

    div(...args: (Column | string)[]): ColumnArray;
    span(...args: (Column | string)[]): void;

    resetOutput(): void;
    rowToString(row: ColumnArray, lines: Line[]): Line[];
    toString(): string;
  }

  export default function ui(opts: Partial<Record<string, unknown>>): UI;
}
