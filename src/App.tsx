import { useEffect, useState, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  linkWithRedirect,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import {
  ArrowLeft,
  Check,
  CloudOff,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  NotebookPen,
  Plus,
  Trash2,
} from "lucide-react";
import { auth, db, firebaseConfigured, googleProvider } from "./lib/firebase";
import { removeNote, saveNote, subscribeToNotes, type Note } from "./lib/notes";

type Notice = { kind: "error" | "success"; text: string };
type Draft = Pick<Note, "title" | "body">;

function authMessage(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === "auth/email-already-in-use") return "Этот email уже зарегистрирован. Войдите в аккаунт.";
  if (code === "auth/invalid-credential") return "Неверный email или пароль.";
  if (code === "auth/weak-password") return "Пароль должен содержать не менее 6 символов.";
  if (code === "auth/invalid-email") return "Проверьте формат email.";
  if (code === "auth/too-many-requests") return "Слишком много попыток. Попробуйте чуть позже.";
  if (code === "auth/account-exists-with-different-credential") {
    return "У этого email уже есть аккаунт. Войди по паролю, затем подключи Google в профиле.";
  }
  if (code === "auth/credential-already-in-use") {
    return "Этот Google-аккаунт уже связан с другим профилем. Существующие заметки не объединены.";
  }
  if (code === "auth/operation-not-allowed") return "Вход через Google ещё не включён в Firebase.";
  if (code === "auth/unauthorized-domain") return "Этот адрес сайта не разрешён для входа через Firebase.";
  return "Не удалось войти. Проверьте подключение и попробуйте ещё раз.";
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className={`brand${inverse ? " brand-inverse" : ""}`}>
      <span className="brand-mark" aria-hidden="true"><NotebookPen size={20} strokeWidth={1.8} /></span>
      <span>лист<span className="brand-period">.</span></span>
    </div>
  );
}

function MissingConfiguration() {
  return (
    <main className="setup-screen">
      <section className="setup-panel">
        <Brand />
        <div className="setup-icon"><CloudOff size={24} strokeWidth={1.7} /></div>
        <p className="eyebrow">НУЖНА НАСТРОЙКА</p>
        <h1>Подключите Firebase</h1>
        <p className="setup-copy">
          Приложение готово, но пока не знает, где хранить ваши заметки. Добавьте настройки Firebase,
          чтобы включить вход и синхронизацию между устройствами.
        </p>
        <p className="setup-hint">Скопируйте <code>.env.example</code> в <code>.env.local</code> и заполните значения из настроек веб-приложения Firebase.</p>
      </section>
      <footer className="setup-footer">Ваши заметки будут доступны только после входа в аккаунт.</footer>
    </main>
  );
}

function AuthScreen({
  redirectError,
  clearRedirectError,
}: {
  redirectError: string;
  clearRedirectError: () => void;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth) return;

    setBusy(true);
    setError("");
    clearRedirectError();
    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (requestError) {
      setError(authMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function continueWithGoogle() {
    if (!auth) return;

    setBusy(true);
    setError("");
    clearRedirectError();
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (requestError) {
      setError(authMessage(requestError));
      setBusy(false);
    }
  }

  const visibleError = error || redirectError;

  return (
    <main className="auth-screen">
      <section className="auth-aside">
        <Brand inverse />
        <div className="auth-aside-copy">
          <span className="eyebrow">МЫСЛИ ПОД РУКОЙ</span>
          <p>Запишите сейчас.<br />Откройте где угодно.</p>
        </div>
        <span className="aside-index">01 / 01</span>
      </section>
      <section className="auth-content">
        <div className="auth-form-wrap">
          <div className="auth-symbol"><LockKeyhole size={19} strokeWidth={1.8} /></div>
          <p className="eyebrow">ЛИЧНОЕ ПРОСТРАНСТВО</p>
          <h1>{mode === "login" ? "С возвращением" : "Создайте аккаунт"}</h1>
          <p className="auth-lead">{mode === "login" ? "Войдите, чтобы открыть свои заметки." : "Один аккаунт для телефона и компьютера."}</p>

          <form className="auth-form" onSubmit={submit}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <label htmlFor="password">Пароль</label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder="Не менее 6 символов"
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {visibleError && <p className="form-error" role="alert">{visibleError}</p>}
            <button className="button button-primary auth-submit" type="submit" disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={17} /> : null}
              {busy ? "Подождите..." : mode === "login" ? "Войти" : "Зарегистрироваться"}
            </button>
          </form>

          <div className="auth-divider"><span>ИЛИ</span></div>
          <button className="button button-google" type="button" onClick={continueWithGoogle} disabled={busy}>
            <span className="google-mark" aria-hidden="true">G</span>
            Продолжить с Google
          </button>

          <p className="auth-switch">
            {mode === "login" ? "Впервые здесь?" : "Уже есть аккаунт?"}{" "}
            <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); clearRedirectError(); }}>
              {mode === "login" ? "Создать аккаунт" : "Войти"}
            </button>
          </p>
          <p className="auth-note">Если у тебя уже есть заметки, войди в тот аккаунт и свяжи Google.</p>
          <p className="privacy-note"><LockKeyhole size={13} /> Заметки видны только в вашем аккаунте</p>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [notes, setNotes] = useState<Note[]>([]);
  const [redirectError, setRedirectError] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesLoadError, setNotesLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNewNote, setIsNewNote] = useState(false);
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({ title: "", body: "" });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!auth) {
      setSessionLoading(false);
      return;
    }

    void getRedirectResult(auth).catch((requestError) => {
      setRedirectError(authMessage(requestError));
    });

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setNotes([]);
      setSelectedId(null);
      setIsNewNote(false);
      setMobileEditorOpen(false);
      setDraft({ title: "", body: "" });
      setSessionLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user || !db) {
      setNotes([]);
      setNotesLoading(false);
      setNotesLoadError(false);
      return;
    }

    setNotesLoading(true);
    setNotesLoadError(false);
    return subscribeToNotes(
      user.uid,
      (nextNotes) => {
        setNotes(nextNotes);
        setNotesLoading(false);
        setNotesLoadError(false);
      },
      () => {
        setNotice({ kind: "error", text: "Не удалось загрузить заметки. Проверьте подключение." });
        setNotesLoading(false);
        setNotesLoadError(true);
      },
    );
  }, [user]);

  if (!firebaseConfigured) return <MissingConfiguration />;
  if (sessionLoading) {
    return <main className="loading-screen"><LoaderCircle className="spin" size={22} />Подключаем аккаунт...</main>;
  }
  if (!user) return <AuthScreen redirectError={redirectError} clearRedirectError={() => setRedirectError("")} />;

  const googleLinked = user.providerData.some(
    (provider) => provider.providerId === GoogleAuthProvider.PROVIDER_ID,
  );
  const selectedNote = notes.find((note) => note.id === selectedId) ?? null;
  const isDirty = isNewNote
    ? Boolean(draft.title.trim() || draft.body.trim())
    : Boolean(selectedNote && (draft.title !== selectedNote.title || draft.body !== selectedNote.body));
  const canSave = Boolean(draft.title.trim() || draft.body.trim()) && isDirty && !saving;

  function confirmDiscard() {
    return !isDirty || window.confirm("Изменения не сохранены. Закрыть без сохранения?");
  }

  function startNewNote() {
    if (!confirmDiscard()) return;
    setSelectedId(null);
    setIsNewNote(true);
    setDraft({ title: "", body: "" });
    setNotice(null);
    setMobileEditorOpen(true);
  }

  function selectNote(note: Note) {
    if (!confirmDiscard()) return;
    setSelectedId(note.id);
    setIsNewNote(false);
    setDraft({ title: note.title, body: note.body });
    setNotice(null);
    setMobileEditorOpen(true);
  }

  function closeEditor() {
    if (!confirmDiscard()) return;
    setSelectedId(null);
    setIsNewNote(false);
    setDraft({ title: "", body: "" });
    setNotice(null);
    setMobileEditorOpen(false);
  }

  async function saveCurrentNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !canSave) {
      if (!draft.title.trim() && !draft.body.trim()) {
        setNotice({ kind: "error", text: "Добавьте заголовок или текст заметки." });
      }
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const saved = await saveNote(user.uid, draft, selectedNote ?? undefined);
      setNotes((current) => [saved, ...current.filter((note) => note.id !== saved.id)]);
      setSelectedId(saved.id);
      setIsNewNote(false);
      setDraft({ title: saved.title, body: saved.body });
      setNotice({ kind: "success", text: "Сохранено" });
    } catch {
      setNotice({ kind: "error", text: "Не удалось сохранить. Текст остался в редакторе, попробуйте ещё раз." });
    } finally {
      setSaving(false);
    }
  }

  async function deleteCurrentNote() {
    if (!user || !selectedNote || !window.confirm("Удалить эту заметку? Это действие нельзя отменить.")) return;

    setNotice(null);
    try {
      await removeNote(user.uid, selectedNote.id);
      setNotes((current) => current.filter((note) => note.id !== selectedNote.id));
      setSelectedId(null);
      setDraft({ title: "", body: "" });
      setMobileEditorOpen(false);
      setNotice({ kind: "success", text: "Заметка удалена" });
    } catch {
      setNotice({ kind: "error", text: "Не удалось удалить заметку. Попробуйте ещё раз." });
    }
  }

  async function leaveAccount() {
    if (!auth) return;
    await signOut(auth);
  }

  async function connectGoogle() {
    if (!user || googleLinked) return;

    setNotice(null);
    try {
      await linkWithRedirect(user, googleProvider);
    } catch (requestError) {
      setNotice({ kind: "error", text: authMessage(requestError) });
    }
  }

  return (
    <main className={`app-shell${mobileEditorOpen ? " has-editor" : ""}`}>
      <header className="topbar">
        <Brand />
        <div className="account-controls">
          <span className="account-email" title={user.email ?? ""}>{user.email}</span>
          {googleLinked ? (
            <span className="google-linked" title="Google привязан к этому аккаунту"><span className="google-mark" aria-hidden="true">G</span></span>
          ) : (
            <button className="button button-quiet google-link-button" type="button" onClick={connectGoogle} title="Связать Google, сохранив эти заметки">
              <span className="google-mark" aria-hidden="true">G</span>
              <span>Связать Google</span>
            </button>
          )}
          <button className="button button-quiet signout-button" type="button" onClick={leaveAccount}>
            <LogOut size={16} /> <span>Выйти</span>
          </button>
        </div>
      </header>

      <div className="notes-layout">
        <aside className="notes-sidebar" aria-label="Список заметок">
          <div className="sidebar-heading">
            <div>
              <p className="eyebrow">ЛИЧНОЕ ПРОСТРАНСТВО</p>
              <h1>Заметки <span className="note-count">{notes.length}</span></h1>
            </div>
            <button className="button button-new" type="button" onClick={startNewNote}>
              <Plus size={17} /> <span>Новая</span>
            </button>
          </div>

          <div className="sidebar-rule" />
          {notesLoading ? (
            <p className="list-state"><LoaderCircle className="spin" size={17} /> Загружаем заметки...</p>
          ) : notesLoadError ? (
            <div className="list-empty list-error" role="alert">
              <CloudOff size={21} strokeWidth={1.6} />
              <p>Не удалось загрузить заметки</p>
              <span>Проверьте подключение и обновите страницу</span>
            </div>
          ) : notes.length === 0 ? (
            <div className="list-empty">
              <NotebookPen size={21} strokeWidth={1.6} />
              <p>Пока здесь пусто</p>
              <span>Создайте первую заметку</span>
            </div>
          ) : (
            <ul className="note-list">
              {notes.map((note) => (
                <li key={note.id}>
                  <button
                    className={`note-row${selectedId === note.id ? " is-selected" : ""}`}
                    type="button"
                    onClick={() => selectNote(note)}
                    aria-current={selectedId === note.id ? "true" : undefined}
                  >
                    <span className="note-row-title">{note.title || "Без названия"}</span>
                    <span className="note-row-date">{formatDate(note.updatedAt)}</span>
                    <span className="note-row-preview">{note.body || "Текст заметки"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className={`sidebar-bottom${notesLoadError ? " sync-error" : ""}`}>
            <span className={`sync-dot${notesLoadError ? " sync-dot-error" : ""}`} />
            {notesLoadError ? "Нет связи с Firestore" : "Синхронизация включена"}
          </div>
        </aside>

        <section className="editor-panel" aria-label="Редактор заметки">
          {isNewNote || selectedNote ? (
            <>
              <div className="editor-toolbar">
                <button className="button button-quiet back-button" type="button" onClick={closeEditor} aria-label="Назад к списку">
                  <ArrowLeft size={18} /> <span>Все заметки</span>
                </button>
                <div className="editor-actions">
                  {selectedNote && (
                    <button className="icon-button delete-button" type="button" onClick={deleteCurrentNote} aria-label="Удалить заметку" title="Удалить заметку">
                      <Trash2 size={17} />
                    </button>
                  )}
                  <button className="button button-save" type="submit" form="note-form" disabled={!canSave}>
                    {saving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}
                    <span>{saving ? "Сохраняем" : "Сохранить"}</span>
                  </button>
                </div>
              </div>
              <form id="note-form" className="note-editor" onSubmit={saveCurrentNote}>
                <p className="editor-overline">{selectedNote ? `ИЗМЕНЕНО ${formatDate(selectedNote.updatedAt).toLocaleUpperCase("ru-RU")}` : "НОВАЯ ЗАМЕТКА"}</p>
                <input
                  className="note-title-input"
                  aria-label="Заголовок заметки"
                  placeholder="Без названия"
                  maxLength={120}
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                />
                <textarea
                  className="note-body-input"
                  aria-label="Текст заметки"
                  placeholder="Начните писать..."
                  maxLength={10000}
                  value={draft.body}
                  onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                />
                <div className="editor-footer">
                  <span>{draft.body.length} / 10 000</span>
                  <span>{isDirty ? "Есть несохранённые изменения" : selectedNote ? "Все изменения сохранены" : "Добавьте заголовок или текст, чтобы сохранить"}</span>
                </div>
              </form>
            </>
          ) : (
            <div className="editor-empty">
              <div className="empty-mark"><NotebookPen size={25} strokeWidth={1.5} /></div>
              <p className="eyebrow">ВАШЕ ПРОСТРАНСТВО</p>
              <h2>{notes.length ? "Выберите заметку" : "Освободите место для мысли"}</h2>
              <p>{notes.length ? "Или создайте новую, чтобы записать что-то важное." : "Короткая идея, список дел или мысль на потом."}</p>
              <button className="button button-primary" type="button" onClick={startNewNote}>
                <Plus size={17} /> Новая заметка
              </button>
            </div>
          )}
          {notice && <p className={`notice notice-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</p>}
        </section>
      </div>
    </main>
  );
}