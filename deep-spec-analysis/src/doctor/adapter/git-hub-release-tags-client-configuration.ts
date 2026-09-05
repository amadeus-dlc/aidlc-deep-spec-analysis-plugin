export interface GitHubReleaseTagsClientConfiguration {
  readonly repository: string;
  readonly fetcher?: (input: string, init?: RequestInit) => Promise<Response>;
  readonly timeoutMs?: number;
}
