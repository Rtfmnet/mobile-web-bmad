import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";

export type Note = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
};

function notesCollection(userId: string) {
  if (!db) {
    throw new Error("Firebase не настроен.");
  }

  return collection(db, "users", userId, "notes");
}

export function subscribeToNotes(
  userId: string,
  onNotes: (notes: Note[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const notesQuery = query(notesCollection(userId), orderBy("updatedAt", "desc"));

  return onSnapshot(
    notesQuery,
    (snapshot) => {
      onNotes(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Note));
    },
    onError,
  );
}

export async function saveNote(
  userId: string,
  values: Pick<Note, "title" | "body">,
  existing?: Pick<Note, "id" | "createdAt">,
): Promise<Note> {
  const notes = notesCollection(userId);
  const reference = existing ? doc(notes, existing.id) : doc(notes);
  const now = Date.now();
  const note: Note = {
    id: reference.id,
    title: values.title.trim(),
    body: values.body,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await setDoc(reference, {
    title: note.title,
    body: note.body,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  });

  return note;
}

export async function removeNote(userId: string, noteId: string): Promise<void> {
  await deleteDoc(doc(notesCollection(userId), noteId));
}