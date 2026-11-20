// Undo / redo as plain data: a list of earlier states and a list of undone states. Pure, so it is easy to test.
export type History<T> = { past: T[]; future: T[] };
export const MAX_HISTORY = 100;

export const emptyHistory = <T,>(): History<T> => ({ past: [], future: [] });

/** A new change was made: remember the state from before it. Redo is no longer possible. */
export function commit<T>(h: History<T>, previous: T): History<T> {
  const past = [...h.past, previous];
  return { past: past.length > MAX_HISTORY ? past.slice(past.length - MAX_HISTORY) : past, future: [] };
}
/** Go back one step. `present` is the state being left (it becomes redo-able). Null when there is nothing to undo. */
export function undo<T>(h: History<T>, present: T): { history: History<T>; value: T } | null {
  if (h.past.length === 0) return null;
  return { value: h.past[h.past.length - 1], history: { past: h.past.slice(0, -1), future: [present, ...h.future] } };
}
export function redo<T>(h: History<T>, present: T): { history: History<T>; value: T } | null {
  if (h.future.length === 0) return null;
  return { value: h.future[0], history: { past: [...h.past, present], future: h.future.slice(1) } };
}
