'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedShell } from '@/components/ProtectedShell';
import { useApi, useAuth } from '@/lib/auth-context';
import { Person } from '@/lib/types';

export default function PersonsListPage() {
  const api = useApi();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const path = query.trim().length >= 2 ? `/persons/search?q=${encodeURIComponent(query)}` : '/persons';
    const timeout = setTimeout(() => {
      api<Person[]>(path)
        .then(setPeople)
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  const canCreate = user?.role === 'ADMIN' || user?.role === 'OFFICER';

  return (
    <ProtectedShell>
      <div className="page-header">
        <h1>Persons</h1>
        {canCreate && (
          <Link href="/persons/new" className="btn">
            + Add Person
          </Link>
        )}
      </div>

      <div className="card">
        <div className="field" style={{ maxWidth: 420, marginBottom: '1rem' }}>
          <label>Search by name, address, or phone (fuzzy match)</label>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Ramesh, or 98..." />
        </div>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Alias</th>
                <th>Gender</th>
                <th>Phone</th>
                <th>Address</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/persons/${p.id}`}>{p.fullName}</Link>
                  </td>
                  <td>{p.alias ?? '—'}</td>
                  <td>{p.gender}</td>
                  <td>{p.phoneNumber ?? '—'}</td>
                  <td>{p.addressLine ?? '—'}</td>
                </tr>
              ))}
              {people.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    No matches.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </ProtectedShell>
  );
}
