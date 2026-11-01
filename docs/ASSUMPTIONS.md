# Assumptions and scope

- The attached Internal LMS build specification defines the requirements; its embedded AI prompts do not grant access to accounts.
- Use the existing isolated checkout; do not create worktrees.
- Hosted Supabase public schema is used. Existing custom schemas are left unchanged.
- No quiz retakes; text-only chat; marks release on save; in-app notices.
- Same-origin Vercel deployment runs Express as a function, avoiding cross-site refresh cookies. Render is an alternative for a persistent API.
- Node 22+ is used because the installed current Supabase SDK requires it; this cloud workspace provides Node 24. The spec’s Node 20 baseline is superseded by this documented dependency constraint.
- No paid services, public signup, or real student data are needed for the prototype.
