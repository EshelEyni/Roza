import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { H1 } from "../App/H1";
import { Button } from "../Buttons/Button";
import Markdown from 'react-markdown';
import { fromMarkdown, normalizeDraft, normalizePriority, normalizeStatus, priorities, statuses } from "./fromMarkdown";
import { ReaderSelect } from "../Reader/ReaderSelect";
import type { DevTicket as Ticket, DevTicketDraft as Draft } from "../../../../shared/types/devBoard";
import { createDevBoardApi, desktopFiles } from "./api";
import { useConfirmation } from "../Modals/useConfirmation";
import "./devBoard.scss";

function importMessage(result: { conflicts: string[]; failed: string[] }, success = '') {
  const messages = [];
  if (result.conflicts.length) messages.push('Local edits conflict with board changes for ' + result.conflicts.join(', ') + '.');
  if (result.failed.length) messages.push('Could not import ' + result.failed.join(', ') + '.');
  return messages.join(' ') || success;
}

const textFields = ['scope', 'repository'] as const;
const newProject = '\u0000new-project';
const choices = (values: string[]) => values.map((value) => ({ value, label: value }));
type GroupBy = 'none' | 'project' | 'status' | 'priority';
const groupOptions: { value: GroupBy; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'project', label: 'Project' },
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
];
const groupKey = (ticket: Ticket, by: Exclude<GroupBy, 'none'>) =>
  by === 'status' ? normalizeStatus(ticket.status) : by === 'priority' ? normalizePriority(ticket.priority) : ticket.project;
const groupOrder: Record<Exclude<GroupBy, 'none'>, string[]> = { project: [], status: statuses, priority: [...priorities].reverse() };

function groupTickets(tickets: Ticket[], by: GroupBy): [string | null, Ticket[]][] {
  if (!tickets.length) return [];
  if (by === 'none') return [[null, tickets]];

  const groups = new Map<string, Ticket[]>();
  for (const ticket of tickets) {
    const key = groupKey(ticket, by);
    const group = groups.get(key);
    if (group) group.push(ticket);
    else groups.set(key, [ticket]);
  }
  const order = groupOrder[by];
  return [...groups].sort(([a], [b]) => order.length ? order.indexOf(a) - order.indexOf(b) : a.localeCompare(b));
}

type SortBy = 'default' | 'id' | 'date';
const sortOptions: { value: SortBy; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'id', label: 'Ticket ID' },
  { value: 'date', label: 'Date' },
];
type SortDirection = 'asc' | 'desc';
const directionOptions: { value: SortDirection; label: string }[] = [
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
];
const ticketIdOrder = new Intl.Collator(undefined, { numeric: true });

function compareTicketIds(a: Ticket, b: Ticket, direction = 1) {
  const unnumberedLast = Number(a.number === null) - Number(b.number === null);
  return unnumberedLast || direction * (
    (a.number ?? 0) - (b.number ?? 0) || ticketIdOrder.compare(a.id, b.id)
  );
}

function compareTicketDates(a: Ticket, b: Ticket, direction: number) {
  // Creation dates are ISO UTC strings. Empty dates follow dated tickets.
  const undatedLast = Number(!a.createdAt) - Number(!b.createdAt);
  return undatedLast || direction * (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || compareTicketIds(a, b);
}

export function DevBoard({ account }: { account: string }) {
  const api = useMemo(() => createDevBoardApi(account), [account]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState('');
  const [importNotice, setImportNotice] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [project, setProject] = useState('');
  const [trash, setTrash] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>('project');
  const [sortBy, setSortBy] = useState<SortBy>('default');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [addingProject, setAddingProject] = useState(false);
  const { confirm, confirmationDialog } = useConfirmation();
  const dialog = useRef<HTMLDialogElement>(null);
  const loading = useRef(false);
  const writing = useRef(false);
  const current = tickets.find((ticket) => ticket.id === selected);
  const modalOpen = !!(draft || current);

  useEffect(() => {
    let active = true;
    async function refresh() {
      if (loading.current || writing.current) return;
      loading.current = true;
      try {
        const next = await api.read();
        if (writing.current) return;
        if (active) {
          setTickets(next);
          setError('');
        }
      } catch (problem) {
        if (active) setError(String(problem));
      } finally {
        loading.current = false;
      }
    }
    async function sync() {
      if (writing.current) return;
      try {
        const result = await api.importChanges();
        if (active && result) setImportNotice(importMessage(result));
      } catch (problem) {
        if (active) setImportNotice(String(problem));
      }
      if (active) await refresh();
    }
    void sync();
    const timer = window.setInterval(sync, 2500);
    window.addEventListener('focus', refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [api]);

  useEffect(() => {
    const element = dialog.current!;
    if (modalOpen && !element.open) element.showModal();
    if (!modalOpen && element.open) element.close();
  }, [modalOpen]);

  function close() {
    setSelected(null);
    setDraft(null);
    setAddingProject(false);
    setNotice('');
  }

  async function action(run: () => Promise<void>) {
    writing.current = true;
    setBusy(true);
    setNotice('');
    try {
      await run();
    } catch (problem) {
      setNotice(String(problem));
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }

  function updateMetadata(ticket: Ticket, field: 'status' | 'priority', value: string) {
    if (writing.current || ticket[field] === value) return;
    void action(async () => {
      setTickets(await api.updateMetadata(ticket.id, field, value));
      setNotice(field === 'status' ? 'Status saved.' : 'Priority saved.');
    });
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    void action(async () => {
      setTickets(await api.save(draft));
      if (!draft.id) {
        setTrash(false);
        setProject('');
        setQuery('');
      }
      close();
    });
  }

  const active = tickets.filter((ticket) => !ticket.deletedAt);
  const archived = tickets.filter((ticket) => ticket.deletedAt);
  const projects = [...new Set(active.map((ticket) => ticket.project))].sort();
  const visible = (trash ? archived : active).filter((ticket) => {
    const matchesProject = trash || !project || !projects.includes(project) || project === ticket.project;
    const searchText = [ticket.number, ticket.title, ticket.project, ticket.status, ticket.priority, ticket.scope, ticket.repository, ticket.markdown].join(' ');
    return matchesProject && searchText.toLowerCase().includes(query.trim().toLowerCase().replace(/^#(?=\d)/, ''));
  });
  if (sortBy !== 'default') {
    const direction = sortDirection === 'asc' ? 1 : -1;
    const compare = sortBy === 'id' ? compareTicketIds : compareTicketDates;
    visible.sort((a, b) => compare(a, b, direction));
  }
  const groups = groupTickets(visible, groupBy);
  const heading = trash ? 'Trash' : projects.includes(project) ? project : 'All tickets';

  return (
    <div className="roza-dev-board" dir="ltr">
      <aside>
        <nav aria-label="Ticket views">
          <button className={"ui-btn ui-btn-ghost " + (!trash && !projects.includes(project) ? 'chosen' : '')} onClick={() => { setTrash(false); setProject(''); }}>All tickets <span>{active.length}</span></button>
          <h2>Projects</h2>
          {projects.map((name) => <button key={name} className={'ui-btn ui-btn-ghost ' + (!trash && project === name ? 'chosen' : '')} onClick={() => { setTrash(false); setProject(name); }}>{name} <span>{active.filter((ticket) => ticket.project === name).length}</span></button>)}
          <button className={"ui-btn ui-btn-ghost " + (trash ? 'chosen trash' : 'trash')} onClick={() => setTrash(true)}>Trash <span>{archived.length}</span></button>
        </nav>
      </aside>
      <main>
        <header className="boardHead">
          <div><H1>{heading}</H1><p>{visible.length} {visible.length === 1 ? 'ticket' : 'tickets'}</p></div>
          <Button variant="primary" onClick={() => { setNotice(''); setDraft(fromMarkdown('')); }}>New ticket</Button>
        </header>
        <div className="toolbar">
          <input className="ui-input" type="search" aria-label="Search tickets" placeholder="Search tickets…" value={query} onChange={(event) => setQuery(event.target.value)} />
          <div className="toolbarField">
            <span id="group-by-label">Group by</span>
            <ReaderSelect id="group-by" labelId="group-by-label" value={groupBy} options={groupOptions} onChange={setGroupBy} />
          </div>
          <div className="toolbarField">
            <span id="sort-by-label">Sort by</span>
            <ReaderSelect id="sort-by" labelId="sort-by-label" value={sortBy} options={sortOptions} onChange={setSortBy} />
          </div>
          {sortBy !== 'default' && <div className="toolbarField">
            <span id="sort-direction-label">Direction</span>
            <ReaderSelect id="sort-direction" labelId="sort-direction-label" value={sortDirection} options={directionOptions} onChange={setSortDirection} />
          </div>}
          {desktopFiles && <Button isSmall disabled={busy} onClick={() => void action(async () => {
            try {
              if (!await api.chooseImport()) return;
              const result = await api.importChanges();
              setTickets(await api.read());
              if (result) setImportNotice(importMessage(result, 'Import complete.'));
            } catch (problem) { setImportNotice(String(problem)); }
          })}>Import ticket folder</Button>}
        </div>
        {importNotice && <p role="status">{importNotice}</p>}
        {error && <p className="alert" role="alert">{error}</p>}
        {!error && !visible.length && <p className="empty">{query.trim() ? 'No tickets match your search.' : trash ? 'Trash is empty.' : 'Paste a ticket to get started.'}</p>}
        {groups.map(([name, group]) => (
          <section className={name === null ? undefined : 'group'} key={name ?? 'ungrouped'}>
            {name !== null && <h2>{name}<span>{group.length}</span></h2>}
            <div className="cards">
              {group.map((ticket) => (
                <button className="ui-card card" key={ticket.id} onClick={() => { setNotice(''); setSelected(ticket.id); }}>
                  <div className="cardTop"><span className="ticketNumber">{ticket.number === null ? 'Ticket' : '#' + ticket.number}</span><span className="priority">{normalizePriority(ticket.priority)} priority</span></div>
                  <h3>{ticket.title}</h3>
                  {ticket.scope && <p>{ticket.scope}</p>}
                  <div className="cardFoot"><span>{normalizeStatus(ticket.status)}</span></div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </main>
      <dialog ref={dialog} onCancel={(event) => { event.preventDefault(); if (!busy) close(); }} aria-labelledby="modal-title">
        <header className="modalHead">
          <div>
            {current && <div className="ticketNumber">{current.project}{current.number !== null && ' / #' + current.number}</div>}
            <h2 id="modal-title">{draft ? (draft.id ? 'Edit ticket' : 'New ticket') : current?.title}</h2>
          </div>
          <button className="ui-btn ui-btn-ghost close" aria-label="Close ticket" disabled={busy} onClick={close}>×</button>
        </header>
        {draft ? <form onSubmit={save}>
          <div className="modalBody">
            <div className="sourceHead">
              <label htmlFor="markdown">Ticket Markdown</label>
              <button className="ui-btn ui-btn-small" disabled={busy} type="button" onClick={() => void action(async () => {
                const text = await api.paste();
                if (!text) { setNotice('Your clipboard is empty.'); return; }
                setDraft({ ...fromMarkdown(text), id: draft.id });
              })}>Paste from clipboard</button>
              <button className="ui-btn ui-btn-small" disabled={busy} type="button" onClick={() => setDraft({ ...fromMarkdown(draft.markdown), id: draft.id })}>Read ticket fields</button>
            </div>
            <textarea className="ui-input" id="markdown" required value={draft.markdown} placeholder="Paste the full ticket here…" onChange={(event) => {
              const markdown = event.target.value;
              setDraft(draft.id ? { ...draft, markdown } : fromMarkdown(markdown));
            }} />
            <div className="fields">
              <div className="field">
                <span id="field-project">Project</span>
                <ReaderSelect id="ticket-project" labelId="field-project"
                  value={addingProject ? newProject : draft.project}
                  options={[...choices([...new Set([...projects, draft.project].filter((name) => name.trim()))].sort()), { value: newProject, label: 'New project…' }]}
                  onChange={(value) => {
                    if (value === newProject) { setAddingProject(true); setDraft({ ...draft, project: '' }); }
                    else { setAddingProject(false); setDraft({ ...draft, project: value }); }
                  }} />
                {addingProject && <input className="ui-input" aria-label="New project name" placeholder="New project name" required autoFocus value={draft.project} onChange={(event) => setDraft({ ...draft, project: event.target.value })} />}
              </div>
              <label>Title<input className="ui-input" required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
              <div className="field">
                <span id="field-status">Status</span>
                <ReaderSelect id="ticket-status" labelId="field-status" value={draft.status} options={choices(statuses)} onChange={(status) => setDraft({ ...draft, status })} />
              </div>
              <div className="field">
                <span id="field-priority">Priority</span>
                <ReaderSelect id="ticket-priority" labelId="field-priority" value={draft.priority} options={choices(priorities)} onChange={(priority) => setDraft({ ...draft, priority })} />
              </div>
              {textFields.map((field) => <label key={field}>{field}<input className="ui-input" value={draft[field]} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} /></label>)}
              <label>Ticket number<input className="ui-input" type="number" min="0" step="1" value={draft.number ?? ''} onChange={(event) => setDraft({ ...draft, number: event.target.value === '' ? null : Number(event.target.value) })} /></label>
            </div>
          </div>
          <footer className="modalFoot"><span role="status">{notice}</span><Button variant="primary" type="submit" disabled={busy}>Save ticket</Button></footer>
        </form> : current && <>
          <div className="modalBody">
            {!current.deletedAt && <fieldset className="fields ticketMetadata" disabled={busy} aria-label="Ticket status and priority">
              <div className="field">
                <span id="detail-status-label">Status</span>
                <ReaderSelect id="detail-status" labelId="detail-status-label" value={normalizeStatus(current.status)}
                  options={choices(statuses)} onChange={(value) => updateMetadata(current, 'status', value)} />
              </div>
              <div className="field">
                <span id="detail-priority-label">Priority</span>
                <ReaderSelect id="detail-priority" labelId="detail-priority-label" value={normalizePriority(current.priority)}
                  options={choices(priorities)} onChange={(value) => updateMetadata(current, 'priority', value)} />
              </div>
            </fieldset>}
            <section className="attachments" aria-labelledby="attachments-title">
              <div className="sourceHead">
                <h3 id="attachments-title">Attachments</h3>
                {desktopFiles && !current.deletedAt && <button className="ui-btn ui-btn-small" disabled={busy} onClick={() => void action(async () => {
                  const result = await api.addAttachments(current.id);
                  if (!result) return;
                  setTickets(result.tickets);
                  const summary = result.saved ? 'Attached ' + result.saved + (result.saved === 1 ? ' file.' : ' files.') : '';
                  setNotice([summary, result.failures.length ? 'Could not copy ' + result.failures.join(', ') : ''].filter(Boolean).join(' '));
                })}>Add files</button>}
                {desktopFiles && current.attachments.length > 0 && <button className="ui-btn ui-btn-small" disabled={busy} onClick={() => void action(() => api.openAttachments(current))}>Open folder</button>}
              </div>
              {current.attachments.length > 0
                ? <ul>{current.attachments.map((filename) => <li key={filename}>
                    <span>{filename}</span>
                    {desktopFiles && <button className="ui-btn ui-btn-small" disabled={busy} aria-label={'Show ' + filename + ' in File Explorer'} onClick={() => void action(() => api.openAttachments(current, filename))}>Show in Explorer</button>}
                  </li>)}</ul>
                : <p>No files attached.</p>}
            </section>
            <article className="markdown"><Markdown components={{ a: ({ children }) => <span>{children}</span>, img: ({ alt }) => <span>{alt}</span> }}>{current.markdown}</Markdown></article>
          </div>
          <footer className="modalFoot">
            <span role="status">{notice}</span>
            <button className="ui-btn ui-btn-small" disabled={busy} onClick={() => void action(async () => { await api.copy(current.markdown); setNotice('Markdown copied'); })}>Copy Markdown</button>
            {!current.deletedAt && <button className="ui-btn ui-btn-small" disabled={busy} onClick={() => { setNotice(''); setDraft(normalizeDraft(current)); }}>Edit</button>}
            {current.deletedAt && <Button variant="danger" disabled={busy} onClick={() => void action(async () => {
              const confirmed = await confirm({
                title: 'Delete ticket forever?',
                message: `"${current.title}" and its ${current.attachments.length === 1 ? 'attachment' : 'attachments'} will be permanently deleted. This cannot be undone.`,
                confirmLabel: 'Delete forever',
              });
              if (!confirmed) return;
              setTickets(await api.deleteForever(current.id));
              close();
            })}>Delete forever</Button>}
            <Button variant={current.deletedAt ? "primary" : "danger"} disabled={busy} onClick={() => void action(async () => { setTickets(await api.trash(current.id, !current.deletedAt)); close(); })}>{current.deletedAt ? 'Restore ticket' : 'Move to trash'}</Button>
          </footer>
        </>}
      </dialog>
      {confirmationDialog}
    </div>
  );
}
