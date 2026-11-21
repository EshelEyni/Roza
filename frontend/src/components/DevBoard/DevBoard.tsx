import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { H1 } from "../App/H1";
import { Button } from "../Buttons/Button";
import Markdown from 'react-markdown';
import { fromMarkdown } from "./fromMarkdown";
import type { DevTicket as Ticket, DevTicketDraft as Draft } from "../../../../shared/types/devBoard";
import { createDevBoardApi, desktopFiles } from "./api";
import "./devBoard.scss";

function importMessage(result: { conflicts: string[]; failed: string[] }, success = '') {
  const messages = [];
  if (result.conflicts.length) messages.push('Local edits conflict with board changes for ' + result.conflicts.join(', ') + '.');
  if (result.failed.length) messages.push('Could not import ' + result.failed.join(', ') + '.');
  return messages.join(' ') || success;
}

const editable = ['project', 'title', 'status', 'priority', 'scope', 'repository'] as const;

export function DevBoard({ account }: { account: string }) {
  const api = useMemo(() => createDevBoardApi(account), [account]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState('');
  const [importNotice, setImportNotice] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [project, setProject] = useState('');
  const [trash, setTrash] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
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
  const groups = [...new Set(visible.map((ticket) => ticket.project))].sort();
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
        {groups.map((name) => (
          <section className="group" key={name}>
            <h2>{name}<span>{visible.filter((ticket) => ticket.project === name).length}</span></h2>
            <div className="cards">
              {visible.filter((ticket) => ticket.project === name).map((ticket) => (
                <button className="ui-card card" key={ticket.id} onClick={() => { setNotice(''); setSelected(ticket.id); }}>
                  <div className="cardTop"><span className="ticketNumber">{ticket.number === null ? 'Ticket' : '#' + ticket.number}</span>{ticket.priority && <span className="priority">{ticket.priority} priority</span>}</div>
                  <h3>{ticket.title}</h3>
                  {ticket.scope && <p>{ticket.scope}</p>}
                  <div className="cardFoot"><span>{ticket.status}</span></div>
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
              {editable.map((field) => <label key={field}>{field}<input className="ui-input" required={field === 'title' || field === 'project'} value={draft[field]} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} /></label>)}
              <label>Ticket number<input className="ui-input" type="number" min="0" step="1" value={draft.number ?? ''} onChange={(event) => setDraft({ ...draft, number: event.target.value === '' ? null : Number(event.target.value) })} /></label>
            </div>
          </div>
          <footer className="modalFoot"><span role="status">{notice}</span><Button variant="primary" type="submit" disabled={busy}>Save ticket</Button></footer>
        </form> : current && <>
          <div className="modalBody">
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
            {!current.deletedAt && <button className="ui-btn ui-btn-small" disabled={busy} onClick={() => { setNotice(''); setDraft(current); }}>Edit</button>}
            <Button variant={current.deletedAt ? "primary" : "danger"} disabled={busy} onClick={() => void action(async () => { setTickets(await api.trash(current.id, !current.deletedAt)); close(); })}>{current.deletedAt ? 'Restore ticket' : 'Move to trash'}</Button>
          </footer>
        </>}
      </dialog>
    </div>
  );
}
