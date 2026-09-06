/** 空を許すコレクションの空判定。診断や演算の結果が空かとは区別する。 */
export interface FirstClassCollection {
  isEmpty(): boolean;
}
