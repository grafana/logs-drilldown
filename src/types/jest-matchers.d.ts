export {};

declare global {
  namespace jest {
    interface Matchers<R> {
      toEmitValues<E>(expected: E[]): R;
      /**
       * Collect all the values emitted by the observables (also errors) and pass them to the expectations functions after
       * the observable ended (or emitted error). If Observable does not complete within OBSERVABLE_TEST_TIMEOUT_IN_MS the
       * test fails.
       */
      toEmitValuesWith<E>(expectations: (received: E[]) => void): R;
    }
  }
}
