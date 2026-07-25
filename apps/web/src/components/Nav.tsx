'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export function Nav() {
  const { user, logout } = useAuth();
  if (!user) return null;
  // Network & Link Analysis and AI Intelligence are Analyst/Admin
  // capabilities per the Milestone 1 role table — Officers don't get these
  // nav links at all (matches the backend's role guard on both modules).
  const isAnalystCapable = user.role === 'ADMIN' || user.role === 'ANALYST';

  return (
    <div className="topbar">
      <div className="topbar-brand">Crime Intelligence Platform</div>
      <nav className="topbar-nav">
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/map">Map</Link>
        <Link href="/crimes">Crimes</Link>
        <Link href="/persons">Persons</Link>
        <Link href="/vehicles">Vehicles</Link>
        <Link href="/weapons">Weapons</Link>
        {isAnalystCapable && <Link href="/network">Network</Link>}
        {isAnalystCapable && <Link href="/intelligence">AI Intelligence</Link>}
        <Link href="/reports">Reports</Link>
        <Link href="/reference">Districts &amp; Stations</Link>
      </nav>
      <div className="topbar-user">
        <span>{user.fullName}</span>
        <span className="role-badge">{user.role}</span>
        <button className="link-button" onClick={logout}>
          Log out
        </button>
      </div>
    </div>
  );
}
