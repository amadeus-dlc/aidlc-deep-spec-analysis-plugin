/**
 * ドメイン型自身が定める等価関係。反射律・対称律・推移律を満たす。
 *
 * `hashCode` は `equals` と対で実装する（オーナー裁定 2026-09-07、Java と同じ契約）。
 * 等しい 2 値は必ず等しいハッシュを返す。逆は成り立たない——衝突は許される。
 * 等価判定が見る値と、ハッシュが畳み込む値は同じでなければならない。
 */
export interface Equatable<E> {
  equals(other: E): boolean;
  hashCode(): number;
}
