"use client";

import React, { Suspense, useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { ROUTES } from '@/constants';
import './case-tracking.css';

function AdminCaseTrackingContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [caseId, setCaseId] = useState<string>('');
  const [courtStartDate, setCourtStartDate] = useState<string>('');
  const [decisionDeadline, setDecisionDeadline] = useState<string>('');
  const [outcome, setOutcome] = useState<'pending' | 'won' | 'lost'>('pending');
  const [progress, setProgress] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchInput, setSearchInput] = useState<string>('');
  const [trackedCases, setTrackedCases] = useState<any[]>([]);
  const [loadingTrackedCases, setLoadingTrackedCases] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const hasAdminAccess = user.role === 'admin' || user.is_superuser;
    if (!hasAdminAccess) {
      router.push('/login');
      return;
    }
    // Load tracked cases once admin access is confirmed
    fetchTrackedCases();
  }, [user, router]);

  useEffect(() => {
    const pid = searchParams?.get('id');
    const num = pid ? Number(pid) : NaN;
    if (!Number.isNaN(num) && num > 0) {
      setCaseId(String(num));
      setAlert({ type: 'success', message: `Target case set to #${num}. Update fields and submit.` });
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);

    const idNum = Number(caseId);
    if (!idNum || Number.isNaN(idNum)) {
      setAlert({ type: 'error', message: 'Please provide a valid case ID.' });
      return;
    }

    try {
      setSubmitting(true);
      // Check if the case has already been tracked before allowing updates
      const tokenCheck = localStorage.getItem('access');
      let alreadyTracked = false;
      // 1) History exists
      const checkRes = await fetch(`/api/admin/cases/${idNum}/tracking/history`, {
        headers: { 'Authorization': `Bearer ${tokenCheck}` }
      });
      if (checkRes.ok) {
        const checkData = await checkRes.json().catch(() => ({}));
        const historyList = Array.isArray(checkData?.history) ? checkData.history : [];
        alreadyTracked = historyList.length > 0;
      }
      // 2) Outcome or tracking fields on Case
      if (!alreadyTracked) {
        const casesRes = await fetch('/api/admin/cases', { headers: { 'Authorization': `Bearer ${tokenCheck}` } });
        if (casesRes.ok) {
          const casesData = await casesRes.json().catch(() => []);
          const found = Array.isArray(casesData) ? casesData.find((c: any) => Number(c.id) === idNum) : null;
          if (found) {
            const outcomeTracked = found.outcome === 'won' || found.outcome === 'lost';
            const fieldsTracked = !!(found.court_start_date || found.decision_deadline || found.progress);
            alreadyTracked = outcomeTracked || fieldsTracked;
          }
        }
      }
      if (alreadyTracked) {
        setAlert({ type: 'error', message: 'This case already tracked.' });
        return;
      }
      const token = localStorage.getItem('access');
      const payload: any = {};
      if (courtStartDate) payload.court_start_date = courtStartDate;
      if (decisionDeadline) payload.decision_deadline = decisionDeadline;
      if (outcome) payload.outcome = outcome;
      if (progress) payload.progress = progress;

      const res = await fetch(`/api/admin/cases/${idNum}/tracking`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setAlert({ type: 'success', message: 'Case tracking updated successfully.' });
        setProgress('');
      } else {
        const data = await res.json().catch(() => ({}));
        setAlert({ type: 'error', message: data?.error || 'Failed to update case tracking.' });
      }
    } catch (err) {
      console.error('Error updating case tracking:', err);
      setAlert({ type: 'error', message: 'Unexpected error updating case tracking.' });
    } finally {
      setSubmitting(false);
    }
  };

  const fetchTrackedCases = async () => {
    try {
      setLoadingTrackedCases(true);
      const token = localStorage.getItem('access');
      const res = await fetch('/api/admin/cases/tracking/history', { headers: { 'Authorization': `Bearer ${token}` } });
      const map = new Map<number, any>();
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const history = Array.isArray(data?.history) ? data.history : [];
        // Unique by case_id, use the latest entry (history API returns desc by created_at)
        for (const h of history) {
          const cid = Number(h.case_id);
          if (!map.has(cid)) {
            map.set(cid, h);
          }
        }
      }

      // Also include tracked cases discovered from Case outcome/fields
      const outcomes = ['pending', 'won', 'lost'];
      for (const o of outcomes) {
        const cr = await fetch(`/api/admin/cases?outcome=${o}`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (cr.ok) {
          const cd = await cr.json().catch(() => []);
          const arr = Array.isArray(cd) ? cd : [];
          for (const c of arr) {
            const cid = Number(c.id);
            if (!map.has(cid)) {
              map.set(cid, {
                id: null, // no history id
                case_id: cid,
                case_title: c.title,
                court_start_date: c.court_start_date,
                decision_deadline: c.decision_deadline,
                outcome: c.outcome,
                progress: c.progress,
                changes: null,
              });
            }
          }
        }
      }

      const list = Array.from(map.values());
      setTrackedCases(list);
    } catch (e) {
      console.error('Error loading tracked cases:', e);
      setAlert({ type: 'error', message: 'Unexpected error loading tracked cases.' });
    } finally {
      setLoadingTrackedCases(false);
    }
  };

  useEffect(() => {
    fetchTrackedCases();
  }, []);

  const applySearchInput = () => {
    const raw = searchInput.trim();
    if (!raw) return;
    const num = Number(raw);
    if (!Number.isNaN(num) && num > 0) {
      setCaseId(String(num));
      setAlert({ type: 'success', message: `Target case set to #${num}. Update fields and submit.` });
      // Also inform if case is already tracked
      (async () => {
        try {
          const token = localStorage.getItem('access');
          // History check
          const res = await fetch(`/api/admin/cases/${num}/tracking/history`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          let alreadyTracked = false;
          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            const historyList = Array.isArray(data?.history) ? data.history : [];
            alreadyTracked = historyList.length > 0;
          }
          // Case fields / outcome check
          if (!alreadyTracked) {
            const caseRes = await fetch('/api/admin/cases', { headers: { 'Authorization': `Bearer ${token}` } });
            if (caseRes.ok) {
              const all = await caseRes.json().catch(() => []);
              const found = Array.isArray(all) ? all.find((c: any) => Number(c.id) === num) : null;
              if (found) {
                const outcomeTracked = found.outcome === 'won' || found.outcome === 'lost';
                const fieldsTracked = !!(found.court_start_date || found.decision_deadline || found.progress);
                alreadyTracked = outcomeTracked || fieldsTracked;
              }
            }
          }
          if (alreadyTracked) {
            setAlert({ type: 'error', message: 'This case already tracked.' });
          }
        } catch {}
      })();
    } else {
      setAlert({ type: 'error', message: 'Enter a numeric case ID.' });
    }
  };

  const openEdit = (entry: any) => {
    setEditing({ ...entry });
  };

  const submitEdit = async () => {
    if (!editing) return;
    try {
      setEditSubmitting(true);
      const token = localStorage.getItem('access');
      const payload: any = {};
      if (editing.court_start_date !== undefined) payload.court_start_date = editing.court_start_date ? String(editing.court_start_date).slice(0, 10) : '';
      if (editing.decision_deadline !== undefined) payload.decision_deadline = editing.decision_deadline ? String(editing.decision_deadline).slice(0, 10) : '';
      if (editing.outcome !== undefined) payload.outcome = editing.outcome;
      if (editing.progress !== undefined) payload.progress = editing.progress || '';
      if (editing.changes !== undefined) payload.changes = editing.changes || '';
      let ok = false;
      if (editing.id) {
        // Edit existing history entry
        const res = await fetch(`/api/admin/cases/${editing.case_id}/tracking/history/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        ok = res.ok;
        if (!ok) {
          const data = await res.json().catch(() => ({}));
          setAlert({ type: 'error', message: data?.error || 'Failed to update tracking entry.' });
        }
      } else {
        // No history yet: update case tracking; this will create a history snapshot
        const res = await fetch(`/api/admin/cases/${editing.case_id}/tracking`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        ok = res.ok;
        if (!ok) {
          const data = await res.json().catch(() => ({}));
          setAlert({ type: 'error', message: data?.error || 'Failed to update case tracking.' });
        }
      }
      if (ok) {
        setAlert({ type: 'success', message: 'Tracking entry updated.' });
        setEditing(null);
        await fetchTrackedCases();
      }
    } catch (err) {
      console.error('Error updating tracking entry:', err);
      setAlert({ type: 'error', message: 'Unexpected error updating tracking entry.' });
    } finally {
      setEditSubmitting(false);
    }
  };

  const deleteEntry = async (entry: any) => {
    try {
      const token = localStorage.getItem('access');
      if (!entry?.id) {
        // Try to find latest history for this case and delete it
        const histRes = await fetch(`/api/admin/cases/${entry.case_id}/tracking/history`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (histRes.ok) {
          const hd = await histRes.json().catch(() => ({}));
          const list = Array.isArray(hd?.history) ? hd.history : [];
          if (list.length === 0) {
            setAlert({ type: 'error', message: 'No history entry to delete for this case.' });
            return;
          }
          const latest = list[0];
          const del = await fetch(`/api/admin/cases/${entry.case_id}/tracking/history/${latest.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
          if (del.ok) {
            setAlert({ type: 'success', message: 'Tracking entry deleted.' });
            await fetchTrackedCases();
          } else {
            const derr = await del.json().catch(() => ({}));
            setAlert({ type: 'error', message: derr?.error || 'Failed to delete tracking entry.' });
          }
        } else {
          setAlert({ type: 'error', message: 'Failed to load case history.' });
        }
        return;
      }
      const res = await fetch(`/api/admin/cases/${entry.case_id}/tracking/history/${entry.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        setAlert({ type: 'success', message: 'Tracking entry deleted.' });
        await fetchTrackedCases();
      } else {
        const data = await res.json().catch(() => ({}));
        setAlert({ type: 'error', message: data?.error || 'Failed to delete tracking entry.' });
      }
    } catch (err) {
      console.error('Error deleting tracking entry:', err);
      setAlert({ type: 'error', message: 'Unexpected error deleting tracking entry.' });
    }
  };

  return (
    <div className="container py-4">
      <h1 className="mb-3">Admin: Case Tracking</h1>
      <p className="text-muted mb-4">Set court start date, decision deadline, outcome, and progress for approved cases. Clients and assigned lawyers will be notified.</p>

      {alert && (
        <div className={`alert ${alert.type === 'success' ? 'alert-success' : 'alert-danger'}`} role="alert">
          {alert.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-3" style={{ maxWidth: 720 }}>
        <div className="mb-3">
          <label htmlFor="searchInput" className="form-label">Search or Case ID</label>
          <div className="d-flex gap-2">
            <input
              id="searchInput"
              type="text"
              className="form-control"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applySearchInput(); } }}
              placeholder="Type case ID to update"
            />
            <button className="btn btn-outline-secondary" type="button" onClick={applySearchInput}>
              Apply
            </button>
          </div>
          <small className="text-muted d-block mt-1">Enter a numeric case ID to target updates.</small>
        </div>

        <div className="row">
          <div className="col-md-6 mb-3">
            <label htmlFor="courtStartDate" className="form-label">Court Start Date</label>
            <input id="courtStartDate" type="date" className="form-control" value={courtStartDate} onChange={(e) => setCourtStartDate(e.target.value)} />
          </div>
          <div className="col-md-6 mb-3">
            <label htmlFor="decisionDeadline" className="form-label">Decision Deadline</label>
            <input id="decisionDeadline" type="date" className="form-control" value={decisionDeadline} onChange={(e) => setDecisionDeadline(e.target.value)} />
          </div>
        </div>

        <div className="mb-3">
          <label htmlFor="outcome" className="form-label">Outcome</label>
          <select id="outcome" className="form-select" value={outcome} onChange={(e) => setOutcome(e.target.value as any)}>
            <option value="pending">Pending</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>
        </div>

        <div className="mb-3">
          <label htmlFor="progress" className="form-label">Progress Notes</label>
          <textarea id="progress" className="form-control" rows={4} value={progress} onChange={(e) => setProgress(e.target.value)} placeholder="Brief progress update (optional)" />
        </div>

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Updating...' : 'Update Tracking'}
        </button>
      </form>
      <div className="mt-4">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 className="h5 m-0">Tracked Cases (Latest Entry)</h2>
          <button className="btn btn-sm btn-outline-secondary" type="button" onClick={fetchTrackedCases} disabled={loadingTrackedCases}>
            <i className="fas fa-sync"></i> Refresh
          </button>
        </div>
        <div className="card p-3">
          {loadingTrackedCases ? (
            <p>Loading tracked cases...</p>
          ) : trackedCases.length === 0 ? (
            <p className="text-muted">No tracked cases yet.</p>
          ) : (
            <div className="table-responsive">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Case</th>
                    <th>Outcome</th>
                    <th>Court Start</th>
                    <th>Decision Deadline</th>
                    <th>Progress</th>
                    <th>Changes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {trackedCases.map((h: any) => (
                    <tr key={h.id ?? h.case_id}>
                      <td data-label="Case">{h.case_title ? `${h.case_title} (#${h.case_id})` : `#${h.case_id}`}</td>
                      <td data-label="Outcome">{h.outcome ?? '—'}</td>
                      <td data-label="Court Start">{h.court_start_date ? new Date(h.court_start_date).toLocaleDateString() : '—'}</td>
                      <td data-label="Decision Deadline">{h.decision_deadline ? new Date(h.decision_deadline).toLocaleDateString() : '—'}</td>
                      <td data-label="Progress">{h.progress || '—'}</td>
                      <td data-label="Changes">{h.changes || '—'}</td>
                      <td data-label="Actions">
                        <button className="btn btn-sm btn-outline-primary me-2" onClick={() => openEdit(h)}>Edit</button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => deleteEntry(h)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="modal d-block" tabIndex={-1} role="dialog" style={{ background: 'rgba(0,0,0,0.35)' }}>
          <div className="modal-dialog" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit Tracked Entry</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setEditing(null)} />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Outcome</label>
                  <select className="form-select" value={editing.outcome || 'pending'} onChange={(e) => setEditing({ ...editing, outcome: e.target.value })}>
                    <option value="pending">Pending</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Court Start Date</label>
                    <input type="date" className="form-control" value={editing.court_start_date ? String(editing.court_start_date).slice(0, 10) : ''} onChange={(e) => setEditing({ ...editing, court_start_date: e.target.value })} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Decision Deadline</label>
                    <input type="date" className="form-control" value={editing.decision_deadline ? String(editing.decision_deadline).slice(0, 10) : ''} onChange={(e) => setEditing({ ...editing, decision_deadline: e.target.value })} />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label">Progress</label>
                  <textarea className="form-control" rows={3} value={editing.progress || ''} onChange={(e) => setEditing({ ...editing, progress: e.target.value })} />
                </div>
                <div className="mb-3">
                  <label className="form-label">Changes</label>
                  <textarea className="form-control" rows={3} value={editing.changes || ''} onChange={(e) => setEditing({ ...editing, changes: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={submitEdit} disabled={editSubmitting}>
                  {editSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function AdminCaseTrackingPage() {
  return (
    <Suspense fallback={<div className="container py-4"><p>Loading case tracking…</p></div>}>
      <AdminCaseTrackingContent />
    </Suspense>
  );
}