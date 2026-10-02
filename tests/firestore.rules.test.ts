import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";

const projectId = "demo-notes";
let testEnvironment: RulesTestEnvironment;

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterEach(async () => {
  await testEnvironment.clearFirestore();
});

afterAll(async () => {
  await testEnvironment.cleanup();
});

describe("Firestore note ownership rules", () => {
  it("allows an owner to create, list, read, edit, and delete a note", async () => {
    const firestore = testEnvironment.authenticatedContext("owner").firestore();
    const notes = collection(firestore, "users", "owner", "notes");
    const note = doc(notes, "note-1");
    const initial = { title: "Заметка", body: "Мой текст", createdAt: 100, updatedAt: 100 };

    await assertSucceeds(setDoc(note, initial));
    expect((await assertSucceeds(getDocs(notes))).size).toBe(1);
    expect((await assertSucceeds(getDoc(note))).data()?.title).toBe("Заметка");
    await assertSucceeds(updateDoc(note, { body: "Обновлено", updatedAt: 200 }));
    expect((await assertSucceeds(getDoc(note))).data()?.body).toBe("Обновлено");
    await assertSucceeds(deleteDoc(note));
    expect((await assertSucceeds(getDocs(notes))).empty).toBe(true);
  });

  it("denies anonymous and other-account access to a user's notes", async () => {
    const ownerDb = testEnvironment.authenticatedContext("owner").firestore();
    const ownerNote = doc(ownerDb, "users", "owner", "notes", "note-1");
    await assertSucceeds(setDoc(ownerNote, {
      title: "Private",
      body: "Owner only",
      createdAt: 100,
      updatedAt: 100,
    }));

    const otherDb = testEnvironment.authenticatedContext("another-user").firestore();
    const stolenNote = doc(otherDb, "users", "owner", "notes", "note-1");
    await assertFails(getDoc(stolenNote));
    await assertFails(getDocs(collection(otherDb, "users", "owner", "notes")));
    await assertFails(updateDoc(stolenNote, { body: "Stolen", updatedAt: 200 }));
    await assertFails(deleteDoc(stolenNote));
    await assertFails(setDoc(doc(otherDb, "users", "owner", "notes", "forged"), {
      title: "Forged",
      body: "Not my note",
      createdAt: 100,
      updatedAt: 100,
    }));

    const anonymousDb = testEnvironment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonymousDb, "users", "owner", "notes", "note-1")));
  });
});