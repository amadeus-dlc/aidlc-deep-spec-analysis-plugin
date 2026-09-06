/** ドメイン型自身が定める等価関係。反射律・対称律・推移律を満たす。 */
export interface Equatable<E> {
  equals(other: E): boolean;
}
