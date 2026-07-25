'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Nav } from './Nav';

// Wraps every authenticated page: redirects to /login if there's no session,
// and renders the shared top nav once there is one. Kept as one component
// rather than a Next.js route group + middleware because auth state here is
// purely client-side (localStorage token, no cookies/session) — see
// Milestone 3B docs for why that tradeoff is fine for a local prototype.
export function ProtectedShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return <div className="content">Loading…</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="layout">
      <Nav />
      <div className="content">{children}</div>
    </div>
  );
}
