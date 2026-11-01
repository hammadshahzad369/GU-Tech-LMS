import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpRight, BookOpen, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
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
import { api, send } from '../lib/api';
import { useSession } from '../lib/session';
import { Assignments, Quizzes, Resources } from './Learning';
export function Courses() {
  const { user } = useSession(),
    qc = useQueryClient();
  const admin = user?.role === 'admin';
  const [page, setPage] = useState(1),
    [edit, setEdit] = useState<any>(null),
    [search, setSearch] = useState('');
  const q = useQuery({
    queryKey: ['courses', page],
    queryFn: () => api(`${admin ? '/admin/courses' : '/me/courses'}?page=${page}`),
  });
  return (
    <>
      <Title
        eyebrow="ACADEMICS"
        title={admin ? 'Course directory' : user?.role === 'teacher' ? 'My classes' : 'My courses'}
        description="A space for every subject. A place to grow."
        action={
          admin && (
            <button className="button primary" onClick={() => setEdit({})}>
              <Plus size={17} />
              Create course
            </button>
          )
        }
      />
      <div className="toolbar">
        <input
          aria-label="Filter courses on this page"
          className="search-input"
          placeholder="Filter this page by course name or code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span>{q.data?.meta?.total ?? '—'} courses</span>
      </div>
      <ErrorBox error={q.error} />
      {q.isLoading ? (
        <Loading />
      ) : q.data?.data.length ? (
        <div className="course-grid">
          {q.data.data
            .filter((c: any) =>
              (c.title + ' ' + c.code).toLowerCase().includes(search.toLowerCase()),
            )
            .map((c: any, i: number) => (
              <article className="course-card" key={c.id}>
                <div className={`course-cover shade-${i % 3}`}>
                  <BookOpen size={40} strokeWidth={1.3} />
                  <span>{c.code}</span>
                  <span className="cover-number">0{i + 1}</span>
                </div>
                <div className="course-card-body">
                  <Badge tone={c.isArchived ? '' : 'green'}>
                    {c.isArchived ? 'Archived' : 'Active course'}
                  </Badge>
                  <h2>{c.title}</h2>
                  <p>{c.description || 'Resources, assignments, conversations and more.'}</p>
                  <div className="course-card-bottom">
                    <Link to={`/courses/${c.id}`}>
                      Open course <ArrowUpRight size={17} />
                    </Link>
                    {admin && (
                      <button className="text-button" onClick={() => setEdit(c)}>
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
        </div>
      ) : (
        !q.error && (
          <Empty
            title="No courses yet"
            text={
              admin
                ? 'Create your first course to get started.'
                : 'Your assigned courses will appear here.'
            }
          />
        )
      )}
      <Pager page={page} total={q.data?.meta?.total} onPage={setPage} />
      {edit && (
        <Modal title={edit.id ? 'Edit course' : 'Create a course'} onClose={() => setEdit(null)}>
          <Form
            label={edit.id ? 'Save course' : 'Create course'}
            onSubmit={async (f) => {
              await send(
                edit.id ? `/admin/courses/${edit.id}` : '/admin/courses',
                edit.id ? 'PATCH' : 'POST',
                {
                  code: value(f, 'code'),
                  title: value(f, 'title'),
                  description: value(f, 'description'),
                  isArchived: f.get('archived') === 'on',
                },
              );
              setEdit(null);
              void qc.invalidateQueries({ queryKey: ['courses'] });
            }}
          >
            <Field label="Course code">
              <input name="code" defaultValue={edit.code} placeholder="CS101" required />
            </Field>
            <Field label="Course title">
              <input
                name="title"
                defaultValue={edit.title}
                placeholder="Introduction to Computing"
                required
              />
            </Field>
            <Field label="Description">
              <textarea name="description" defaultValue={edit.description} />
            </Field>
            {edit.id && (
              <label className="checkbox">
                <input name="archived" type="checkbox" defaultChecked={edit.isArchived} />
                Archive this course
              </label>
            )}
          </Form>
        </Modal>
      )}
    </>
  );
}
export function CourseDetail() {
  const { id = '' } = useParams(),
    { user } = useSession();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') || 'resources');
  const q = useQuery({ queryKey: ['course', id], queryFn: () => api(`/courses/${id}`) });
  return (
    <>
      <Link className="back-link" to="/courses">
        <ArrowLeft size={15} />
        All courses
      </Link>
      <ErrorBox error={q.error} />
      {q.isLoading ? (
        <Loading />
      ) : (
        q.data && (
          <>
            <Title
              eyebrow={q.data.data.code}
              title={q.data.data.title}
              description={q.data.data.description}
            />
            <div className="tabs" role="tablist">
              {[
                'resources',
                'assignments',
                'quizzes',
                ...(user?.role === 'admin' ? ['members'] : []),
              ].map((t) => (
                <button
                  role="tab"
                  aria-selected={tab === t}
                  className={tab === t ? 'active' : ''}
                  onClick={() => setTab(t)}
                  key={t}
                >
                  {t}
                </button>
              ))}
            </div>
            {tab === 'resources' ? (
              <Resources courseId={id} />
            ) : tab === 'assignments' ? (
              <Assignments courseId={id} />
            ) : tab === 'quizzes' ? (
              <Quizzes courseId={id} />
            ) : (
              <Members courseId={id} />
            )}
          </>
        )
      )}
    </>
  );
}
function Members({ courseId }: { courseId: string }) {
  const qc = useQueryClient(),
    [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['members', courseId, page],
    queryFn: () => api(`/admin/courses/${courseId}/members?page=${page}`),
  });
  const users = useQuery({
    queryKey: ['member-options', page],
    queryFn: () => api(`/admin/users?page=${page}&pageSize=100`),
  });
  return (
    <section className="panel padded">
      <h2>Course membership</h2>
      <ErrorBox error={q.error || users.error} />
      {q.isLoading || users.isLoading ? (
        <Loading />
      ) : (
        <>
          <Form
            label="Replace assigned teachers with selection"
            onSubmit={async (f) => {
              await send(`/admin/courses/${courseId}/teachers`, 'PUT', {
                teacherIds: f.getAll('teachers'),
              });
              void qc.invalidateQueries({ queryKey: ['members', courseId] });
            }}
          >
            <Field label="Choose teachers (Ctrl/Cmd + click for multiple)">
              <select
                name="teachers"
                multiple
                defaultValue={(q.data?.data.teachers || []).map((x: any) => x.teacherId)}
              >
                {users.data?.data
                  .filter((u: any) => u.role === 'teacher')
                  .map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName}
                    </option>
                  ))}
              </select>
            </Field>
          </Form>
          <hr />
          <Form
            label="Enroll selected students"
            onSubmit={async (f) => {
              await send(`/admin/courses/${courseId}/enrollments`, 'POST', {
                studentIds: f.getAll('students'),
              });
              void qc.invalidateQueries({ queryKey: ['members', courseId] });
            }}
          >
            <Field label="Choose students (Ctrl/Cmd + click for multiple)">
              <select name="students" multiple required>
                {users.data?.data
                  .filter((u: any) => u.role === 'student')
                  .map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} · {u.email}
                    </option>
                  ))}
              </select>
            </Field>
          </Form>
          <CsvEnrollment courseId={courseId} />
          <h3>Enrolled students</h3>
          {q.data?.data.students?.map((s: any) => (
            <div className="list-row" key={s.studentId}>
              <span>{s.profiles?.fullName || s.studentId}</span>
              <button
                className="text-button danger"
                onClick={async () => {
                  try {
                    await send(`/admin/courses/${courseId}/enrollments/${s.studentId}`, 'DELETE');
                    void qc.invalidateQueries({ queryKey: ['members', courseId] });
                  } catch (e) {
                    alert(e instanceof Error ? e.message : 'Could not remove student.');
                  }
                }}
              >
                Unenroll
              </button>
            </div>
          ))}
          <Pager
            page={page}
            total={Math.max(q.data?.meta?.total || 0, users.data?.meta?.total || 0)}
            onPage={setPage}
          />
        </>
      )}
    </section>
  );
}

function CsvEnrollment({ courseId }: { courseId: string }) {
  const qc = useQueryClient(),
    [preview, setPreview] = useState<any>(null),
    [file, setFile] = useState<File | null>(null);
  return (
    <div className="csv-import">
      <hr />
      <h3>Bulk enrollment by CSV</h3>
      <p className="muted">CSV must contain an email header. Up to 100 students per import.</p>
      <Form
        label={preview ? 'Import matched students' : 'Preview CSV'}
        onSubmit={async () => {
          if (!file) throw new Error('Choose a CSV file.');
          const f = new FormData();
          f.append('file', file);
          f.append('preview', preview ? 'false' : 'true');
          const r = await api(`/admin/courses/${courseId}/enrollments/csv`, {
            method: 'POST',
            body: f,
          });
          if (preview) {
            setPreview(null);
            setFile(null);
            void qc.invalidateQueries({ queryKey: ['members', courseId] });
          } else setPreview(r.data);
        }}
      >
        <Field label="CSV file">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setPreview(null);
            }}
          />
        </Field>
        {preview && (
          <div className="grade-feedback">
            <strong>{preview.matched.length} matching students</strong>
            <p>{preview.matched.map((x: any) => x.fullName).join(', ')}</p>
            <p>Unmatched emails: {preview.unmatched.join(', ') || 'None'}</p>
          </div>
        )}
      </Form>
    </div>
  );
}
