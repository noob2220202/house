/**
 * Pure text-editing commands behind the content editor toolbar. The editor writes the PLAIN TEXT
 * markup understood by `parseRichText` ("## 제목", "### 소제목", "- 항목", "1. 항목", bare URLs) —
 * no HTML is ever produced or stored.
 */
export interface EditState {
  value: string;
  /** Selection start / end offsets in `value`. */
  start: number;
  end: number;
}

export type BlockCommand = 'h2' | 'h3' | 'bullet' | 'ordered' | 'plain';

const PREFIX_RE = /^(#{1,3}\s+|[-•·*]\s+|\d{1,3}[.)]\s+)/;
const TESTS: Record<Exclude<BlockCommand, 'plain'>, RegExp> = {
  h2: /^#{1,2}\s+/,
  h3: /^###\s+/,
  bullet: /^[-•·*]\s+/,
  ordered: /^\d{1,3}[.)]\s+/,
};

function lineRange(state: EditState): [number, number] {
  const { value, start } = state;
  // A selection that ends right after a line break does not include the next line.
  const end = state.end > start && value[state.end - 1] === '\n' ? state.end - 1 : state.end;
  const from = value.lastIndexOf('\n', start - 1) + 1;
  const nextBreak = value.indexOf('\n', end);
  return [from, nextBreak === -1 ? value.length : nextBreak];
}

/** Block type of the line(s) under the selection — drives the pressed state of the toolbar. */
export function activeBlock(state: EditState): BlockCommand {
  const [from, to] = lineRange(state);
  const lines = state.value
    .slice(from, to)
    .split('\n')
    .filter((l) => l.trim() !== '');
  if (lines.length === 0) return 'plain';
  for (const cmd of ['h3', 'h2', 'bullet', 'ordered'] as const) {
    if (lines.every((l) => TESTS[cmd].test(l.trimStart()))) return cmd;
  }
  return 'plain';
}

/**
 * Applies a block command to every selected line. Applying the command that is already active
 * removes the markup (toggle). Blank lines inside a multi-line selection are left alone.
 */
export function applyBlock(state: EditState, command: BlockCommand): EditState {
  const [from, to] = lineRange(state);
  const lines = state.value.slice(from, to).split('\n');
  const toggleOff = command === 'plain' || activeBlock(state) === command;
  let counter = 0;
  const next = lines.map((line) => {
    const text = line.trimStart().replace(PREFIX_RE, '');
    if (toggleOff) return text;
    if (line.trim() === '' && lines.length > 1) return line;
    switch (command) {
      case 'h2':
        return `## ${text}`;
      case 'h3':
        return `### ${text}`;
      case 'bullet':
        return `- ${text}`;
      case 'ordered':
        counter += 1;
        return `${counter}. ${text}`;
    }
  });
  const replaced = next.join('\n');
  const value = state.value.slice(0, from) + replaced + state.value.slice(to);
  const collapsed = state.start === state.end;
  return {
    value,
    start: collapsed ? from + replaced.length : from,
    end: from + replaced.length,
  };
}

/** Inserts `text` at the selection (replacing it) and puts the caret after it. */
export function insertText(state: EditState, text: string): EditState {
  const value = state.value.slice(0, state.start) + text + state.value.slice(state.end);
  const caret = state.start + text.length;
  return { value, start: caret, end: caret };
}

/**
 * Inserts a link placeholder. Links are bare http(s) URLs (auto-linked by the renderer), so this
 * adds "https://" — separated from the preceding word by a space — and selects nothing.
 */
export function insertLink(state: EditState, url = 'https://'): EditState {
  const before = state.value[state.start - 1];
  const needsSpace = before !== undefined && !/\s/.test(before);
  return insertText(state, `${needsSpace ? ' ' : ''}${url}`);
}

/**
 * Enter inside a list continues it ("- " / next number); Enter on an empty list item ends the list.
 * Returns null when the default behaviour should run.
 */
export function continueList(state: EditState): EditState | null {
  if (state.start !== state.end) return null;
  const from = state.value.lastIndexOf('\n', state.start - 1) + 1;
  const line = state.value.slice(from, state.start);
  const bullet = /^([-•·*])\s+(.*)$/.exec(line);
  const ordered = bullet ? null : /^(\d{1,3})([.)])\s+(.*)$/.exec(line);
  if (!bullet && !ordered) return null;
  const content = bullet ? bullet[2] : ordered?.[3];
  if (!content?.trim()) {
    // Empty item → remove the marker instead of adding another one.
    const value = state.value.slice(0, from) + state.value.slice(state.start);
    return { value, start: from, end: from };
  }
  const marker = bullet ? `${bullet[1]} ` : `${Number(ordered?.[1]) + 1}${ordered?.[2]} `;
  return insertText(state, `\n${marker}`);
}

/** Character / line counters shown under the editor. */
export function textStats(value: string): { chars: number; lines: number } {
  return { chars: value.length, lines: value === '' ? 0 : value.split('\n').length };
}
