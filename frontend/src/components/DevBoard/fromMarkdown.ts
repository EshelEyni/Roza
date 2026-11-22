import type { DevTicketDraft } from "../../../../shared/types/devBoard";

export function fromMarkdown(markdown: string): DevTicketDraft {
  const header = markdown.match(/^#\s+(.+?)\s+[—–-]\s+Ticket\s+#(\d+)\s*$/im);
  const number = header ? Number(header[2]) : null;
  const field = (name: string) => {
    const match = markdown.match(new RegExp('^\\*\\*' + name + ':\\*\\*[ \\t]*(.*)$', 'im'));
    return match?.[1].trim().replace(/^`(.*)`$/, '$1') ?? '';
  };
  return {
    markdown,
    number: Number.isSafeInteger(number) ? number : null,
    project: header?.[1].trim() || 'General',
    title: markdown.match(/^##[ \t]+(.+)$/m)?.[1].trim()
      || (!header && markdown.match(/^#[ \t]+(.+)$/m)?.[1].trim()) || '',
    status: normalizeStatus(field('Status')),
    priority: normalizePriority(field('Priority')),
    scope: field('Scope'),
    repository: field('Repository'),
  };
}

export const statuses = ['To do', 'WIP', 'Done'];
export const priorities = ['Low', 'Medium', 'High'];

// Older tickets use free text ("Open", "In progress", "Critical"). Map them to the fixed choices.
export function normalizeStatus(value: string) {
  const text = value.trim().toLowerCase();
  if (/^(done|closed|complete|completed|resolved|fixed|shipped)\b/.test(text)) return 'Done';
  if (/^(wip|in[ -]?progress|doing|started|active|review|in review)\b/.test(text)) return 'WIP';
  return 'To do';
}

export function normalizePriority(value: string) {
  const text = value.trim().toLowerCase();
  if (/^(high|critical|urgent|p0|p1)\b/.test(text)) return 'High';
  if (/^(low|minor|p3|p4)\b/.test(text)) return 'Low';
  return 'Medium';
}

export function normalizeDraft(draft: DevTicketDraft): DevTicketDraft {
  return { ...draft, status: normalizeStatus(draft.status), priority: normalizePriority(draft.priority) };
}
