export interface Options {
  readonly full: boolean;
  readonly output: "json" | "table";
  readonly registry: URL;
  readonly sort: "name" | "lastPublish";
  readonly sortDir: "asc" | "desc";
  readonly threshold: number;
}

export interface ManifestData {
  readonly dependencies: string[];
  readonly name?: string;
}

export interface ManifestOutputData {
  readonly dependencies: readonly (readonly [
    name: string,
    lastPublish: number | null,
    latestVersion: string | null,
    stale: boolean | null,
  ])[];
  readonly name?: string;
}

export interface DependencyResult {
  readonly lastPublish: number | undefined;
  readonly latestVersion: string;
  readonly stale: boolean;
}
