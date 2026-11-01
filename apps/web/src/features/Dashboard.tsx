import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  GraduationCap,
  LifeBuoy,
  Megaphone,
  Sparkles,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, date, Empty, ErrorBox, Loading, Title } from '../components/ui';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
export function Dashboard() {
  const { user } = useSession();
  const admin = user?.role === 'admin';
  const courses = useQuery({
    queryKey: ['courses', 1],
    queryFn: () => api(admin ? '/admin/courses' : '/me/courses'),
  });
  const news = useQuery({ queryKey: ['announcements', 1], queryFn: () => api('/announcements') });
  const people = useQuery({
    queryKey: ['users', 1],
    queryFn: () => api('/admin/users'),
    enabled: admin,
  });
  const support = useQuery({
    queryKey: ['complaints', 1],
    queryFn: () => api(admin ? '/admin/complaints' : '/complaints/mine'),
  });
  const now = new Date();
  const first = user?.fullName.split(' ')[0];
  return (
    <>
      <Title
        eyebrow={now
          .toLocaleDateString(undefined, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
          .toUpperCase()}
        title={`Good ${now.getHours() < 12 ? 'morning' : now.getHours() < 18 ? 'afternoon' : 'evening'}, ${first}.`}
        description={
          admin
            ? 'Here’s what’s happening across your campus.'
            : 'A new day to learn, connect, and move forward.'
        }
        action={
          <span className="term">
            <CalendarDays size={16} /> Academic year 2026–27
          </span>
        }
      />
      <section className="welcome-banner">
        <div>
          <span className="light-tag">
            <Sparkles size={13} /> YOUR CAMPUS, ALL TOGETHER
          </span>
          <h2>
            {admin
              ? 'A connected campus starts here.'
              : user?.role === 'teacher'
                ? 'Inspire the next generation.'
                : 'Your next chapter starts here.'}
          </h2>
          <p>
            {admin
              ? 'Manage your community and keep learning moving forward.'
              : 'Everything you need for your academic journey, in one place.'}
          </p>
          <Link className="button white" to="/courses">
            {admin ? 'Manage courses' : 'Explore your courses'}
            <ArrowRight size={16} />
          </Link>
        </div>
        <div className="banner-art">
          <div className="art-circle">
            <GraduationCap size={72} strokeWidth={1} />
          </div>
          <span className="floating-tag">
            <BookOpen size={15} /> Always learning
          </span>
        </div>
      </section>
      <div className="stats-grid">
        {[
          {
            label: admin ? 'Total courses' : 'My courses',
            value: courses.data?.meta?.total,
            icon: BookOpen,
            tone: 'maroon',
            to: '/courses',
          },
          {
            label: admin ? 'Campus members' : 'Announcements',
            value: admin ? people.data?.meta?.total : news.data?.meta?.total,
            icon: admin ? Users : Megaphone,
            tone: 'blue',
            to: admin ? '/users' : '/announcements',
          },
          {
            label: admin ? 'Announcements' : 'My complaints',
            value: admin ? news.data?.meta?.total : support.data?.meta?.total,
            icon: admin ? Megaphone : LifeBuoy,
            tone: 'amber',
            to: admin ? '/announcements' : '/complaints',
          },
          {
            label: admin ? 'Support requests' : 'Your workspace',
            value: admin
              ? support.data?.meta?.total
              : user?.role === 'teacher'
                ? 'Faculty'
                : 'Student',
            icon: admin ? LifeBuoy : GraduationCap,
            tone: 'green',
            to: admin ? '/complaints' : '/marks',
          },
        ].map((s) => (
          <Link to={s.to} className="stat-card" key={s.label}>
            <div>
              <span className={`stat-icon ${s.tone}`}>
                <s.icon size={20} />
              </span>
              <ArrowUpRight size={17} className="muted" />
            </div>
            <strong>{s.value ?? '—'}</strong>
            <span>{s.label}</span>
          </Link>
        ))}
      </div>
      <div className="dashboard-columns">
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>{admin ? 'Course directory' : 'Your learning space'}</h2>
              <p>
                {admin
                  ? 'Organized for a better academic experience.'
                  : 'Pick up where you left off.'}
              </p>
            </div>
            <Link to="/courses">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <ErrorBox error={courses.error} />
          {courses.isLoading ? (
            <Loading />
          ) : courses.data?.data.length ? (
            <div className="mini-courses">
              {courses.data.data.slice(0, 3).map((c: any, i: number) => (
                <Link to={`/courses/${c.id}`} className="mini-course" key={c.id}>
                  <span className={`course-icon shade-${i % 3}`}>
                    <BookOpen size={23} />
                  </span>
                  <div>
                    <Badge>{c.code}</Badge>
                    <h3>{c.title}</h3>
                    <p>{c.description || 'Your course workspace'}</p>
                  </div>
                  <ArrowUpRight size={18} />
                </Link>
              ))}
            </div>
          ) : (
            !courses.error && (
              <Empty
                title="Your courses start here"
                text={
                  admin
                    ? 'Create a course, assign a teacher, and enroll students.'
                    : 'Your administrator will assign your courses.'
                }
              />
            )
          )}
        </section>
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Campus bulletin</h2>
              <p>The latest from your community.</p>
            </div>
            <span className="status-dot" />
          </div>
          <ErrorBox error={news.error} />
          {news.isLoading ? (
            <Loading />
          ) : news.data?.data.length ? (
            <div className="bulletins">
              {news.data.data.slice(0, 4).map((a: any) => (
                <Link to="/announcements" key={a.id}>
                  <span className="bulletin-icon">
                    <Megaphone size={17} />
                  </span>
                  <div>
                    <div>
                      <Badge tone={a.courseId ? 'blue' : 'maroon'}>
                        {a.courseId ? 'Course update' : 'Campus-wide'}
                      </Badge>
                      <small>{date(a.createdAt)}</small>
                    </div>
                    <h3>{a.title}</h3>
                    <p>{a.body}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            !news.error && (
              <Empty title="All caught up" text="New announcements will appear here." />
            )
          )}
          <Link className="panel-link" to="/announcements">
            All announcements <ArrowRight size={15} />
          </Link>
        </section>
      </div>
      <section className="help-strip">
        <div className="help-icon">
          <LifeBuoy size={25} />
        </div>
        <div>
          <h3>A little help goes a long way.</h3>
          <p>
            {admin
              ? 'Review concerns and keep your campus community supported.'
              : 'Have a question or a concern? Your campus team is here for you.'}
          </p>
        </div>
        <Link className="button secondary" to="/complaints">
          {admin ? 'Open complaint desk' : 'Get support'}
          <ArrowUpRight size={16} />
        </Link>
      </section>
    </>
  );
}
