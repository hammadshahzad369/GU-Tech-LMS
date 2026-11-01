import { test, expect } from '@playwright/test';
const cid = '20000000-0000-4000-8000-000000000001';
for (const role of ['admin', 'teacher', 'student'])
  test(`${role} dashboard and course flow`, async ({ page }) => {
    let loggedIn = false;
    const calls: any[] = [];
    const profile = {
      id: '10000000-0000-4000-8000-000000000001',
      fullName:
        role === 'admin' ? 'Campus Admin' : role === 'teacher' ? 'Dr. Ayesha Khan' : 'Ahmed Raza',
      email: `${role}@test.dev`,
      role,
      mustChangePassword: false,
    };
    const courses = [
      {
        id: cid,
        code: 'CS101',
        title: 'Introduction to Computing',
        description: 'Build strong foundations in computing, algorithms, and problem solving.',
        isArchived: false,
      },
      {
        id: '20000000-0000-4000-8000-000000000002',
        code: 'CS201',
        title: 'Database Systems',
        description: 'Explore relational models, SQL and modern applications.',
      },
      {
        id: '20000000-0000-4000-8000-000000000003',
        code: 'MA101',
        title: 'Applied Mathematics',
        description: 'Connect mathematical thinking to engineering.',
      },
    ];
    await page.route('**/api/**', async (route) => {
      const req = route.request(),
        url = new URL(req.url()),
        path = url.pathname.replace('/api', '');
      calls.push({ path, method: req.method(), body: req.postDataJSON() });
      let data: any = [],
        status = 200,
        meta: any = { page: 1, pageSize: 20, total: 0 };
      if (path === '/auth/refresh') {
        status = loggedIn ? 200 : 401;
        data = loggedIn ? { accessToken: 'test-token', profile } : null;
      } else if (path === '/auth/login') {
        loggedIn = true;
        data = { accessToken: 'test-token', profile };
      } else if (path === '/me/courses' || path === '/admin/courses') {
        data = courses;
        meta.total = 3;
      } else if (path === `/courses/${cid}`) {
        data = courses[0];
      } else if (path === '/announcements') {
        data = [
          {
            id: 'n1',
            title: 'Welcome to your connected campus',
            body: 'Your courses, resources and classroom conversations are now together in one place.',
            isPinned: true,
            isRead: false,
            createdAt: new Date().toISOString(),
          },
        ];
        meta.total = 1;
      } else if (path.includes('/assignments')) {
        if (path.endsWith('/submissions')) {
          data = [
            {
              id: 's1',
              student: { fullName: 'Ahmed Raza' },
              textAnswer: 'A computer processes information.',
              isLate: false,
            },
          ];
        } else {
          data = [
            {
              id: 'a1',
              title: 'Computing fundamentals',
              instructions: 'Explain one key concept and give an example.',
              dueAt: new Date(Date.now() + 86400000).toISOString(),
              maxMarks: 20,
              submissions: [],
            },
          ];
        }
        meta.total = 1;
      } else if (path === '/admin/users') {
        data = req.method() === 'POST' ? { id: 'new', ...req.postDataJSON() } : [profile];
        meta.total = 1;
      } else if (path.endsWith('/grade') || path.endsWith('/submission')) {
        data = { ok: true };
      } else if (path === '/auth/logout') {
        loggedIn = false;
        data = { ok: true };
      }
      await route.fulfill({
        status,
        json:
          status === 401
            ? { error: { code: 'UNAUTHORIZED', message: 'Please log in.' } }
            : { data, meta },
      });
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
    await page.getByLabel('University email').fill(`${role}@test.dev`);
    await page.getByLabel('Password', { exact: true }).fill('TestPassword123!');
    await page.getByRole('button', { name: 'Sign in to portal' }).click();
    await expect(
      page.getByRole('heading', { name: new RegExp(`Good .*${profile.fullName.split(' ')[0]}`) }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Campus bulletin' })).toBeVisible();
    if (role === 'admin') {
      await page.screenshot({ path: '/tmp/gutech-admin-dashboard.png', fullPage: true });
      await page.getByRole('link', { name: 'User management' }).click();
      await page.getByRole('button', { name: 'Create account' }).click();
      await page.getByLabel('Full name').fill('New Student');
      await page.getByLabel('Email', { exact: true }).fill('new@test.dev');
      await page.getByLabel('Temporary password').fill('NewPassword123!');
      await page.getByRole('button', { name: 'Create account', exact: true }).last().click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(
        calls.some(
          (c) =>
            c.path === '/admin/users' && c.method === 'POST' && c.body.fullName === 'New Student',
        ),
      ).toBe(true);
    } else {
      await page
        .getByRole('link', { name: role === 'teacher' ? 'My classes' : 'Courses', exact: true })
        .click();
      await page.getByRole('link', { name: 'Open course' }).first().click();
      await page.getByRole('tab', { name: 'assignments' }).click();
      await expect(page.getByRole('heading', { name: 'Computing fundamentals' })).toBeVisible();
      if (role === 'student') {
        await page.getByRole('button', { name: 'Submit assignment' }).click();
        await page.getByLabel('Your answer').fill('My assignment answer');
        await page.getByRole('dialog').getByRole('button', { name: 'Submit assignment' }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        expect(
          calls.some(
            (c) =>
              c.path === '/assignments/a1/submission' &&
              c.body.textAnswer === 'My assignment answer',
          ),
        ).toBe(true);
      } else {
        await page.getByRole('button', { name: 'Grade work' }).click();
        await page.getByLabel('Marks (0–20)').fill('16');
        await page.getByLabel('Feedback').fill('Good work');
        await page.getByRole('button', { name: 'Save grade' }).click();
        await expect
          .poll(() => calls.some((c) => c.path === '/submissions/s1/grade' && c.body.marks === 16))
          .toBe(true);
      }
    }
  });
test('mobile login fits a 360px viewport and unknown pages are handled', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.route('**/api/auth/refresh', (r) =>
    r.fulfill({ status: 401, json: { error: { message: 'Log in' } } }),
  );
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: '/tmp/gutech-mobile-login.png', fullPage: true });
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: '404 · Page not found' })).toBeVisible();
});
