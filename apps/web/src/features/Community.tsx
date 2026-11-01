import { createClient } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, Download, MessageCircle, Pin, Plus, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
  dateTime,
  value,
} from '../components/ui';
import { api, download, send, sessionToken, upload } from '../lib/api';
import { useSession } from '../lib/session';
export function Announcements() {
  const { user } = useSession(),
    qc = useQueryClient();
  const [page, setPage] = useState(1),
    [edit, setEdit] = useState<any>(null),
    [error, setError] = useState<unknown>(null),
    [course, setCourse] = useState('');
  const q = useQuery({
    queryKey: ['announcements', page, course],
    queryFn: () => api(`/announcements?page=${page}${course ? '&courseId=' + course : ''}`),
  });
  const cs = useQuery({
    queryKey: ['course-options'],
    queryFn: () => api('/me/courses?pageSize=100'),
  });
  return (
    <>
      <Title
        eyebrow="STAY IN THE LOOP"
        title="Campus bulletin"
        description="News, notices and the things that bring us together."
        action={
          user?.role !== 'student' && (
            <button className="button primary" onClick={() => setEdit({})}>
              <Plus size={17} />
              Post announcement
            </button>
          )
        }
      />
      <div className="toolbar">
        <select
          aria-label="Filter announcements by course"
          value={course}
          onChange={(e) => {
            setCourse(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All announcements</option>
          {cs.data?.data.map((c: any) => (
            <option value={c.id} key={c.id}>
              {c.code} · {c.title}
            </option>
          ))}
        </select>
        <button
          className="button secondary"
          onClick={async () => {
            try {
              await send('/announcements/read', 'POST', { upTo: new Date().toISOString() });
              void qc.invalidateQueries({ queryKey: ['announcements'] });
            } catch (e) {
              setError(e);
            }
          }}
        >
          <CheckCheck size={16} />
          Mark as read
        </button>
      </div>
      <ErrorBox error={q.error || error} />
      {q.isLoading ? (
        <Loading />
      ) : q.data?.data.length ? (
        <div className="announcement-list">
          {q.data.data.map((a: any) => (
            <article className={`panel announcement-card ${!a.isRead ? 'unread' : ''}`} key={a.id}>
              <div className="card-top">
                <div className="inline">
                  <Badge tone={a.courseId ? 'blue' : 'maroon'}>
                    {cs.data?.data.find((c: any) => c.id === a.courseId)?.code ||
                      (a.courseId ? 'Course update' : 'Campus-wide')}
                  </Badge>
                  {a.isPinned && (
                    <Badge>
                      <Pin size={12} />
                      Pinned
                    </Badge>
                  )}
                  {!a.isRead && <span className="new-dot" />}
                </div>
                <small>{dateTime(a.createdAt)}</small>
              </div>
              <h2>{a.title}</h2>
              <p className="pre-wrap">{a.body}</p>
              {(user?.role === 'admin' || a.authorId === user?.id) && (
                <div className="card-actions">
                  <button className="text-button" onClick={() => setEdit(a)}>
                    Edit
                  </button>
                  <button
                    className="text-button danger"
                    onClick={async () => {
                      if (!confirm('Delete this announcement?')) return;
                      try {
                        await send(`/announcements/${a.id}`, 'DELETE');
                        void qc.invalidateQueries({ queryKey: ['announcements'] });
                      } catch (e) {
                        setError(e);
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        !q.error && (
          <Empty title="A quiet moment on campus" text="Your announcements will appear here." />
        )
      )}
      <Pager page={page} total={q.data?.meta?.total} onPage={setPage} />
      {edit && (
        <Modal
          title={edit.id ? 'Edit announcement' : 'Share an update'}
          onClose={() => setEdit(null)}
        >
          <Form
            label="Publish update"
            onSubmit={async (f) => {
              const b: any = {
                title: value(f, 'title'),
                body: value(f, 'body'),
                isPinned: f.get('pinned') === 'on',
              };
              if (!edit.id) b.courseId = value(f, 'courseId') || null;
              await send(
                edit.id ? `/announcements/${edit.id}` : '/announcements',
                edit.id ? 'PATCH' : 'POST',
                b,
              );
              setEdit(null);
              void qc.invalidateQueries({ queryKey: ['announcements'] });
            }}
          >
            {!edit.id && (
              <Field label="Audience">
                <select name="courseId" required={user?.role !== 'admin'}>
                  {user?.role === 'admin' ? (
                    <option value="">Campus-wide</option>
                  ) : (
                    <option value="">Select a course</option>
                  )}
                  {cs.data?.data.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.title}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Title">
              <input name="title" defaultValue={edit.title} required minLength={2} />
            </Field>
            <Field label="Message">
              <textarea rows={5} name="body" defaultValue={edit.body} required />
            </Field>
            <label className="checkbox">
              <input name="pinned" type="checkbox" defaultChecked={edit.isPinned} />
              Pin this announcement
            </label>
          </Form>
        </Modal>
      )}
    </>
  );
}
export function Chat() {
  const { user } = useSession(),
    qc = useQueryClient();
  const cs = useQuery({
    queryKey: ['course-options'],
    queryFn: () => api('/me/courses?pageSize=100'),
  });
  const [course, setCourse] = useState(''),
    [error, setError] = useState<unknown>(null),
    [body, setBody] = useState(''),
    [busy, setBusy] = useState(false),
    [older, setOlder] = useState<any[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [historyBusy, setHistoryBusy] = useState(false),
    [pending, setPending] = useState<any>(null);
  const bottom = useRef<HTMLDivElement>(null),
    pane = useRef<HTMLDivElement>(null),
    nearBottom = useRef(true);
  const cid = course || cs.data?.data[0]?.id;
  const q = useQuery({
    queryKey: ['messages', cid],
    queryFn: () => api(`/courses/${cid}/messages`),
    enabled: !!cid,
    refetchInterval: 10000,
  });
  useEffect(() => {
    setOlder([]);
    setCursor(null);
    setPending(null);
  }, [cid]);
  useEffect(() => {
    if (nearBottom.current) bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [q.data, pending]);
  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL,
      key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!cid || !url || !key) return;
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    void db.realtime.setAuth(sessionToken() || '');
    const ch = db
      .channel(`chat-${cid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: `course_id=eq.${cid}` },
        () => void qc.invalidateQueries({ queryKey: ['messages', cid] }),
      )
      .subscribe();
    return () => {
      void db.removeChannel(ch);
    };
  }, [cid, qc]);
  const post = async (text: string) => {
    if (!text.trim() || !cid) return;
    setBusy(true);
    setError(null);
    setPending({ body: text, status: 'Sending…', senderId: user?.id });
    setBody('');
    try {
      await send(`/courses/${cid}/messages`, 'POST', { body: text });
      setPending(null);
      await qc.invalidateQueries({ queryKey: ['messages', cid] });
      nearBottom.current = true;
    } catch (e) {
      setError(e);
      setPending({ body: text, status: 'Failed — tap to retry', senderId: user?.id });
    } finally {
      setBusy(false);
    }
  };
  const messages = [...older, ...(q.data?.data || [])].filter(
    (m: any, i: number, a: any[]) => a.findIndex((x) => x.id === m.id) === i,
  );
  return (
    <>
      <Title
        eyebrow="BETTER TOGETHER"
        title="Classroom chat"
        description="Questions, ideas and conversations that keep learning going."
      />
      <div className="chat-layout panel">
        <aside className="chat-courses">
          <h3>Your classrooms</h3>
          <ErrorBox error={cs.error} />
          {cs.isLoading ? (
            <Loading />
          ) : cs.data?.data.length ? (
            cs.data.data.map((c: any) => (
              <button
                className={cid === c.id ? 'selected' : ''}
                key={c.id}
                onClick={() => setCourse(c.id)}
              >
                <span className="course-avatar">{c.code.slice(0, 2)}</span>
                <div>
                  <strong>{c.code}</strong>
                  <small>{c.title}</small>
                </div>
              </button>
            ))
          ) : (
            <Empty title="No classrooms yet" />
          )}
        </aside>
        <section className="chat-content">
          {cid ? (
            <>
              <header>
                <div>
                  <h3>{cs.data?.data.find((c: any) => c.id === cid)?.title}</h3>
                  <p>Course members only · Text chat</p>
                </div>
                <MessageCircle size={20} />
              </header>
              <div
                className="chat-messages"
                ref={pane}
                onScroll={() => {
                  if (pane.current)
                    nearBottom.current =
                      pane.current.scrollHeight -
                        pane.current.scrollTop -
                        pane.current.clientHeight <
                      100;
                }}
              >
                <ErrorBox error={q.error || error} />
                {q.data?.data.length >= 50 && cursor !== 'end' && (
                  <button
                    className="text-button"
                    disabled={historyBusy}
                    onClick={async () => {
                      setHistoryBusy(true);
                      try {
                        const before = cursor || q.data?.data[0]?.createdAt;
                        const r = await api(
                          `/courses/${cid}/messages?before=${encodeURIComponent(before)}`,
                        );
                        setOlder([...r.data, ...older]);
                        setCursor(r.data.length < 50 ? 'end' : r.data[0]?.createdAt);
                      } catch (e) {
                        setError(e);
                      } finally {
                        setHistoryBusy(false);
                      }
                    }}
                  >
                    {historyBusy ? 'Loading…' : 'Load earlier messages'}
                  </button>
                )}
                {q.isLoading ? (
                  <Loading />
                ) : messages.length ? (
                  messages.map((m: any) => (
                    <div className={`message ${m.senderId === user?.id ? 'own' : ''}`} key={m.id}>
                      <div className="message-meta">
                        <strong>{m.senderName}</strong>
                        <Badge>{m.senderRole}</Badge>
                        <small>{dateTime(m.createdAt)}</small>
                      </div>
                      <div className={m.deletedAt ? 'deleted' : ''}>
                        {m.deletedAt ? 'Message deleted' : m.body}
                      </div>
                      {!m.deletedAt && (m.senderId === user?.id || user?.role !== 'student') && (
                        <button
                          className="text-button"
                          onClick={async () => {
                            try {
                              await send(`/messages/${m.id}`, 'DELETE');
                              void qc.invalidateQueries({ queryKey: ['messages', cid] });
                            } catch (e) {
                              setError(e);
                            }
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  !q.error && (
                    <Empty
                      title="Start a conversation"
                      text="Say hello, ask a question, or share an idea."
                    />
                  )
                )}
                {pending && (
                  <div className="message own pending">
                    <div>{pending.body}</div>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => void post(pending.body)}
                    >
                      {pending.status}
                    </button>
                  </div>
                )}
                <div ref={bottom} />
              </div>
              {user?.role === 'admin' ? (
                <p className="chat-readonly">Admin view · Read-only conversation history</p>
              ) : (
                <form
                  className="chat-compose"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void post(body);
                  }}
                >
                  <input
                    aria-label="Your message"
                    placeholder="Share a thought with your class…"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    maxLength={2000}
                  />
                  <button
                    className="button primary"
                    disabled={busy || !body.trim()}
                    aria-label="Send message"
                  >
                    <Send size={18} />
                  </button>
                </form>
              )}
            </>
          ) : (
            <Empty
              title="Your classroom conversations live here"
              text="Join a course to connect with your classmates."
            />
          )}
        </section>
      </div>
    </>
  );
}
export function Complaints() {
  const { user } = useSession(),
    qc = useQueryClient();
  const admin = user?.role === 'admin';
  const [page, setPage] = useState(1),
    [status, setStatus] = useState(''),
    [open, setOpen] = useState(false),
    [detail, setDetail] = useState<any>(null),
    [error, setError] = useState<unknown>(null);
  const q = useQuery({
    queryKey: ['complaints', page, status],
    queryFn: () =>
      api(
        `${admin ? '/admin/complaints' : '/complaints/mine'}?page=${page}${status ? '&status=' + status : ''}`,
      ),
    refetchInterval: 20000,
  });
  const cs = useQuery({
    queryKey: ['course-options'],
    queryFn: () => api('/me/courses?pageSize=100'),
  });
  return (
    <>
      <Title
        eyebrow="WE’RE HERE TO HELP"
        title={admin ? 'Complaint desk' : 'Help & complaints'}
        description={
          admin
            ? 'Listen, respond, and build a better campus experience.'
            : 'Your voice matters. Share a concern with your campus team.'
        }
        action={
          !admin && (
            <button className="button primary" onClick={() => setOpen(true)}>
              <Plus size={17} />
              Raise a complaint
            </button>
          )
        }
      />
      {admin && (
        <div className="toolbar">
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {['open', 'in_review', 'resolved', 'rejected'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
      )}
      <ErrorBox error={q.error || error} />
      {q.isLoading ? (
        <Loading />
      ) : q.data?.data.length ? (
        <div className="panel table-scroll">
          <table>
            <thead>
              <tr>
                <th>Concern</th>
                <th>Category</th>
                <th>Status</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {q.data.data.map((c: any) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.subject}</strong>
                    <small className="block">
                      {c.profiles?.fullName || c.description.slice(0, 70)}
                    </small>
                  </td>
                  <td className="capitalize">{c.category}</td>
                  <td>
                    <Badge
                      tone={
                        c.status === 'resolved'
                          ? 'green'
                          : c.status === 'in_review'
                            ? 'blue'
                            : c.status === 'rejected'
                              ? 'maroon'
                              : 'amber'
                      }
                    >
                      {c.status.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td>{dateTime(c.updatedAt)}</td>
                  <td>
                    <button className="text-button" onClick={() => setDetail(c)}>
                      View details →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !q.error && (
          <Empty
            title="No concerns to show"
            text={
              admin
                ? 'New complaints will arrive here.'
                : 'When you raise a complaint, you can track its progress here.'
            }
          />
        )
      )}
      <Pager page={page} total={q.data?.meta?.total} onPage={setPage} />
      {open && (
        <Modal title="Tell us what’s on your mind" onClose={() => setOpen(false)}>
          <Form
            label="Submit complaint"
            onSubmit={async (f) => {
              let attachmentPath: string | undefined;
              const file = f.get('file') as File;
              if (file?.size)
                attachmentPath = (await upload('complaint-attachments', file)).data.path;
              await send('/complaints', 'POST', {
                subject: value(f, 'subject'),
                description: value(f, 'description'),
                category: value(f, 'category'),
                courseId: value(f, 'courseId') || null,
                ...(attachmentPath ? { attachmentPath } : {}),
              });
              setOpen(false);
              void qc.invalidateQueries({ queryKey: ['complaints'] });
            }}
          >
            <div className="form-grid">
              <Field label="Category">
                <select name="category">
                  {['academic', 'technical', 'facility', 'conduct', 'other'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Related course">
                <select name="courseId">
                  <option value="">General concern</option>
                  {cs.data?.data.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Subject">
              <input name="subject" minLength={3} required />
            </Field>
            <Field label="What happened?">
              <textarea rows={5} name="description" minLength={10} required />
            </Field>
            <Field label="Attachment (optional, up to 10 MB)">
              <input name="file" type="file" accept=".pdf,.docx,.png,.jpg,.webp,.zip" />
            </Field>
          </Form>
        </Modal>
      )}
      {detail && (
        <Modal title={detail.subject} onClose={() => setDetail(null)}>
          <Badge>{detail.status.replace('_', ' ')}</Badge>
          <p className="pre-wrap">{detail.description}</p>
          {detail.attachmentPath && (
            <button
              className="button secondary"
              onClick={() => void download(`/complaints/${detail.id}/attachment`).catch(setError)}
            >
              <Download size={16} />
              Attachment
            </button>
          )}
          {detail.adminResponse && (
            <div className="grade-feedback">
              <strong>Campus team response</strong>
              <p className="pre-wrap">{detail.adminResponse}</p>
            </div>
          )}
          {admin && ['open', 'in_review'].includes(detail.status) && (
            <Form
              label="Update complaint"
              onSubmit={async (f) => {
                await send(`/admin/complaints/${detail.id}`, 'PATCH', {
                  status: value(f, 'status'),
                  adminResponse: value(f, 'response'),
                });
                setDetail(null);
                void qc.invalidateQueries({ queryKey: ['complaints'] });
              }}
            >
              <Field label="Next status">
                <select name="status">
                  {(detail.status === 'open' ? ['in_review'] : ['resolved', 'rejected']).map(
                    (s) => (
                      <option key={s}>{s}</option>
                    ),
                  )}
                </select>
              </Field>
              <Field label="Response">
                <textarea name="response" required={detail.status === 'in_review'} />
              </Field>
            </Form>
          )}
        </Modal>
      )}
    </>
  );
}
