import type { ReleaseTagsClient, ReleaseTagsRead } from "@deep-spec/doctor-usecase";
import type { GitHubReleaseTagsClientConfiguration } from "./git-hub-release-tags-client-configuration.ts";

export class GitHubReleaseTagsClientImplementation implements ReleaseTagsClient {
  readonly #repository: string;
  readonly #fetcher: (input: string, init?: RequestInit) => Promise<Response>;
  readonly #timeoutMs: number;

  constructor(config: GitHubReleaseTagsClientConfiguration) {
    this.#repository = config.repository;
    this.#fetcher = config.fetcher ?? globalThis.fetch;
    this.#timeoutMs = config.timeoutMs ?? 5_000;
  }

  async list(): Promise<ReleaseTagsRead> {
    const tags: string[] = [];
    try {
      for (let page = 1; page <= 100; page++) {
        const response = await this.#fetcher(
          `https://api.github.com/repos/${this.#repository}/tags?per_page=100&page=${page}`,
          {
            headers: { Accept: "application/vnd.github+json", "User-Agent": "deep-spec-analysis-doctor" },
            signal: AbortSignal.timeout(this.#timeoutMs),
          },
        );
        if (!response.ok) return { kind: "unavailable", reason: `GitHub tags API returned HTTP ${response.status}` };
        const body = await response.json() as unknown;
        if (!Array.isArray(body)) return { kind: "unavailable", reason: "GitHub tags API returned an invalid document" };
        for (const entry of body) {
          if (entry && typeof entry === "object" && typeof (entry as { name?: unknown }).name === "string") {
            tags.push((entry as { name: string }).name);
          }
        }
        if (body.length < 100) return { kind: "available", tags };
      }
      return { kind: "unavailable", reason: "GitHub tags API pagination limit was exceeded" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { kind: "unavailable", reason: message.replace(/[\r\n]+/g, " ") || "network request failed" };
    }
  }
}
