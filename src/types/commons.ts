export type Options = {
  readonly full: boolean;
  readonly output: "json" | "table";
  readonly registry: URL;
  readonly sort: "name" | "lastPublish";
  readonly sortDir: "asc" | "desc";
  readonly threshold: number;
};

export type ManifestData = {
  readonly dependencies: string[];
  readonly name?: string;
};

export type ManifestOutputData = {
  readonly dependencies: ReadonlyArray<
    readonly [
      name: string,
      lastPublish: number | null,
      latestVersion: string | null,
      stale: boolean | null,
    ]
  >;
  readonly name?: string;
};

export type DependencyResult = {
  readonly lastPublish: number | undefined;
  readonly latestVersion: string;
  readonly stale: boolean;
};
