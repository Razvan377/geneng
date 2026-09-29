import type { CloningSetup } from '../../science/ends';

/** Vector MCS (teal) and insert (amber) with its end and internal restriction sites. */
export function CloningDiagram({ setup }: { setup: CloningSetup }) {
  return (
    <div className="cloning">
      <div>
        <div className="cloning-title">Vector — multiple cloning site (each site unique in the MCS)</div>
        <div className="mcs-row">
          {setup.mcs.map((e) => (
            <span key={e} className="mcs-chip">
              {e}
            </span>
          ))}
        </div>
        {setup.vectorBackbone.length > 0 && (
          <p className="small muted" style={{ marginTop: 6 }}>
            Also cuts the vector backbone (outside the MCS): <strong>{setup.vectorBackbone.join(', ')}</strong>
          </p>
        )}
      </div>
      <div>
        <div className="cloning-title">Insert</div>
        <div className="insert">
          <div className="insert-end">
            <small>5′ end</small>
            {setup.insert5.map((e) => (
              <span key={e} className="site-pill">
                {e}
              </span>
            ))}
          </div>
          <div className="insert-bar" aria-label={`Sites inside the insert: ${setup.insertInternal.join(', ')}`}>
            {setup.insertInternal.map((e) => (
              <span key={e} className="internal-site">
                {e}
              </span>
            ))}
          </div>
          <div className="insert-end">
            <small>3′ end</small>
            {setup.insert3.map((e) => (
              <span key={e} className="site-pill">
                {e}
              </span>
            ))}
          </div>
        </div>
        <p className="small muted" style={{ marginTop: 6 }}>
          Sites drawn inside the amber bar are internal to the insert.
        </p>
      </div>
    </div>
  );
}
