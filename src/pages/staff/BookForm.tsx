import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  BookText,
  ChevronLeft,
  ChevronRight,
  Copy as CopyIcon,
  FileText,
  MapPin,
  Building2,
  Ruler,
  Save,
  Tags,
  RotateCcw,
} from "lucide-react";
import { useActions, copiesOf, bookOf } from "../../lib/actions";
import {
  Alert,
  Btn,
  Card,
  EmptyState,
  cx,
  useConfirm,
} from "../../components/ui";
import { uid } from "../../lib/types";
import {
  ADD_TABS,
  EDIT_TABS,
  TAB_META,
  clearTab,
  emptyForm,
  formFromBook,
  planCopies,
  tabErrors,
  tabOf,
  tabStatus,
  toBook,
  validate,
  type FormState,
  type TabId,
} from "./book-form/model";
import {
  AbstractTab,
  AccessTab,
  DescriptionTab,
  TitleTab,
} from "./book-form/SimpleTabs";
import LocalTab from "./book-form/LocalTab";
import PublicationTab from "./book-form/PublicationTab";
import CopiesTab from "./book-form/CopiesTab";

const DRAFT_KEY = "nbs-addbook-draft-v1";
const ICONS: Record<TabId, typeof BookText> = {
  title: BookText,
  access: Tags,
  abstract: FileText,
  description: Ruler,
  local: MapPin,
  pub: Building2,
  copies: CopyIcon,
};
const DOT = {
  red: "bg-red-500",
  yellow: "bg-amber-400",
  green: "bg-emerald-500",
};
const DOT_LABEL = {
  red: "Required information missing",
  yellow: "Required complete, optional details missing",
  green: "Complete",
};

export default function BookForm({ mode }: { mode: "add" | "edit" }) {
  const a = useActions();
  const { s } = a;
  const { id } = useParams();
  const nav = useNavigate();
  const confirm = useConfirm();
  const book = mode === "edit" ? bookOf(s, id ?? "") : undefined;
  if (mode === "edit" && !book)
    return (
      <EmptyState
        title="Book not found"
        action={
          <Link to="/staff/catalog" className="font-bold text-brand">
            Back to catalog
          </Link>
        }
      />
    );
  return (
    <Editor
      key={id ?? "new"}
      mode={mode}
      bookId={book?.id}
      a={a}
      nav={nav}
      confirm={confirm}
    />
  );
}

function Editor({
  mode,
  bookId,
  a,
  nav,
  confirm,
}: {
  mode: "add" | "edit";
  bookId?: string;
  a: ReturnType<typeof useActions>;
  nav: ReturnType<typeof useNavigate>;
  confirm: ReturnType<typeof useConfirm>;
}) {
  const { s } = a;
  const tabs = mode === "add" ? ADD_TABS : EDIT_TABS;
  const existingBook = mode === "edit" ? bookOf(s, bookId!) : undefined;
  const [form, setForm] = useState<FormState>(() => {
    if (mode === "edit")
      return formFromBook(bookOf(s, bookId!)!, copiesOf(s, bookId!));
    try {
      const d = localStorage.getItem(DRAFT_KEY);
      if (d) return JSON.parse(d).form as FormState;
    } catch {
      /* ignore broken draft */
    }
    return emptyForm();
  });
  const [restored, setRestored] = useState<string | null>(() => {
    if (mode === "edit") return null;
    try {
      return (
        JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null")?.savedAt ?? null
      );
    } catch {
      return null;
    }
  });
  const [tab, setTab] = useState<TabId>("title");
  const [visited, setVisited] = useState<Set<TabId>>(new Set());
  const [attempted, setAttempted] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));

  const existing = useMemo(
    () =>
      new Set(
        s.copies.filter((c) => c.bookId !== bookId).map((c) => c.accession),
      ),
    [s.copies, bookId],
  );
  const originalAccessions = useMemo(
    () =>
      new Set(
        mode === "edit"
          ? copiesOf(s, bookId!).map((copy) => copy.accession)
          : [],
      ),
    [s, mode, bookId],
  );
  const { errors, dups } = useMemo(
    () => validate(form, mode, existing, originalAccessions),
    [form, mode, existing, originalAccessions],
  );

  useEffect(() => {
    if (mode !== "add") return;
    const t = setTimeout(
      () =>
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ form, savedAt: new Date().toISOString() }),
        ),
      400,
    );
    return () => clearTimeout(t);
  }, [form, mode]);
  useEffect(() => {
    const box = scroller.current;
    const el = box?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (box && el)
      box.scrollTo({
        left: el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2,
        behavior: "smooth",
      });
  }, [tab]);

  const go = (t: TabId) => {
    setVisited((v) => new Set(v).add(tab));
    setTab(t);
  };
  const idx = tabs.indexOf(tab);
  const show = (t: TabId) =>
    attempted || visited.has(t) || (tab === t && attempted);

  const clear = async (t: TabId) => {
    const ok = await confirm({
      title: `Clear “${TAB_META[t].label}”?`,
      message:
        "Only the fields on this tab will be emptied. Other tabs keep their data.",
      confirmLabel: "Clear Tab",
      danger: true,
    });
    if (ok) {
      patch(clearTab(t, form));
      a.toast(`${TAB_META[t].label} cleared`, "info");
    }
  };

  const submit = async () => {
    setAttempted(true);
    const bad = Object.keys(errors);
    if (bad.length) {
      const first = tabs.find((t) => tabErrors(errors, t).length)!;
      setTab(first);
      a.toast(
        `${bad.length} problem${bad.length > 1 ? "s" : ""} to fix — check the ${TAB_META[first].label} tab`,
        "error",
      );
      return;
    }
    const id = bookId ?? uid("b");
    const old = mode === "edit" ? bookOf(s, id) : undefined;
    const base = toBook(form, id, old?.addedOn);
    const kept = form.copies.map((c) => ({
      ...c,
      bookId: id,
      accession: c.accession.trim(),
    }));
    const fresh = planCopies(form).map(({ groupId: _g, ...c }) => ({
      ...c,
      id: uid("c"),
      bookId: id,
    }));
    const savedId = await a.saveBook(base, [...kept, ...fresh]);
    if (!savedId) return;
    if (mode === "add") localStorage.removeItem(DRAFT_KEY);
    nav(`/staff/catalog/${savedId}`);
  };

  const saveCopyStatuses = () => {
    if (!bookId) return;
    const statuses = new Map(form.copies.map((copy) => [copy.id, copy.status]));
    a.set((current) => ({
      ...current,
      copies: current.copies.map((copy) =>
        statuses.has(copy.id)
          ? { ...copy, status: statuses.get(copy.id)! }
          : copy,
      ),
    }));
    a.toast(
      "Copy availability updated. Other catalog details were not changed.",
      "success",
    );
  };

  const discard = async () => {
    if (
      !(await confirm({
        title: "Discard draft?",
        message: "This empties every tab and deletes the saved browser draft.",
        confirmLabel: "Discard",
        danger: true,
      }))
    )
      return;
    localStorage.removeItem(DRAFT_KEY);
    setForm(emptyForm());
    setRestored(null);
    setTab("title");
    setVisited(new Set());
    setAttempted(false);
  };

  const common = { form, patch, errors, show: show(tab) };
  const body = {
    title: <TitleTab {...common} onClear={() => clear("title")} />,
    access: <AccessTab {...common} onClear={() => clear("access")} />,
    abstract: <AbstractTab {...common} onClear={() => clear("abstract")} />,
    description: (
      <DescriptionTab {...common} onClear={() => clear("description")} />
    ),
    local: (
      <LocalTab
        {...common}
        dups={dups}
        mode={mode}
        onClear={() => clear("local")}
      />
    ),
    pub: (
      <PublicationTab
        {...common}
        writers={s.writers}
        publishers={s.publishers}
        corporates={s.corporates}
        title={mode === "edit" ? "Publication & Contributors" : "Publication"}
        onClear={() => clear("pub")}
      />
    ),
    copies: (
      <CopiesTab
        {...common}
        onSaveStatuses={mode === "edit" ? saveCopyStatuses : undefined}
      />
    ),
  }[tab];
  const label = (t: TabId) =>
    t === "pub" && mode === "edit"
      ? "Publication & Contributors"
      : TAB_META[t].label;
  const last = idx === tabs.length - 1;

  return (
    <div>
      <div className="mb-5">
        <Link
          to={mode === "edit" ? `/staff/catalog/${bookId}` : "/staff/catalog"}
          className="inline-flex items-center gap-1 text-sm font-semibold text-mute hover:text-brand"
        >
          <ChevronLeft size={15} />
          Books
        </Link>
        <div className="mt-2">
          <h1 className="text-2xl font-extrabold text-ink">
            {mode === "add" ? "Add Book" : "Edit Book"}
          </h1>
          <p className="mt-0.5 text-sm text-mute">
            {mode === "edit"
              ? form.title
              : "Complete the six tabs, then save the whole record from the last tab."}
          </p>
        </div>
      </div>
      {restored && (
        <Alert tone="info" className="mb-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            Unfinished draft restored from {new Date(restored).toLocaleString()}
            .
            <button
              onClick={discard}
              className="inline-flex items-center gap-1 font-bold underline"
            >
              <RotateCcw size={12} />
              Discard draft
            </button>
            <button
              onClick={() => setRestored(null)}
              className="font-bold underline"
            >
              Dismiss
            </button>
          </div>
        </Alert>
      )}
      <div className="grid min-w-0 items-start gap-4 sm:gap-5 xl:grid-cols-[15.5rem_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-3">
          <Card className="hidden p-3.5 sm:block">
            <div className="mt-3 flex items-center gap-3">
              {existingBook?.coverImage ? (
                <img
                  src={existingBook.coverImage}
                  alt=""
                  className="h-14 w-11 shrink-0 rounded object-cover"
                />
              ) : (
                <div className="grid h-14 w-11 shrink-0 place-items-center rounded bg-slate-100 text-sm font-extrabold text-mute">
                  …
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-extrabold text-ink">
                  {form.title || "Untitled book"}
                </div>
                <div className="mt-0.5 text-xs text-mute">
                  {form.subjectCategory || form.program
                    ? [form.subjectCategory, form.program]
                        .filter(Boolean)
                        .join(" · ")
                    : "No category or program yet"}
                </div>
              </div>
            </div>
          </Card>
          <div
            ref={scroller}
            role="tablist"
            aria-label="Catalog record tabs"
            className="scroll-quiet -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 xl:mx-0 xl:flex-col xl:overflow-visible xl:px-0 xl:pb-0"
          >
            {tabs.map((t, i) => {
              const Icon = ICONS[t];
              const st = tabStatus(form, errors, t);
              const active = t === tab;
              return (
                <button
                  key={t}
                  role="tab"
                  aria-selected={active}
                  onClick={() => go(t)}
                  title={DOT_LABEL[st]}
                  className={cx(
                    "flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-2 text-left text-xs font-bold transition sm:px-3 sm:text-sm xl:w-full xl:gap-2 xl:py-2.5",
                    active
                      ? "border-line bg-white text-ink shadow-sm"
                      : "border-transparent text-slate-600 hover:bg-slate-50",
                  )}
                >
                  <span className="w-3 text-right text-[11px] font-semibold text-mute xl:w-4 xl:text-xs">
                    {i + 1}.
                  </span>
                  <Icon size={15} className="hidden xl:block" />
                  <span className="min-w-0 flex-1 truncate">{label(t)}</span>
                  <span
                    data-status={st}
                    className={cx("h-2.5 w-2.5 shrink-0 rounded-full", DOT[st])}
                  >
                    <span className="sr-only">{DOT_LABEL[st]}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="hidden space-y-1.5 px-3 text-xs text-mute xl:block">
            {(["red", "yellow", "green"] as const).map((k) => (
              <span key={k} className="flex items-center gap-2">
                <span className={cx("h-2 w-2 rounded-full", DOT[k])} />
                {DOT_LABEL[k]}
              </span>
            ))}
          </div>
        </aside>
        <Card flush>
          <div className="hidden flex-wrap gap-x-4 gap-y-1 border-b border-line px-4 py-2 text-[11px] font-semibold text-mute">
            {(["red", "yellow", "green"] as const).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className={cx("h-2 w-2 rounded-full", DOT[k])} />
                {DOT_LABEL[k]}
              </span>
            ))}
          </div>
          <div className="p-3 sm:p-6">{body}</div>
          <footer className="flex flex-col gap-3 border-t border-line bg-slate-50 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2 sm:px-6">
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Link
                to={
                  mode === "edit"
                    ? `/staff/catalog/${bookId}`
                    : "/staff/catalog"
                }
              >
                <Btn className="flex-1 sm:flex-none" variant="light">Cancel</Btn>
              </Link>
              <Btn
                className="flex-1 sm:flex-none"
                variant="light"
                icon={<ChevronLeft size={15} />}
                disabled={idx === 0}
                onClick={() => go(tabs[idx - 1])}
              >
                Previous
              </Btn>
            </div>
            <span className="order-first text-xs font-semibold text-mute sm:order-none">
              Tab {idx + 1} of {tabs.length}
              {mode === "add" && " · draft saved in this browser"}
            </span>
            <div className="flex w-full gap-2 sm:w-auto">
              {!last && (
                <Btn className="flex-1 sm:flex-none" variant="light" onClick={() => go(tabs[idx + 1])}>
                  Next
                  <ChevronRight size={15} />
                </Btn>
              )}
              {(last || mode === "edit") && (
                <Btn className="flex-1 sm:flex-none" icon={<Save size={15} />} onClick={submit}>
                  {mode === "add" ? "Save Book" : "Save Changes"}
                </Btn>
              )}
            </div>
          </footer>
        </Card>
      </div>
      {attempted && Object.keys(errors).length > 0 && (
        <Alert tone="error" className="mt-4">
          Fix {Object.keys(errors).length} problem(s):{" "}
          {[...new Set(Object.keys(errors).map((k) => label(tabOf(k))))].join(
            ", ",
          )}
          .
        </Alert>
      )}
    </div>
  );
}
