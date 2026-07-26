'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedShell } from '@/components/ProtectedShell';
import { useApi } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { Gender, Person } from '@/lib/types';

const GENDERS: Gender[] = ['MALE', 'FEMALE', 'OTHER'];

export default function NewPersonPage() {
  const api = useApi();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [alias, setAlias] = useState('');
  const [gender, setGender] = useState<Gender>('MALE');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const person = await api<Person>('/persons', {
        method: 'POST',
        body: {
          fullName,
          alias: alias || undefined,
          gender,
          dateOfBirth: dateOfBirth || undefined,
          phoneNumber: phoneNumber || undefined,
          addressLine: addressLine || undefined,
        },
      });
      router.push(`/persons/view?id=${person.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create person');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ProtectedShell>
      <div className="page-header">
        <h1>Add Person</h1>
      </div>
      {error && <div className="error-banner">{error}</div>}
      <div className="card">
        <form className="stacked" onSubmit={onSubmit}>
          <div className="field">
            <label>Full Name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} />
          </div>
          <div className="field">
            <label>Alias (optional)</label>
            <input value={alias} onChange={(e) => setAlias(e.target.value)} />
          </div>
          <div className="field">
            <label>Gender</label>
            <select value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Date of Birth (optional)</label>
            <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
          </div>
          <div className="field">
            <label>Phone Number (optional)</label>
            <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
          </div>
          <div className="field">
            <label>Address (optional)</label>
            <input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} />
          </div>
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Person'}
          </button>
        </form>
      </div>
    </ProtectedShell>
  );
}
