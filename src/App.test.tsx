import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const mocks = vi.hoisted(() => {
  type TestUser = { uid: string; email: string | null; providerData: Array<{ providerId: string }> };
  type TestNote = { id: string; title: string; body: string; createdAt: number; updatedAt: number };
  let authObserver: ((user: TestUser | null) => void) | undefined;

  return {
    firebaseConfigured: true,
    auth: {},
    db: {},
    googleProvider: { providerId: "google.com" },
    notes: [] as TestNote[],
    authListener: vi.fn((_auth: unknown, observer: (user: TestUser | null) => void) => {
      authObserver = observer;
      observer(null);
      return () => { authObserver = undefined; };
    }),
    emitAuthState: (user: TestUser | null) => authObserver?.(user),
    signIn: vi.fn(),
    signInWithRedirect: vi.fn(),
    getRedirectResult: vi.fn(),
    linkWithRedirect: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    subscribeToNotes: vi.fn(),
    saveNote: vi.fn(),
    removeNote: vi.fn(),
  };
});

vi.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: mocks.signUp,
  GoogleAuthProvider: { PROVIDER_ID: "google.com" },
  getRedirectResult: mocks.getRedirectResult,
  linkWithRedirect: mocks.linkWithRedirect,
  onAuthStateChanged: mocks.authListener,
  signInWithEmailAndPassword: mocks.signIn,
  signInWithRedirect: mocks.signInWithRedirect,
  signOut: mocks.signOut,
}));

vi.mock("./lib/firebase", () => ({
  get auth() { return mocks.auth; },
  get db() { return mocks.db; },
  get firebaseConfigured() { return mocks.firebaseConfigured; },
  get googleProvider() { return mocks.googleProvider; },
}));

vi.mock("./lib/notes", () => ({
  removeNote: mocks.removeNote,
  saveNote: mocks.saveNote,
  subscribeToNotes: mocks.subscribeToNotes,
}));

const testUser = { uid: "user-1", email: "reader@example.com", providerData: [] as Array<{ providerId: string }> };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.firebaseConfigured = true;
  mocks.notes = [];
  mocks.getRedirectResult.mockResolvedValue(null);
  mocks.signInWithRedirect.mockResolvedValue(undefined);
  mocks.linkWithRedirect.mockResolvedValue(undefined);
  mocks.subscribeToNotes.mockImplementation((
    _userId: string,
    onNotes: (notes: typeof mocks.notes) => void,
  ) => {
    onNotes(mocks.notes);
    return () => undefined;
  });
  mocks.saveNote.mockImplementation(async (
    _userId: string,
    values: { title: string; body: string },
    existing?: { id: string; createdAt: number },
  ) => ({
    id: existing?.id ?? "note-new",
    title: values.title.trim(),
    body: values.body,
    createdAt: existing?.createdAt ?? 100,
    updatedAt: 200,
  }));
  mocks.removeNote.mockResolvedValue(undefined);
});

async function signInToNotes(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await user.type(screen.getByLabelText("Email"), testUser.email);
  await user.type(screen.getByLabelText("Пароль"), "not-a-real-password");
  await user.click(screen.getByRole("button", { name: "Войти" }));
  await act(async () => { mocks.emitAuthState(testUser); });
  await screen.findByText("Синхронизация включена");
}

describe("notes app", () => {
  it("explains how to configure Firebase when cloud settings are missing", () => {
    mocks.firebaseConfigured = false;

    render(<App />);

    expect(screen.getByRole("heading", { name: "Подключите Firebase" })).toBeInTheDocument();
    expect(screen.getByText(/\.env\.example/)).toBeInTheDocument();
  });

  it("registers an account and opens the notes view", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Создать аккаунт" }));
    await user.type(screen.getByLabelText("Email"), testUser.email);
    await user.type(screen.getByLabelText("Пароль"), "not-a-real-password");
    await user.click(screen.getByRole("button", { name: "Зарегистрироваться" }));
    await act(async () => { mocks.emitAuthState(testUser); });

    expect(mocks.signUp).toHaveBeenCalledWith(mocks.auth, testUser.email, "not-a-real-password");
    expect(await screen.findByText("Пока здесь пусто")).toBeInTheDocument();
  });

  it("signs in to an existing account", async () => {
    const user = userEvent.setup();
    await signInToNotes(user);

    expect(mocks.signIn).toHaveBeenCalledWith(mocks.auth, testUser.email, "not-a-real-password");
    expect(screen.getByRole("heading", { name: /Заметки/ })).toBeInTheDocument();
  });

  it("starts Google sign-in with a mobile-friendly redirect", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Продолжить с Google" }));

    expect(mocks.signInWithRedirect).toHaveBeenCalledWith(mocks.auth, mocks.googleProvider);
  });

  it("links Google to the currently signed-in account", async () => {
    const user = userEvent.setup();
    await signInToNotes(user);
    await user.click(screen.getByRole("button", { name: "Связать Google" }));

    expect(mocks.linkWithRedirect).toHaveBeenCalledWith(testUser, mocks.googleProvider);
  });

  it("explains how to keep existing notes when Google is already a different provider", async () => {
    mocks.getRedirectResult.mockRejectedValue({ code: "auth/account-exists-with-different-credential" });
    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Войди по паролю, затем подключи Google");
  });

  it("does not show an empty list or active sync when loading notes fails", async () => {
    const user = userEvent.setup();
    mocks.subscribeToNotes.mockImplementationOnce((
      _userId: string,
      _onNotes: (notes: typeof mocks.notes) => void,
      onError: (error: Error) => void,
    ) => {
      onError(new Error("permission denied"));
      return () => undefined;
    });

    render(<App />);
    await user.type(screen.getByLabelText("Email"), testUser.email);
    await user.type(screen.getByLabelText("Пароль"), "not-a-real-password");
    await user.click(screen.getByRole("button", { name: "Войти" }));
    await act(async () => { mocks.emitAuthState(testUser); });

    expect(await screen.findByText("Не удалось загрузить заметки")).toBeInTheDocument();
    expect(screen.getByText("Нет связи с Firestore")).toBeInTheDocument();
    expect(screen.queryByText("Пока здесь пусто")).not.toBeInTheDocument();
  });

  it("shows an auth error and keeps the email after a failed sign-in", async () => {
    const user = userEvent.setup();
    mocks.signIn.mockRejectedValue({ code: "auth/invalid-credential" });
    render(<App />);
    await user.type(screen.getByLabelText("Email"), testUser.email);
    await user.type(screen.getByLabelText("Пароль"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Войти" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Неверный email или пароль.");
    expect(screen.getByLabelText("Email")).toHaveValue(testUser.email);
  });

  it("does not save an empty note and explains what is needed", async () => {
    const user = userEvent.setup();
    await signInToNotes(user);
    await user.click(screen.getByRole("button", { name: "Новая заметка" }));

    expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();
    expect(screen.getByText("Добавьте заголовок или текст, чтобы сохранить")).toBeInTheDocument();
    expect(mocks.saveNote).not.toHaveBeenCalled();
  });

  it("saves a note and displays it in the list", async () => {
    const user = userEvent.setup();
    await signInToNotes(user);
    await user.click(screen.getByRole("button", { name: "Новая заметка" }));
    await user.type(screen.getByLabelText("Заголовок заметки"), "Идея");
    await user.type(screen.getByLabelText("Текст заметки"), "Текст для проверки");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => expect(mocks.saveNote).toHaveBeenCalledWith(
      testUser.uid,
      { title: "Идея", body: "Текст для проверки" },
      undefined,
    ));
    expect(await screen.findByRole("button", { name: /Идея/ })).toBeInTheDocument();
    expect(screen.getByText("Сохранено")).toBeInTheDocument();
  });

  it("keeps the draft and shows a retryable error when saving fails", async () => {
    const user = userEvent.setup();
    mocks.saveNote.mockRejectedValue(new Error("offline"));
    await signInToNotes(user);
    await user.click(screen.getByRole("button", { name: "Новая заметка" }));
    await user.type(screen.getByLabelText("Заголовок заметки"), "На потом");
    await user.type(screen.getByLabelText("Текст заметки"), "Оставить этот текст");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Текст остался в редакторе");
    expect(screen.getByLabelText("Текст заметки")).toHaveValue("Оставить этот текст");
  });

  it("deletes a note only after confirmation", async () => {
    const user = userEvent.setup();
    mocks.notes = [{ id: "note-1", title: "Список", body: "Купить хлеб", createdAt: 100, updatedAt: 200 }];
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await signInToNotes(user);
    await user.click(screen.getByRole("button", { name: /Список/ }));
    await user.click(screen.getByRole("button", { name: "Удалить заметку" }));

    await waitFor(() => expect(mocks.removeNote).toHaveBeenCalledWith(testUser.uid, "note-1"));
    expect(await screen.findByText("Заметка удалена")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Список/ })).not.toBeInTheDocument();
  });

  it("keeps a note visible when deletion fails", async () => {
    const user = userEvent.setup();
    mocks.notes = [{ id: "note-1", title: "Оставить", body: "Текст", createdAt: 100, updatedAt: 200 }];
    mocks.removeNote.mockRejectedValue(new Error("offline"));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await signInToNotes(user);
    await user.click(screen.getByRole("button", { name: /Оставить/ }));
    await user.click(screen.getByRole("button", { name: "Удалить заметку" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось удалить заметку");
    expect(screen.getByRole("button", { name: /Оставить/ })).toBeInTheDocument();
  });
});