export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}
