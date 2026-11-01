import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Badge,
  Empty,
  ErrorBox,
  Field,
  Form,
  Loading,
  Modal,
  Pager,
  Title,
  value,
} from '../components/ui';
import { api, send, sessionToken } from '../lib/api';
import { useSession } from '../lib/session';
export function Users() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1),
    [role, setRole] = useState(''),
    [search, setSearch] = useState(''),
    [edit, setEdit] = useState<any>(null),
    [error, setError] = useState<unknown>(null);
  const q = useQuery({
    queryKey: ['users', page, role, search],
    queryFn: () =>
      api(`/admin/users?page=${page}&role=${role}&search=${encodeURIComponent(search)}`),
  });
  return (
    <>
      <Title
        eyebrow="CAMPUS COMMUNITY"
        title="User management"
        description="The people who make GUTECH, GUTECH."
        action={
          <button className="button primary" onClick={() => setEdit({})}>
            <Plus size={17} />
            Create account
          </button>
        }
      />
      <div className="toolbar">
        <input
          aria-label="Search users"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Filter by role"
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All roles</option>
          <option>admin</option>
          <option>teacher</option>
          <option>student</option>
        </select>
      </div>
      <ErrorBox error={q.error || error} />
      {q.isLoading ? (
        <Loading />
      ) : q.data?.data.length ? (
        <div className="panel table-scroll">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Roll number</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {q.data.data.map((u: any) => (
                <tr key={u.id}>
                  <td>
                    <div className="table-user">
                      <div className="avatar small">
                        {u.fullName
                          .split(' ')
                          .map((x: string) => x[0])
                          .slice(0, 2)
                          .join('')}
                      </div>
                      <div>
                        <strong>{u.fullName}</strong>
                        <small>{u.email}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Badge
                      tone={u.role === 'admin' ? 'maroon' : u.role === 'teacher' ? 'blue' : ''}
                    >
                      {u.role}
                    </Badge>
                  </td>
                  <td>{u.rollNo || '—'}</td>
                  <td>
                    <Badge tone={u.isActive ? 'green' : ''}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td>
                    <div className="inline">
                      <button className="text-button" onClick={() => setEdit(u)}>
                        Edit
                      </button>
                      <button
                        className="text-button"
                        onClick={async () => {
                          try {
                            await send(`/admin/users/${u.id}/reset-password`, 'POST');
                            alert('Password reset email requested.');
                          } catch (e) {
                            setError(e);
                          }
                        }}
                      >
                        Reset password
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !q.error && (
          <Empty
            title="Your community starts here"
            text="Create teacher and student accounts to get started."
          />
        )
      )}
      <Pager page={page} total={q.data?.meta?.total} onPage={setPage} />
      {edit && (
        <Modal
          title={edit.id ? 'Edit campus account' : 'Create a campus account'}
          onClose={() => setEdit(null)}
        >
          <Form
            label={edit.id ? 'Save account' : 'Create account'}
            onSubmit={async (f) => {
              const b: any = {
                fullName: value(f, 'fullName'),
                role: value(f, 'role'),
                rollNo: value(f, 'rollNo') || undefined,
              };
              if (edit.id) b.isActive = f.get('active') === 'on';
              else {
                b.email = value(f, 'email');
                b.tempPassword = value(f, 'password');
              }
              await send(
                edit.id ? `/admin/users/${edit.id}` : '/admin/users',
                edit.id ? 'PATCH' : 'POST',
                b,
              );
              setEdit(null);
              void qc.invalidateQueries({ queryKey: ['users'] });
            }}
          >
            <Field label="Full name">
              <input name="fullName" defaultValue={edit.fullName} minLength={2} required />
            </Field>
            {!edit.id && (
              <Field label="Email">
                <input name="email" type="email" required />
              </Field>
            )}
            <div className="form-grid">
              <Field label="Role">
                <select name="role" defaultValue={edit.role || 'student'}>
                  <option>student</option>
                  <option>teacher</option>
                  <option>admin</option>
                </select>
              </Field>
              <Field label="Roll number (students)">
                <input name="rollNo" defaultValue={edit.rollNo} />
              </Field>
            </div>
            {!edit.id ? (
              <>
                <Field label="Temporary password">
                  <input
                    name="password"
                    type="password"
                    minLength={10}
                    pattern="(?=.*[A-Za-z])(?=.*[0-9]).{10,}"
                    required
                  />
                </Field>
                <p className="muted">
                  At least 10 characters, a letter and a number. The user must change it at first
                  login.
                </p>
              </>
            ) : (
              <label className="checkbox">
                <input name="active" type="checkbox" defaultChecked={edit.isActive} />
                Account is active
              </label>
            )}
          </Form>
        </Modal>
      )}
    </>
  );
}
export function Marks() {
  const { user } = useSession();
  const student = user?.role === 'student';
  const cs = useQuery({
    queryKey: ['course-options'],
    queryFn: () => api('/me/courses?pageSize=100'),
  });
  const [itemPage, setItemPage] = useState(1);
  const [selected, setSelected] = useState(''),
    [page, setPage] = useState(1),
    [error, setError] = useState<unknown>(null);
  const cid = selected || (!student ? cs.data?.data[0]?.id : '');
  const q = useQuery({
    queryKey: ['marks', cid, page, itemPage],
    queryFn: () =>
      api(
        student
          ? `/me/marks?page=${page}${cid ? '&courseId=' + cid : ''}`
          : `/courses/${cid}/gradebook?page=${page}&itemPage=${itemPage}`,
      ),
    enabled: student || !!cid,
  });
  const summary = useQuery({
    queryKey: ['marks-summary', cid],
    queryFn: () => api(`/marks/summary${cid ? '?courseId=' + cid : ''}`),
    enabled: student || !!cid,
  });
  const obtained = (summary.data?.data || []).reduce(
      (a: number, x: any) => a + Number(x.obtained),
      0,
    ),
    maximum = (summary.data?.data || []).reduce((a: number, x: any) => a + Number(x.maximum), 0);
  return (
    <>
      <Title
        eyebrow="ACADEMIC PROGRESS"
        title={student ? 'My marks' : 'Course gradebook'}
        description="Every effort counts. See how far you’ve come."
      />
      <div className="toolbar">
        <select
          aria-label="Choose course"
          value={cid}
          onChange={(e) => {
            setSelected(e.target.value);
            setPage(1);
          }}
        >
          {student && <option value="">All my courses</option>}
          {cs.data?.data.map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.code} · {c.title}
            </option>
          ))}
        </select>
        {!student && cid && (
          <button
            className="button secondary"
            onClick={async () => {
              try {
                const r = await fetch(
                  `${import.meta.env.VITE_API_URL || '/api'}/courses/${cid}/gradebook.csv?page=${page}`,
                  { headers: { Authorization: `Bearer ${sessionToken()}` } },
                );
                if (!r.ok) throw new Error('CSV export failed.');
                const blob = await r.blob(),
                  url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'gradebook.csv';
                a.click();
                URL.revokeObjectURL(url);
              } catch (e) {
                setError(e);
              }
            }}
          >
            <Download size={16} />
            Export this page
          </button>
        )}
      </div>
      {student && (
        <div className="marks-summary panel">
          <div>
            <span>Graded total · all assessments</span>
            <h2>
              {obtained} <small>/ {maximum}</small>
            </h2>
          </div>
          <div className="marks-progress">
            <strong>{maximum ? ((obtained / maximum) * 100).toFixed(1) : '0'}%</strong>
            <div>
              <i style={{ width: `${maximum ? (obtained / maximum) * 100 : 0}%` }} />
            </div>
            <small>Pending grades are excluded</small>
          </div>
        </div>
      )}
      <ErrorBox error={q.error || cs.error || summary.error || error} />
      {q.isLoading ? (
        <Loading />
      ) : q.data?.data.length ? (
        <div className="panel table-scroll">
          {!student ? (
            <table className="gradebook-matrix">
              <thead>
                <tr>
                  <th>Student</th>
                  {q.data.data[0]?.items.map((item: any) => (
                    <th key={item.itemId}>
                      {item.title}
                      <small className="block">{item.max} marks</small>
                    </th>
                  ))}
                  <th>Graded total</th>
                  <th>Percentage</th>
                </tr>
              </thead>
              <tbody>
                {q.data.data.map((row: any) => (
                  <tr key={row.studentId}>
                    <td>
                      <strong>{row.studentName}</strong>
                      <small className="block">{row.rollNo}</small>
                    </td>
                    {row.items.map((item: any) => (
                      <td key={item.itemId}>
                        <Link
                          className="grade-cell"
                          to={`/courses/${cid}?tab=${item.kind === 'assignment' ? 'assignments' : 'quizzes'}&grade=${item.itemId}`}
                        >
                          {item.obtained ?? 'Pending'}
                        </Link>
                      </td>
                    ))}
                    <td>
                      {row.obtained} / {row.maximum}
                    </td>
                    <td>{row.maximum ? ((row.obtained / row.maximum) * 100).toFixed(1) : '0'}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table>
              <thead>
                <tr>
                  {!student && <th>Student ID</th>}
                  <th>Assessment</th>
                  <th>Type</th>
                  <th>Obtained</th>
                  <th>Maximum</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {q.data.data.map((m: any) => (
                  <tr key={m.studentId + m.itemId}>
                    {!student && (
                      <td>
                        <small>{m.studentId}</small>
                      </td>
                    )}
                    <td>
                      <strong>{m.title}</strong>
                    </td>
                    <td>
                      <Badge>{m.kind}</Badge>
                    </td>
                    <td>{m.obtained ?? '—'}</td>
                    <td>{m.max}</td>
                    <td>
                      <Badge tone={m.obtained !== null ? 'green' : 'amber'}>
                        {m.obtained !== null ? 'Graded' : 'Pending'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        !q.error && (
          <Empty
            title="Your progress is taking shape"
            text="Marks will appear after an assessment is graded."
          />
        )
      )}
      {!student &&
        Math.max(q.data?.meta?.assignmentCount || 0, q.data?.meta?.quizCount || 0) > 50 && (
          <div className="pager">
            <span>Assessment columns · Page {itemPage}</span>
            <button
              disabled={itemPage <= 1}
              onClick={() => setItemPage(itemPage - 1)}
              aria-label="Previous assessment columns"
            >
              ←
            </button>
            <button
              disabled={
                itemPage * 50 >=
                Math.max(q.data?.meta?.assignmentCount || 0, q.data?.meta?.quizCount || 0)
              }
              onClick={() => setItemPage(itemPage + 1)}
              aria-label="Next assessment columns"
            >
              →
            </button>
          </div>
        )}
      <Pager page={page} total={q.data?.meta?.total} onPage={setPage} />
    </>
  );
}
