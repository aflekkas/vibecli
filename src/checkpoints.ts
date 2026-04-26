export type Checkpoint<T> = {
  id: string;
  label?: string;
  createdAt: number;
  value: T;
};

export type CheckpointHistoryOptions<T> = {
  limit?: number;
  clone?: (value: T) => T;
  createId?: () => string;
  now?: () => number;
};

function defaultClone<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (typeof structuredClone !== "function") return value;
  try {
    return structuredClone(value);
  } catch {
    return value;
  }
}

export class CheckpointHistory<T> {
  private past: Checkpoint<T>[] = [];
  private present: Checkpoint<T>;
  private future: Checkpoint<T>[] = [];
  private readonly limit: number;
  private readonly clone: (value: T) => T;
  private readonly createId: () => string;
  private readonly now: () => number;

  constructor(initialValue: T, opts: CheckpointHistoryOptions<T> = {}) {
    this.limit = opts.limit ?? 100;
    this.clone = opts.clone ?? defaultClone;
    this.createId = opts.createId ?? (() => crypto.randomUUID());
    this.now = opts.now ?? (() => Date.now());
    this.present = this.createCheckpoint(initialValue);
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  current(): Checkpoint<T> {
    return this.snapshot(this.present);
  }

  undo(): Checkpoint<T> | null {
    const previous = this.past.pop();
    if (!previous) return null;
    this.future.unshift(this.present);
    this.present = previous;
    return this.current();
  }

  redo(): Checkpoint<T> | null {
    const next = this.future.shift();
    if (!next) return null;
    this.past.push(this.present);
    this.present = next;
    return this.current();
  }

  checkpoint(value: T, label?: string): Checkpoint<T> {
    this.past.push(this.present);
    if (this.past.length > this.limit) this.past.shift();
    this.present = this.createCheckpoint(value, label);
    this.future = [];
    return this.current();
  }

  replace(value: T, label?: string): Checkpoint<T> {
    this.present = this.createCheckpoint(value, label);
    return this.current();
  }

  clear(value?: T, label?: string): Checkpoint<T> {
    this.past = [];
    this.future = [];
    this.present = this.createCheckpoint(value ?? this.present.value, label);
    return this.current();
  }

  history(): { past: Checkpoint<T>[]; current: Checkpoint<T>; future: Checkpoint<T>[] } {
    return {
      past: this.past.map((entry) => this.snapshot(entry)),
      current: this.current(),
      future: this.future.map((entry) => this.snapshot(entry)),
    };
  }

  private createCheckpoint(value: T, label?: string): Checkpoint<T> {
    return {
      id: this.createId(),
      label,
      createdAt: this.now(),
      value: this.clone(value),
    };
  }

  private snapshot(entry: Checkpoint<T>): Checkpoint<T> {
    return {
      ...entry,
      value: this.clone(entry.value),
    };
  }
}

export function createCheckpointHistory<T>(
  initialValue: T,
  opts?: CheckpointHistoryOptions<T>,
): CheckpointHistory<T> {
  return new CheckpointHistory(initialValue, opts);
}
