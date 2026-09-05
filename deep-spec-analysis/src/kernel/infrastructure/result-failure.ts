export interface ResultFailure<E> {
  readonly ok: false;
  readonly error: E;
}
