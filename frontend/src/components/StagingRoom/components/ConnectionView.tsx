import { useState } from "react";
import type { ConnectionInfo } from "../../../../../shared/types/stagingRoom";

export function ConnectionView({
  connection,
  onTest,
}: {
  connection?: ConnectionInfo;
  onTest: () => Promise<{ ok: boolean; message: string }>;
}) {
  const [result, setResult] = useState<{ ok: boolean; message: string }>();
  const [testing, setTesting] = useState(false);

  const test = async () => {
    setTesting(true);
    try {
      setResult(await onTest());
    } finally {
      setTesting(false);
    }
  };

  return (
    <main className="main single">
      <div className="book">
        <section className="book-head">
          <div>
            <div className="eyebrow">Database</div>
            <h1>Connection</h1>
          </div>
          <div className="actions">
            <button className="btn-primary" onClick={test} disabled={testing || !connection?.configured}>
              {testing ? "Testing…" : "Test connection"}
            </button>
          </div>
        </section>

        {connection?.configured ? (
          <section className="panel">
            <dl className="kv">
              <dt>Database</dt>
              <dd>{connection.dbName}</dd>
              <dt>Host</dt>
              <dd>{connection.host}</dd>
              <dt>Settings from</dt>
              <dd>
                <code>{connection.source}</code>
              </dd>
            </dl>
          </section>
        ) : (
          <div className="callout danger">{connection?.error || "Loading…"}</div>
        )}

        {result && <div className={`callout ${result.ok ? "ok" : "danger"}`}>{result.message}</div>}

        <section className="panel prose">
          <h2>How it connects</h2>
          <p>
            The ROZA API stores staged projects in its MongoDB database. Push applies selected changes to the live manuscript in the same ROZA environment.
          </p>
          <p>
            Staging Room saves a live manuscript snapshot before Push and a staged project snapshot before Pull.
          </p>
        </section>
      </div>
    </main>
  );
}
