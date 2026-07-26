'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedShell } from '@/components/ProtectedShell';
import { StatusBadge } from '@/components/StatusBadge';
import { GraphView } from '@/components/GraphView';
import { useApi } from '@/lib/auth-context';
import { GangNetwork, HiddenAssociation, RepeatOffender } from '@/lib/types';

type Tab = 'repeat-offenders' | 'hidden-associations' | 'gangs';

const VIA_LABELS: Record<string, string> = {
  ADDRESS: 'Shared address',
  PHONE: 'Shared phone number',
  VEHICLE: 'Shared vehicle',
};

export default function NetworkPage() {
  const api = useApi();
  const [tab, setTab] = useState<Tab>('repeat-offenders');

  const [repeatOffenders, setRepeatOffenders] = useState<RepeatOffender[] | null>(null);
  const [hiddenAssociations, setHiddenAssociations] = useState<HiddenAssociation[] | null>(null);
  const [gangs, setGangs] = useState<GangNetwork[] | null>(null);
  const [expandedOffender, setExpandedOffender] = useState<string | null>(null);
  const [expandedGang, setExpandedGang] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    if (tab === 'repeat-offenders' && repeatOffenders === null) {
      setLoading(true);
      api<RepeatOffender[]>('/network/repeat-offenders?minCrimes=3&limit=25')
        .then(setRepeatOffenders)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
    if (tab === 'hidden-associations' && hiddenAssociations === null) {
      setLoading(true);
      api<HiddenAssociation[]>('/network/hidden-associations?limit=30')
        .then(setHiddenAssociations)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
    if (tab === 'gangs' && gangs === null) {
      setLoading(true);
      api<GangNetwork[]>('/network/gangs?minSize=3')
        .then(setGangs)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <ProtectedShell>
      <div className="page-header">
        <h1>Network &amp; Link Analysis</h1>
      </div>
      <p className="chart-subtitle" style={{ marginTop: '-0.75rem' }}>
        Powered by Neo4j graph queries and GDS Louvain community detection over the crime/suspect graph — not
        simple SQL joins.
      </p>

      <div className="filters" style={{ marginBottom: '1rem' }}>
        <button
          className={`btn ${tab === 'repeat-offenders' ? '' : 'secondary'}`}
          onClick={() => setTab('repeat-offenders')}
        >
          Repeat Offenders
        </button>
        <button
          className={`btn ${tab === 'hidden-associations' ? '' : 'secondary'}`}
          onClick={() => setTab('hidden-associations')}
        >
          Hidden Associations
        </button>
        <button className={`btn ${tab === 'gangs' ? '' : 'secondary'}`} onClick={() => setTab('gangs')}>
          Gang &amp; Criminal Networks
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading && <p className="muted">Loading…</p>}

      {tab === 'repeat-offenders' && repeatOffenders && (
        <div className="card">
          <p className="section-title">Persons flagged as SUSPECT on 3+ distinct crimes</p>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th># Crimes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {repeatOffenders.map((r) => (
                <Fragment key={r.personId}>
                  <tr>
                    <td>
                      <Link href={`/persons/view?id=${r.personId}`}>{r.fullName}</Link>
                    </td>
                    <td>{r.crimeCount}</td>
                    <td>
                      <button
                        className="btn secondary"
                        onClick={() => setExpandedOffender((id) => (id === r.personId ? null : r.personId))}
                      >
                        {expandedOffender === r.personId ? 'Hide cases' : 'View cases'}
                      </button>
                    </td>
                  </tr>
                  {expandedOffender === r.personId && (
                    <tr>
                      <td colSpan={3}>
                        <table>
                          <thead>
                            <tr>
                              <th>FIR No.</th>
                              <th>Category</th>
                              <th>Station</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.crimes.map((c) => (
                              <tr key={c.id}>
                                <td>
                                  <Link href={`/crimes/view?id=${c.id}`}>{c.firNumber ?? '—'}</Link>
                                </td>
                                <td>{c.category}</td>
                                <td>{c.station}</td>
                                <td>
                                  <StatusBadge status={c.status} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {repeatOffenders.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">
                    No repeat offenders found at this threshold.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'hidden-associations' && hiddenAssociations && (
        <div className="card">
          <p className="section-title">Pairs linked by a shared attribute, never co-listed on the same crime</p>
          <table>
            <thead>
              <tr>
                <th>Person 1</th>
                <th>Person 2</th>
                <th>Linked via</th>
                <th>Shared value</th>
              </tr>
            </thead>
            <tbody>
              {hiddenAssociations.map((h, i) => (
                <tr key={i}>
                  <td>
                    <Link href={`/persons/view?id=${h.person1.id}`}>{h.person1.fullName}</Link>
                  </td>
                  <td>
                    <Link href={`/persons/view?id=${h.person2.id}`}>{h.person2.fullName}</Link>
                  </td>
                  <td>{VIA_LABELS[h.via]}</td>
                  <td>{h.sharedValue}</td>
                </tr>
              ))}
              {hiddenAssociations.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    No hidden associations found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'gangs' && gangs && (
        <>
          <p className="muted" style={{ marginBottom: '0.75rem' }}>
            {gangs.length} network{gangs.length === 1 ? '' : 's'} of 3+ co-offending suspects detected.
          </p>
          {gangs.map((g) => (
            <div className="card" key={g.communityId}>
              <div className="page-header" style={{ marginBottom: '0.5rem' }}>
                <p className="section-title" style={{ margin: 0 }}>
                  Network #{g.communityId} — {g.size} members
                </p>
                <button
                  className="btn secondary"
                  onClick={() => setExpandedGang((id) => (id === g.communityId ? null : g.communityId))}
                >
                  {expandedGang === g.communityId ? 'Hide graph' : 'View graph'}
                </button>
              </div>
              <p className="muted">{g.members.map((m) => m.fullName).join(', ')}</p>
              {expandedGang === g.communityId && (
                <GraphView
                  nodes={g.members.map((m) => ({ id: m.id, label: m.fullName, type: 'PERSON' }))}
                  edges={g.edges}
                />
              )}
            </div>
          ))}
          {gangs.length === 0 && <p className="muted">No networks of this size detected.</p>}
        </>
      )}
    </ProtectedShell>
  );
}
