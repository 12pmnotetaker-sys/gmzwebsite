/**
 * The three status states of the client portal, as data.
 *
 * Derived from the four brand jobs rather than invented: done is deep green on
 * the green tint, scheduled is blue on a pale blue tint, needs-you is teal on
 * an amber fill. Amber is always a fill with teal text, never amber text,
 * because amber on white is unreadable.
 *
 * Every state carries its word. A chip is never a bare colour, because a
 * colour is not a label and half these clients are reading in bright sun.
 */
export type StatusKey = 'done' | 'scheduled' | 'needs';

export interface Status {
  key: StatusKey;
  label: string;
}

export const status = {
  done: { key: 'done', label: 'Done' },
  scheduled: { key: 'scheduled', label: 'Scheduled' },
  needs: { key: 'needs', label: 'Needs you' },
} as const satisfies Record<StatusKey, Status>;
