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
    status: field('Status') || 'Open',
    priority: field('Priority'),
    scope: field('Scope'),
    repository: field('Repository'),
  };
}
