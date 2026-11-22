import { useState } from "react";
import type { RevertTarget } from "../../../../../../shared/types/stagingRoom";

export interface RejectChoice {
  id: string;
  label: string;
  detail: string;
  targets: RevertTarget[];
  danger?: boolean;
}

/** Choose how much to reject. Nothing changes in Writing Studio. */
export function RejectDialog({
  choices,
  initial,
  onCancel,
  onConfirm,
}: {
  choices: RejectChoice[];
  initial: string;
  onCancel: () => void;
  onConfirm: (targets: RevertTarget[]) => void;
}) {
  const [picked, setPicked] = useState(initial);
  const choice = choices.find((c) => c.id === picked) ?? choices[0];
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal confirm wide reject-dialog" role="dialog" aria-labelledby="reject-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="reject-title">Reject staged changes</h2>
        <p className="muted">
          Rejected changes are removed from Staging, and Writing Studio's version is copied back in their place.
          Writing Studio itself does not change. A backup is saved first, so you can undo this from History.
        </p>
        <fieldset className="reject-choices">
          <legend className="eyebrow">What to reject</legend>
          {choices.map((c) => (
            <label key={c.id} className={`reject-choice ${picked === c.id ? "picked" : ""}`}>
              <input type="radio" name="reject-scope" checked={picked === c.id} onChange={() => setPicked(c.id)} />
              <span>
                <strong className={c.danger ? "danger-text" : ""}>{c.label}</strong>
                <span className="muted small reject-detail">{c.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-danger" onClick={() => onConfirm(choice.targets)}>
            {choice.danger ? "Reset Staging" : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}
