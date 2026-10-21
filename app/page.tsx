"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  deleteNoteFromDB,
  loadNotes,
  saveNote,
  type Note,
} from "./lib/db";

const THEME_KEY = "notes-theme";

const CATEGORIES = [
  "Osobiste",
  "Praca",
  "Nauka",
  "Pomysły",
  "Inne",
];

function createNote(): Note {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    title: "",
    content: "",
    category: "Osobiste",
    createdAt: now,
    updatedAt: now,
  };
}

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Wszystkie");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [saveStatus, setSaveStatus] = useState("Ładowanie...");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    
        if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((error) => {
          console.error("Nie udało się uruchomić Service Workera:", error);
        });
    }
    let cancelled = false;

    async function initialize() {
      try {
        const storedTheme = localStorage.getItem(THEME_KEY);

        if (storedTheme === "light" || storedTheme === "dark") {
          setTheme(storedTheme);
        }

        const storedNotes = await loadNotes();

        if (cancelled) return;

        setNotes(storedNotes);
        setActiveId(storedNotes[0]?.id ?? null);
        setSaveStatus("Zapisano");
      } catch (error) {
        console.error("Nie udało się załadować notatek:", error);
        setSaveStatus("Błąd ładowania");
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    void initialize();

    const updateOnlineStatus = () => setOnline(navigator.onLine);

    setOnline(navigator.onLine);
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      cancelled = true;
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    if (ready) {
      localStorage.setItem(THEME_KEY, theme);
    }
  }, [theme, ready]);

  const activeNote = useMemo(
    () => notes.find((note) => note.id === activeId) ?? null,
    [notes, activeId]
  );

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLowerCase();

    return notes
      .filter((note) => {
        const matchesSearch =
          !query ||
          note.title.toLowerCase().includes(query) ||
          note.content.toLowerCase().includes(query);

        const matchesCategory =
          categoryFilter === "Wszystkie" ||
          note.category === categoryFilter;

        return matchesSearch && matchesCategory;
      })
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() -
          new Date(a.updatedAt).getTime()
      );
  }, [notes, search, categoryFilter]);

  const persistNote = useCallback(async (note: Note) => {
    try {
      setSaveStatus("Zapisywanie...");
      await saveNote(note);
      setSaveStatus("Zapisano");
    } catch (error) {
      console.error("Nie udało się zapisać notatki:", error);
      setSaveStatus("Błąd zapisu");
    }
  }, []);

  const addNote = useCallback(() => {
    const note = createNote();

    startTransition(() => {
      setNotes((current) => [note, ...current]);
      setActiveId(note.id);
    });

    void persistNote(note);
  }, [persistNote]);

  const updateActiveNote = useCallback(
    (changes: Partial<Pick<Note, "title" | "content" | "category">>) => {
      if (!activeNote) return;

      const updated: Note = {
        ...activeNote,
        ...changes,
        updatedAt: new Date().toISOString(),
      };

      setNotes((current) =>
        current.map((note) =>
          note.id === updated.id ? updated : note
        )
      );

      void persistNote(updated);
    },
    [activeNote, persistNote]
  );

  const deleteActiveNote = useCallback(async () => {
    if (!activeNote) return;

    const confirmed = window.confirm(
      `Czy na pewno usunąć notatkę "${activeNote.title || "Bez tytułu"}"?`
    );

    if (!confirmed) return;

    try {
      await deleteNoteFromDB(activeNote.id);

      const remaining = notes.filter(
        (note) => note.id !== activeNote.id
      );

      setNotes(remaining);
      setActiveId(remaining[0]?.id ?? null);
      setSaveStatus("Zapisano");
    } catch (error) {
      console.error("Nie udało się usunąć notatki:", error);
      setSaveStatus("Błąd usuwania");
    }
  }, [activeNote, notes]);

  const exportNotes = useCallback(() => {
    const blob = new Blob([JSON.stringify(notes, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "moje-notatki.json";
    link.click();

    URL.revokeObjectURL(url);
  }, [notes]);

  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">✳</div>
          <div>
            <div className="brand-name">notatki</div>
            <div className="brand-caption">Twoja przestrzeń</div>
          </div>
        </div>

        <button className="new-note-button" onClick={addNote}>
          <span>＋</span> Nowa notatka
        </button>

        <div className="sidebar-label">BIBLIOTEKA</div>

        <button
          className={`nav-item ${categoryFilter === "Wszystkie" ? "active" : ""}`}
          onClick={() => setCategoryFilter("Wszystkie")}
        >
          <span>▤</span>
          Wszystkie notatki
          <span className="nav-count">{notes.length}</span>
        </button>

        <div className="sidebar-label category-heading">KATEGORIE</div>

        {CATEGORIES.map((category) => (
          <button
            key={category}
            className={`nav-item ${categoryFilter === category ? "active" : ""}`}
            onClick={() => setCategoryFilter(category)}
          >
            <span className="category-dot" />
            {category}
            <span className="nav-count">
              {notes.filter((note) => note.category === category).length}
            </span>
          </button>
        ))}

        <div className="sidebar-spacer" />

        <div className="storage-card">
          <div className="storage-status">
            <span className={`status-dot ${online ? "online" : "offline"}`} />
            {online ? "Tryb lokalny" : "Tryb offline"}
          </div>
          <p>Twoje notatki są zapisywane na tym urządzeniu.</p>
          <div className="save-status">{saveStatus}</div>
        </div>

        <button className="nav-item theme-button" onClick={toggleTheme}>
          <span>{theme === "dark" ? "☀" : "☾"}</span>
          {theme === "dark" ? "Tryb jasny" : "Tryb ciemny"}
        </button>

        <button className="nav-item export-button" onClick={exportNotes}>
          <span>⇩</span>
          Eksportuj notatki
        </button>
      </aside>

      <section className="notes-panel">
        <div className="panel-header">
          <div>
            <div className="eyebrow">TWOJA BIBLIOTEKA</div>
            <h1>Notatki</h1>
            <p className="panel-subtitle">
              Wszystkie Twoje myśli w jednym miejscu.
            </p>
          </div>
          <div className="notes-total">{notes.length} notatek</div>
        </div>

        <label className="search-box">
          <span>⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Szukaj notatek..."
            aria-label="Szukaj notatek"
          />
          <kbd>⌘ K</kbd>
        </label>

        <div className="list-heading">
          <span>{categoryFilter === "Wszystkie" ? "OSTATNIE" : categoryFilter.toUpperCase()}</span>
          <span>{filteredNotes.length}</span>
        </div>

        <div className="notes-list">
          {!ready ? (
            <div className="empty-state">
              <div className="empty-icon">◌</div>
              <p>Ładowanie notatek...</p>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✳</div>
              <p>{search ? "Nic nie znaleziono" : "Tu zaczyna się coś nowego"}</p>
              <span>
                {search
                  ? "Spróbuj wpisać inne hasło."
                  : "Utwórz notatkę, aby zapisać pierwszą myśl."}
              </span>
              {!search && (
                <button className="small-create-button" onClick={addNote}>
                  ＋ Utwórz notatkę
                </button>
              )}
            </div>
          ) : (
            filteredNotes.map((note) => (
              <button
                key={note.id}
                className={`note-card ${activeId === note.id ? "selected" : ""}`}
                onClick={() => setActiveId(note.id)}
              >
                <div className="note-card-top">
                  <span className="note-category">{note.category}</span>
                  <span className="note-date">
                    {new Date(note.updatedAt).toLocaleDateString("pl-PL", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
                <div className="note-card-title">
                  {note.title.trim() || "Bez tytułu"}
                </div>
                <div className="note-card-preview">
                  {note.content.trim() || "Pusta notatka"}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="panel-footer">
          <span>{filteredNotes.length} pozycji</span>
          <span>Twoje miejsce na myśli ✳</span>
        </div>
      </section>

      <section className="editor-panel">
        {activeNote ? (
          <>
            <div className="editor-topbar">
              <div className="breadcrumb">
                <span>Notatki</span>
                <span>/</span>
                <span>{activeNote.category}</span>
              </div>
              <button
                className="delete-button"
                onClick={() => void deleteActiveNote()}
                aria-label="Usuń notatkę"
                title="Usuń notatkę"
              >
                Usuń
              </button>
            </div>

            <div className="editor-content">
              <div className="editor-meta">
                <span className="editor-dot" />
                {activeNote.category}
                <span>·</span>
                Zmieniono{" "}
                {new Date(activeNote.updatedAt).toLocaleString("pl-PL", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>

              <input
                className="title-input"
                value={activeNote.title}
                onChange={(event) =>
                  updateActiveNote({ title: event.target.value })
                }
                placeholder="Tytuł notatki"
                aria-label="Tytuł notatki"
              />

              <div className="editor-toolbar">
                <span>EDYTOR</span>
                <label className="category-select-label">
                  <span>Kategoria</span>
                  <select
                    value={activeNote.category}
                    onChange={(event) =>
                      updateActiveNote({ category: event.target.value })
                    }
                    aria-label="Kategoria notatki"
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <textarea
                className="content-input"
                value={activeNote.content}
                onChange={(event) =>
                  updateActiveNote({ content: event.target.value })
                }
                placeholder={"Zacznij pisać...\n\nKażda wielka myśl zaczyna się od pierwszego słowa."}
                aria-label="Treść notatki"
              />

              <div className="editor-bottom">
                <span>
                  {activeNote.content.trim()
                    ? activeNote.content.trim().split(/\s+/).length
                    : 0}{" "}
                  słów
                </span>
                <span>{isPending ? "Aktualizowanie..." : saveStatus}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="editor-empty">
            <div className="editor-empty-icon">✳</div>
            <h2>Wybierz swoją myśl</h2>
            <p>Wybierz notatkę z listy albo utwórz nową.</p>
            <button className="new-note-button" onClick={addNote}>
              ＋ Nowa notatka
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
