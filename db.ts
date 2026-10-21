import { openDB, type DBSchema } from "idb";

export interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

interface NotesDatabase extends DBSchema {
  notes: {
    key: string;
    value: Note;
  };
  meta: {
    key: string;
    value: string;
  };
}

const DATABASE_NAME = "notes-app-database";
const DATABASE_VERSION = 1;
const LEGACY_STORAGE_KEY = "notes-app-v2";

async function getDatabase() {
  return openDB<NotesDatabase>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains("notes")) {
        database.createObjectStore("notes", { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains("meta")) {
        database.createObjectStore("meta");
      }
    },
  });
}

export async function loadNotes(): Promise<Note[]> {
  if (typeof window === "undefined") {
    return [];
  }

  const database = await getDatabase();
  const existingNotes = await database.getAll("notes");

  if (existingNotes.length > 0) {
    return existingNotes.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() -
        new Date(a.updatedAt).getTime()
    );
  }

  // Przenieś notatki ze starszej wersji zapisanej w localStorage.
  try {
    const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);

    if (legacyData) {
      const parsed: unknown = JSON.parse(legacyData);

      if (Array.isArray(parsed)) {
        const validNotes = parsed.filter(
          (item): item is Note =>
            item !== null &&
            typeof item === "object" &&
            typeof item.id === "string" &&
            typeof item.title === "string" &&
            typeof item.content === "string" &&
            typeof item.category === "string" &&
            typeof item.createdAt === "string" &&
            typeof item.updatedAt === "string"
        );

        if (validNotes.length > 0) {
          const transaction = database.transaction("notes", "readwrite");

          await Promise.all([
            ...validNotes.map((note) => transaction.store.put(note)),
            transaction.done,
          ]);

          return validNotes.sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() -
              new Date(a.updatedAt).getTime()
          );
        }
      }
    }
  } catch (error) {
    console.error("Nie udało się przenieść starych notatek:", error);
  }

  return [];
}

export async function saveNote(note: Note): Promise<void> {
  const database = await getDatabase();
  await database.put("notes", note);
}

export async function deleteNoteFromDB(id: string): Promise<void> {
  const database = await getDatabase();
  await database.delete("notes", id);
}

export async function saveAllNotes(notes: Note[]): Promise<void> {
  const database = await getDatabase();
  const transaction = database.transaction("notes", "readwrite");

  await Promise.all([
    transaction.store.clear(),
    transaction.done,
  ]);

  for (const note of notes) {
    await database.put("notes", note);
  }
}
