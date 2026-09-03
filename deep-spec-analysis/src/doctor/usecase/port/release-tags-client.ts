import type { ReleaseTagsRead } from "./release-tags-read.ts";

// 公開 release tag の外部取得ポート。ネットワーク不達は例外ではなく、doctor
// が pass=true の skip 行へ写像できる値として返す。
export interface ReleaseTagsClient {
  list(): Promise<ReleaseTagsRead>;
}
