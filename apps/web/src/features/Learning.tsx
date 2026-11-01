import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  Download,
  FileText,
  Play,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Badge,
  Empty,
  ErrorBox,
  Field,
  Form,
  Loading,
  Modal,
  Pager,
  dateTime,
  value,
} from '../components/ui';
import { api, download, send, upload } from '../lib/api';
import { useSession } from '../lib/session';
function useList(kind: string, courseId: string) {
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: [kind, courseId, page],
    queryFn: () => api(`/courses/${courseId}/${kind}?page=${page}`),
  });
  return { ...q, page, setPage };
}
export function Resources({ courseId }: { courseId: string }) {
  const { user } = useSession(),
    qc = useQueryClient(),
    q = useList('resources', courseId);
  const [open, setOpen] = useState(false),
    [error, setError] = useState<unknown>(null);
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Course resources</h2>
          <p>Your reading, reference and inspiration.</p>
        </div>
        {user?.role !== 'student' && (
          <button className="button primary" onClick={() => setOpen(true)}>
            <Upload size={16} />
            Upload resource
          </button>
        )}
      </div>
      <ErrorBox error={q.error || error} />
      {q.isLoading ? (
        <Loading />
      ) : q.data?.data.length ? (
        <div className="panel">
          {q.data.data.map((r: any) => (
            <div className="resource-row" key={r.id}>
              <span className="file-icon">
                <FileText size={24} />
              </span>
              <div className="grow">
                <h3>{r.title}</h3>
                <p>
                  {r.fileName} · {(r.sizeBytes / 1024 / 1024).toFixed(2)} MB ·{' '}
                  {dateTime(r.createdAt)}
                </p>
                {r.description && <p>{r.description}</p>}
              </div>
              <button
                className="button secondary"
                onClick={() => void download(`/resources/${r.id}/download`).catch(setError)}
              >
                <Download size={15} />
                <span>Download</span>
              </button>
              {(user?.role === 'admin' || r.uploadedBy === user?.id) && (
                <button
                  className="icon-button danger"
                  aria-label="Delete resource"
                  onClick={async () => {
                    if (!confirm('Delete this resource and its file?')) return;
                    try {
                      await send(`/resources/${r.id}`, 'DELETE');
                      void qc.invalidateQueries({ queryKey: ['resources', courseId] });
                    } catch (e) {
                      setError(e);
                    }
                  }}
                >
                  <Trash2 size={17} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        !q.error && (
          <Empty title="Room for new ideas" text="Course materials will be shared here." />
        )
      )}
      <Pager page={q.page} total={q.data?.meta?.total} onPage={q.setPage} />
      {open && (
        <Modal title="Upload a resource" onClose={() => setOpen(false)}>
          <Form
            label="Upload resource"
            onSubmit={async (f) => {
              await api(`/courses/${courseId}/resources`, { method: 'POST', body: f });
              setOpen(false);
              void qc.invalidateQueries({ queryKey: ['resources', courseId] });
            }}
          >
            <Field label="Title">
              <input name="title" required minLength={2} />
            </Field>
            <Field label="Description">
              <textarea name="description" />
            </Field>
            <Field label="File · maximum 25 MB">
              <input
                name="file"
                type="file"
                accept=".pdf,.docx,.pptx,.zip,.png,.jpg,.jpeg,.webp"
                required
              />
            </Field>
            <p className="muted">Private storage. Downloads use short-lived secure links.</p>
          </Form>
        </Modal>
      )}
    </>
  );
}
export function Assignments({ courseId }: { courseId: string }) {
  const { user } = useSession(),
    qc = useQueryClient(),
    q = useList('assignments', courseId);
  const [edit, setEdit] = useState<any>(null),
    [submit, setSubmit] = useState<any>(null),
    [grade, setGrade] = useState<any>(null),
    [error, setError] = useState<unknown>(null);
  const teacher = user?.role !== 'student';
  const [params] = useSearchParams();
  const initialGrade = useRef(false);
  useEffect(() => {
    const target = params.get('grade');
    if (teacher && target && q.data && !initialGrade.current) {
      const item = q.data.data.find((a: any) => a.id === target);
      if (item) {
        setGrade(item);
        initialGrade.current = true;
      }
    }
  }, [params, q.data, teacher]);
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Assignments</h2>
          <p>Small steps. Meaningful progress.</p>
        </div>
        {teacher && (
          <button className="button primary" onClick={() => setEdit({})}>
            <Plus size={16} />
            New assignment
          </button>
        )}
      </div>
      <ErrorBox error={q.error || error} />
      {q.isLoading ? (
        <Loading />
      ) : q.data?.data.length ? (
        <div className="item-grid">
          {q.data.data.map((a: any) => {
            const s = a.submissions?.find((s: any) => s.studentId === user?.id);
            return (
              <article className="panel assignment-card" key={a.id}>
                <div className="card-top">
                  <span className="stat-icon blue">
                    <ClipboardList size={21} />
                  </span>
                  <Badge tone={s?.gradedAt ? 'green' : s ? 'blue' : ''}>
                    {teacher
                      ? `${a.submissions?.length || 0} submissions`
                      : s?.gradedAt
                        ? 'Graded'
                        : s?.isLate
                          ? 'Late'
                          : s
                            ? 'Submitted'
                            : 'Pending'}
                  </Badge>
                </div>
                <h2>{a.title}</h2>
                <p className="pre-wrap">{a.instructions}</p>
                <div className="assignment-meta">
                  <span>
                    <Clock3 size={14} />
                    Due {dateTime(a.dueAt)}
                  </span>
                  <strong>{a.maxMarks} marks</strong>
                </div>
                {s?.gradedAt && (
                  <div className="grade-feedback">
                    <strong>
                      {s.marksObtained} / {a.maxMarks}
                    </strong>
                    <p>{s.feedback}</p>
                  </div>
                )}
                <div className="card-actions">
                  {teacher ? (
                    <>
                      <button className="button primary" onClick={() => setGrade(a)}>
                        Grade work
                      </button>
                      <button className="text-button" onClick={() => setEdit(a)}>
                        Edit
                      </button>
                      <button
                        className="icon-button danger"
                        aria-label="Delete assignment"
                        onClick={async () => {
                          if (!confirm('Delete this assignment and submissions?')) return;
                          try {
                            await send(`/assignments/${a.id}`, 'DELETE');
                            void qc.invalidateQueries({ queryKey: ['assignments', courseId] });
                          } catch (e) {
                            setError(e);
                          }
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                    </>
                  ) : (
                    <button
                      className="button secondary"
                      onClick={() => setSubmit({ ...a, mySubmission: s })}
                    >
                      {s ? 'View / resubmit' : 'Submit assignment'}
                      <Upload size={15} />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        !q.error && (
          <Empty title="A clear assignment list" text="Your next challenge will appear here." />
        )
      )}
      <Pager page={q.page} total={q.data?.meta?.total} onPage={q.setPage} />
      {edit && (
        <Modal title={edit.id ? 'Edit assignment' : 'New assignment'} onClose={() => setEdit(null)}>
          <Form
            onSubmit={async (f) => {
              await send(
                edit.id ? `/assignments/${edit.id}` : `/courses/${courseId}/assignments`,
                edit.id ? 'PATCH' : 'POST',
                {
                  title: value(f, 'title'),
                  instructions: value(f, 'instructions'),
                  maxMarks: Number(f.get('maxMarks')),
                  dueAt: new Date(value(f, 'dueAt')).toISOString(),
                  allowLate: f.get('allowLate') === 'on',
                },
              );
              setEdit(null);
              void qc.invalidateQueries({ queryKey: ['assignments', courseId] });
            }}
          >
            <Field label="Title">
              <input name="title" defaultValue={edit.title} required />
            </Field>
            <Field label="Instructions">
              <textarea name="instructions" defaultValue={edit.instructions} required />
            </Field>
            <div className="form-grid">
              <Field label="Maximum marks">
                <input
                  name="maxMarks"
                  type="number"
                  min="1"
                  max="9999"
                  defaultValue={edit.maxMarks || 100}
                  required
                />
              </Field>
              <Field label="Due date & time">
                <input
                  name="dueAt"
                  type="datetime-local"
                  defaultValue={edit.dueAt ? localDateTime(edit.dueAt) : ''}
                  required
                />
              </Field>
            </div>
            <label className="checkbox">
              <input type="checkbox" name="allowLate" defaultChecked={edit.allowLate} />
              Allow late submissions
            </label>
          </Form>
        </Modal>
      )}
      {submit && (
        <Modal title={submit.title} onClose={() => setSubmit(null)}>
          <p>{submit.instructions}</p>
          <Form
            label="Submit assignment"
            onSubmit={async (f) => {
              const file = f.get('file') as File;
              let filePath = submit.mySubmission?.filePath;
              if (file?.size) filePath = (await upload('submissions', file)).data.path;
              await send(`/assignments/${submit.id}/submission`, 'PUT', {
                textAnswer: value(f, 'textAnswer'),
                filePath: filePath || null,
              });
              setSubmit(null);
              void qc.invalidateQueries({ queryKey: ['assignments', courseId] });
            }}
          >
            <Field label="Your answer">
              <textarea name="textAnswer" rows={6} defaultValue={submit.mySubmission?.textAnswer} />
            </Field>
            <Field label="Attachment (optional, up to 25 MB)">
              <input name="file" type="file" accept=".pdf,.docx,.pptx,.zip,.png,.jpg,.webp" />
            </Field>
            <p className="muted">Resubmitting replaces your work and clears any previous grade.</p>
          </Form>
        </Modal>
      )}
      {grade && <Grading assignment={grade} onClose={() => setGrade(null)} />}
    </>
  );
}
function Grading({ assignment, onClose }: { assignment: any; onClose: () => void }) {
  const [page, setPage] = useState(1),
    [error, setError] = useState<unknown>(null);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['submissions', assignment.id, page],
    queryFn: () => api(`/assignments/${assignment.id}/submissions?page=${page}`),
  });
  return (
    <Modal title={`Grade · ${assignment.title}`} onClose={onClose}>
      <ErrorBox error={q.error || error} />
      {q.isLoading ? (
        <Loading />
      ) : q.data?.data.length ? (
        q.data.data.map((s: any) => (
          <div className="grading-item" key={s.id}>
            <h3>{s.student?.fullName || 'Student'}</h3>
            <p className="pre-wrap">{s.textAnswer || 'File submission'}</p>
            <Badge tone={s.isLate ? 'amber' : 'green'}>{s.isLate ? 'Late' : 'On time'}</Badge>
            {s.filePath && (
              <button
                className="text-button"
                onClick={() => void download(`/submissions/${s.id}/download`).catch(setError)}
              >
                Download attachment
              </button>
            )}
            <Form
              label="Save grade"
              onSubmit={async (f) => {
                await send(`/submissions/${s.id}/grade`, 'PATCH', {
                  marks: Number(f.get('marks')),
                  feedback: value(f, 'feedback'),
                });
                void qc.invalidateQueries({ queryKey: ['submissions', assignment.id] });
                void qc.invalidateQueries({ queryKey: ['assignments'] });
              }}
            >
              <Field label={`Marks (0–${assignment.maxMarks})`}>
                <input
                  name="marks"
                  type="number"
                  min="0"
                  max={assignment.maxMarks}
                  step="0.01"
                  defaultValue={s.marksObtained ?? ''}
                  required
                />
              </Field>
              <Field label="Feedback">
                <textarea name="feedback" defaultValue={s.feedback} />
              </Field>
            </Form>
          </div>
        ))
      ) : (
        !q.error && <Empty title="No submissions yet" />
      )}
      <Pager page={page} total={q.data?.meta?.total} onPage={setPage} />
    </Modal>
  );
}
export function localDateTime(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function Quizzes({ courseId }: { courseId: string }) {
  const { user } = useSession(),
    qc = useQueryClient(),
    q = useList('quizzes', courseId);
  const [builder, setBuilder] = useState<any>(null),
    [attempt, setAttempt] = useState<any>(null),
    [results, setResults] = useState<any>(null),
    [error, setError] = useState<unknown>(null);
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Quizzes</h2>
          <p>Put your understanding into practice.</p>
        </div>
        {user?.role !== 'student' && (
          <button className="button primary" onClick={() => setBuilder({})}>
            <Plus size={16} />
            Build a quiz
          </button>
        )}
      </div>
      <ErrorBox error={q.error || error} />
      {q.isLoading ? (
        <Loading />
      ) : q.data?.data.length ? (
        <div className="item-grid">
          {q.data.data.map((quiz: any) => {
            const a = quiz.quizAttempts?.find((a: any) => a.studentId === user?.id);
            return (
              <article className="panel assignment-card" key={quiz.id}>
                <div className="card-top">
                  <span className="stat-icon amber">
                    <Clock3 size={21} />
                  </span>
                  <Badge tone={quiz.isPublished ? 'green' : ''}>
                    {quiz.isPublished ? 'Published' : 'Draft'}
                  </Badge>
                </div>
                <h2>{quiz.title}</h2>
                <p>{quiz.description}</p>
                <div className="assignment-meta">
                  <span>{quiz.timeLimitMinutes} minutes · One attempt</span>
                </div>
                <p className="muted">
                  {dateTime(quiz.opensAt)} — {dateTime(quiz.closesAt)}
                </p>
                {a?.submittedAt ? (
                  <div className="success">
                    Your score: <strong>{a.score}</strong>
                  </div>
                ) : user?.role === 'student' ? (
                  <button
                    className="button primary"
                    onClick={async () => {
                      try {
                        const r = await send(`/quizzes/${quiz.id}/attempt`, 'POST');
                        setAttempt({ ...r.data, quiz });
                      } catch (e) {
                        setError(e);
                      }
                    }}
                  >
                    <Play size={16} />
                    {a ? 'Resume quiz' : 'Start quiz'}
                  </button>
                ) : (
                  <div className="card-actions">
                    <button
                      className="text-button"
                      onClick={async () => {
                        try {
                          const r = await api(`/quizzes/${quiz.id}/editor`);
                          setBuilder(r.data);
                        } catch (e) {
                          setError(e);
                        }
                      }}
                    >
                      Edit quiz
                    </button>
                    <button className="button secondary" onClick={() => setResults(quiz)}>
                      View results
                    </button>
                    <button
                      className="text-button"
                      onClick={async () => {
                        try {
                          await send(`/quizzes/${quiz.id}`, 'PATCH', {
                            isPublished: !quiz.isPublished,
                          });
                          void qc.invalidateQueries({ queryKey: ['quizzes', courseId] });
                        } catch (e) {
                          setError(e);
                        }
                      }}
                    >
                      {quiz.isPublished ? 'Unpublish' : 'Publish'}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        !q.error && <Empty title="Ready when you are" text="Published quizzes will appear here." />
      )}
      <Pager page={q.page} total={q.data?.meta?.total} onPage={q.setPage} />
      {builder && (
        <QuizBuilder courseId={courseId} initialQuiz={builder} onClose={() => setBuilder(null)} />
      )}{' '}
      {attempt && (
        <QuizRunner
          attempt={attempt}
          onClose={() => {
            setAttempt(null);
            void qc.invalidateQueries({ queryKey: ['quizzes', courseId] });
          }}
        />
      )}
      {results && <QuizResults quiz={results} onClose={() => setResults(null)} />}
    </>
  );
}
function QuizBuilder({
  courseId,
  initialQuiz,
  onClose,
}: {
  courseId: string;
  initialQuiz: any;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [questions, setQuestions] = useState<
    { prompt: string; type: string; options: string[]; correct: number[]; marks: number }[]
  >(
    initialQuiz.questions?.map((q: any) => ({
      prompt: q.prompt,
      type: q.type,
      options: q.options.map((o: any) => o.text),
      correct: q.options
        .map((o: any, i: number) =>
          (q.quizAnswers?.correctOptionIds || []).includes(o.id) ? i : -1,
        )
        .filter((i: number) => i >= 0),
      marks: Number(q.marks),
    })) || [{ prompt: '', type: 'mcq_single', options: ['', ''], correct: [0], marks: 1 }],
  );
  return (
    <Modal title="Build a quiz" onClose={onClose}>
      <Form
        label={initialQuiz.id ? 'Save quiz' : 'Create quiz'}
        onSubmit={async (f) => {
          await send(
            initialQuiz.id ? `/quizzes/${initialQuiz.id}` : `/courses/${courseId}/quizzes`,
            initialQuiz.id ? 'PATCH' : 'POST',
            {
              title: value(f, 'title'),
              description: value(f, 'description'),
              timeLimitMinutes: Number(f.get('minutes')),
              opensAt: new Date(value(f, 'opensAt')).toISOString(),
              closesAt: new Date(value(f, 'closesAt')).toISOString(),
              isPublished: f.get('published') === 'on',
              questions: questions.map((q, i) => ({
                position: i,
                type: q.type,
                prompt: q.prompt,
                marks: q.marks,
                options: q.options.map((text, j) => ({ id: String(j), text })),
                correctOptionIds: q.correct.map(String),
              })),
            },
          );
          onClose();
          void qc.invalidateQueries({ queryKey: ['quizzes', courseId] });
        }}
      >
        <Field label="Quiz title">
          <input name="title" defaultValue={initialQuiz.title} required />
        </Field>
        <Field label="Description">
          <textarea name="description" defaultValue={initialQuiz.description} />
        </Field>
        <div className="form-grid">
          <Field label="Opens">
            <input
              name="opensAt"
              type="datetime-local"
              defaultValue={initialQuiz.opensAt ? localDateTime(initialQuiz.opensAt) : undefined}
              required
            />
          </Field>
          <Field label="Closes">
            <input
              name="closesAt"
              type="datetime-local"
              defaultValue={initialQuiz.closesAt ? localDateTime(initialQuiz.closesAt) : undefined}
              required
            />
          </Field>
        </div>
        <Field label="Time limit (minutes)">
          <input
            name="minutes"
            type="number"
            min="1"
            max="240"
            defaultValue={initialQuiz.timeLimitMinutes || 15}
            required
          />
        </Field>
        {questions.map((q, i) => (
          <div className="question-builder" key={i}>
            <div className="section-heading">
              <h3>Question {i + 1}</h3>
              {questions.length > 1 && (
                <button
                  type="button"
                  className="text-button danger"
                  onClick={() => setQuestions(questions.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              )}
            </div>
            <Field label="Question">
              <textarea
                value={q.prompt}
                onChange={(e) => {
                  q.prompt = e.target.value;
                  setQuestions([...questions]);
                }}
                required
              />
            </Field>
            <div className="form-grid">
              <Field label="Type">
                <select
                  value={q.type}
                  onChange={(e) => {
                    q.type = e.target.value;
                    q.correct = [0];
                    if (q.type === 'true_false') q.options = ['True', 'False'];
                    setQuestions([...questions]);
                  }}
                >
                  <option value="mcq_single">Single answer</option>
                  <option value="mcq_multi">Multiple answers</option>
                  <option value="true_false">True / False</option>
                </select>
              </Field>
              <Field label="Marks">
                <input
                  type="number"
                  min="1"
                  value={q.marks}
                  onChange={(e) => {
                    q.marks = Number(e.target.value);
                    setQuestions([...questions]);
                  }}
                  required
                />
              </Field>
            </div>
            <p className="muted">Tick the correct answer{q.type === 'mcq_multi' ? 's' : ''}.</p>
            {q.options.map((o, j) => (
              <div className="option-builder" key={j}>
                <input
                  aria-label={`Option ${j + 1} is correct`}
                  type={q.type === 'mcq_multi' ? 'checkbox' : 'radio'}
                  name={`correct-${i}`}
                  checked={q.correct.includes(j)}
                  onChange={() => {
                    q.correct =
                      q.type === 'mcq_multi'
                        ? q.correct.includes(j)
                          ? q.correct.filter((x) => x !== j)
                          : [...q.correct, j]
                        : [j];
                    setQuestions([...questions]);
                  }}
                />
                <input
                  aria-label={`Answer option ${j + 1}`}
                  value={o}
                  required
                  onChange={(e) => {
                    q.options[j] = e.target.value;
                    setQuestions([...questions]);
                  }}
                />
              </div>
            ))}
            {q.type !== 'true_false' && q.options.length < 10 && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  q.options.push('');
                  setQuestions([...questions]);
                }}
              >
                + Add option
              </button>
            )}
            <div className="card-actions">
              {i > 0 && (
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    [questions[i - 1], questions[i]] = [questions[i], questions[i - 1]];
                    setQuestions([...questions]);
                  }}
                >
                  Move up
                </button>
              )}
            </div>
          </div>
        ))}
        <button
          className="button secondary"
          type="button"
          onClick={() =>
            setQuestions([
              ...questions,
              { prompt: '', type: 'mcq_single', options: ['', ''], correct: [0], marks: 1 },
            ])
          }
        >
          <Plus size={16} />
          Add question
        </button>
        <label className="checkbox">
          <input type="checkbox" name="published" defaultChecked={initialQuiz.isPublished} />
          Publish immediately
        </label>
      </Form>
    </Modal>
  );
}
function QuizRunner({ attempt, onClose }: { attempt: any; onClose: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string[]>>({}),
    [remaining, setRemaining] = useState(
      Math.max(0, Math.ceil((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000)),
    ),
    [error, setError] = useState<unknown>(null),
    [result, setResult] = useState<any>(null),
    [busy, setBusy] = useState(false);
  const answersRef = useRef(answers),
    submitted = useRef(false);
  answersRef.current = answers;
  const finish = async () => {
    if (submitted.current) return;
    submitted.current = true;
    setBusy(true);
    try {
      const r = await send(`/quizzes/${attempt.quiz.id}/attempt/submit`, 'POST', {
        answers: answersRef.current,
      });
      setResult(r.data);
    } catch (e) {
      setError(e);
      submitted.current = false;
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const t = setInterval(
      () =>
        setRemaining(
          Math.max(0, Math.ceil((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000)),
        ),
      1000,
    );
    return () => clearInterval(t);
  }, [attempt.expiresAt]);
  useEffect(() => {
    if (remaining === 0 && !submitted.current) void finish();
  }, [remaining]);
  return (
    <Modal title={attempt.quiz.title} onClose={onClose}>
      {result ? (
        <div className="state">
          <CheckCircle2 size={45} className="green-text" />
          <h2>Quiz complete!</h2>
          <p>
            You scored <strong>{result.score}</strong> marks.
          </p>
          <button className="button primary" onClick={onClose}>
            Back to course
          </button>
        </div>
      ) : (
        <>
          <div className="quiz-timer">
            <Clock3 size={18} />
            Time remaining{' '}
            <strong>
              {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
            </strong>
          </div>
          <div className="question-nav">
            {attempt.questions.map((q: any, i: number) => (
              <a
                className={answers[q.id]?.length ? 'answered' : ''}
                href={`#question-${q.id}`}
                key={q.id}
              >
                {i + 1}
              </a>
            ))}
          </div>
          {attempt.questions.map((q: any, i: number) => (
            <section className="question-builder" id={`question-${q.id}`} key={q.id}>
              <Badge>{q.marks} marks</Badge>
              <h3>
                {i + 1}. {q.prompt}
              </h3>
              {q.options.map((o: any) => (
                <label className="quiz-option" key={o.id}>
                  <input
                    type={q.type === 'mcq_multi' ? 'checkbox' : 'radio'}
                    name={q.id}
                    checked={(answers[q.id] || []).includes(o.id)}
                    onChange={() =>
                      setAnswers({
                        ...answers,
                        [q.id]:
                          q.type === 'mcq_multi'
                            ? (answers[q.id] || []).includes(o.id)
                              ? answers[q.id].filter((x) => x !== o.id)
                              : [...(answers[q.id] || []), o.id]
                            : [o.id],
                      })
                    }
                  />
                  {o.text}
                </label>
              ))}
            </section>
          ))}
          <ErrorBox error={error} />
          <button
            className="button primary"
            disabled={busy}
            onClick={() => {
              if (confirm('Submit your answers? You cannot retake this quiz.')) void finish();
            }}
          >
            {busy ? 'Submitting…' : 'Submit quiz'}
          </button>
        </>
      )}
    </Modal>
  );
}
function QuizResults({ quiz, onClose }: { quiz: any; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['quiz-results', quiz.id, page],
    queryFn: () => api(`/quizzes/${quiz.id}/results?page=${page}`),
  });
  return (
    <Modal title={`Results · ${quiz.title}`} onClose={onClose}>
      <ErrorBox error={q.error} />
      {q.isLoading ? (
        <Loading />
      ) : q.data?.data.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {q.data.data.map((a: any) => (
                <tr key={a.id}>
                  <td>{a.student?.fullName || 'Student'}</td>
                  <td>{a.score ?? 'Pending'}</td>
                  <td>{a.submittedAt ? 'Submitted' : 'In progress'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !q.error && <Empty title="No attempts yet" />
      )}
      <Pager page={page} total={q.data?.meta?.total} onPage={setPage} />
    </Modal>
  );
}
