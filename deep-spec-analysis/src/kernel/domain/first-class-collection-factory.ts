/** static側の契約。各ファクトリの具体的な引数型を型検査で照合する。 */
export interface FirstClassCollectionFactory<Arguments extends readonly unknown[], Collection extends object> {
  of(...args: Arguments): Collection;
}
