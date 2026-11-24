/** Latest-value debounce. UI/local persistence stay immediate; requests are serialized. */
export function createDebouncedSync<T>(
  send: (value: T) => Promise<void>,
  delay = 700,
  clock = { setTimeout, clearTimeout },
) {
  let pending: { value: T } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | undefined;

  function stopTimer() {
    if (timer !== undefined) clock.clearTimeout(timer);
    timer = undefined;
  }

  function schedule() {
    stopTimer();
    timer = clock.setTimeout(() => {
      timer = undefined;
      // Keep failed changes for the next edit or explicit flush, without a retry loop.
      void run().catch(() => {});
    }, delay);
  }

  function run(): Promise<void> {
    if (inFlight) return inFlight;
    if (!pending) return Promise.resolve();
    const batch = pending;
    pending = undefined;
    inFlight = Promise.resolve().then(() => send(batch.value)).then(
      () => {
        inFlight = undefined;
        if (pending) schedule();
      },
      (error: unknown) => {
        inFlight = undefined;
        // A newer full snapshot always wins over the failed older snapshot.
        pending ??= batch;
        stopTimer();
        throw error;
      },
    );
    return inFlight;
  }

  return {
    enqueue(value: T) {
      pending = { value };
      schedule();
    },
    async flush() {
      stopTimer();
      while (pending || inFlight) {
        await run();
        stopTimer();
      }
    },
  };
}
