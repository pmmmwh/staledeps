export type Options = {
  readonly dateFormat: "absolute" | "relative";
  readonly full: boolean;
  readonly output: "json" | "table";
  readonly registry: URL;
  readonly sort: "name" | "lastPublish";
  readonly threshold: number;
};

export type ManifestData = {
  readonly dependencies: string[];
  readonly name?: string;
};

export type ManifestOutputData = {
  readonly dependencies: ReadonlyArray<
    readonly [name: string, lastPublish: string | null, stale: boolean | null]
  >;
  readonly name?: string;
};

export type DependencyResult = {
  readonly lastPublish: number | undefined;
  readonly stale: boolean;
};
