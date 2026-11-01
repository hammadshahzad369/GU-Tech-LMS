import * as Dialog from '@radix-ui/react-dialog';
import { AlertCircle, ChevronLeft, ChevronRight, Inbox, LoaderCircle, X } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
export function Loading() {
  return (
    <div className="state">
      <LoaderCircle className="spin" size={26} />
      <p>Loading your campus…</p>
    </div>
  );
}
export function ErrorBox({ error }: { error: unknown }) {
  return error ? (
    <div className="error" role="alert">
      <AlertCircle size={18} />
      {error instanceof Error ? error.message : String(error)}
    </div>
  ) : null;
}
export function Empty({
  title = 'Nothing here yet',
  text = 'New items will appear here when they are added.',
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="state empty">
      <Inbox size={34} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function Badge({ children, tone = '' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-backdrop" />
        <Dialog.Content className="modal dialog-content" aria-describedby={undefined}>
          <header>
            <Dialog.Title asChild>
              <h2>{title}</h2>
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="icon-button" aria-label="Close dialog">
                <X />
              </button>
            </Dialog.Close>
          </header>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Form({
  onSubmit,
  children,
  label = 'Save changes',
}: {
  onSubmit: (form: FormData) => Promise<unknown>;
  children: ReactNode;
  label?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  return (
    <form
      onSubmit={async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        try {
          await onSubmit(data);
        } catch (e) {
          setError(e);
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      <ErrorBox error={error} />
      <button className="button primary submit" disabled={busy}>
        {busy ? (
          <>
            <LoaderCircle size={17} className="spin" />
            Working…
          </>
        ) : (
          label
        )}
      </button>
    </form>
  );
}
export function Pager({
  page,
  total = 0,
  onPage,
}: {
  page: number;
  total?: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="pager">
      <span>
        {total} items · Page {page}
      </span>
      <button disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
        <ChevronLeft size={17} />
      </button>
      <button disabled={page * 20 >= total} onClick={() => onPage(page + 1)} aria-label="Next page">
        <ChevronRight size={17} />
      </button>
    </div>
  );
}
export function Title({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export const value = (f: FormData, k: string) => String(f.get(k) || '');
export const date = (x: string) =>
  new Date(x).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
export const dateTime = (x: string) =>
  new Date(x).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
