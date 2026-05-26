import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "./supabaseClient";
import { BookOpen, Download, Search, Trash2, Volume2, X } from "lucide-react";

function Button({ children, className = "", ...props }) {
  return (
    <button className={className} {...props}>
      {children}
    </button>
  );
}

const sampleDictionary = {
  "ai-native": {
    term: "AI-native",
    pronunciation: "AY-eye NAY-tiv",
    phonetic: "/ˌeɪˈaɪ ˈneɪtɪv/",
    chinese: "AI 原生的；以人工智能为核心设计的",
    explanation:
      "AI-native describes a product, workflow, or way of working that is designed around AI from the beginning, instead of adding AI later.",
    examples: [
      "An AI-native design tool helps designers iterate faster.",
      "The company rebuilt its workflow to be AI-native.",
      "AI-native experiences are built around intelligent assistance."
    ]
  },
  integrity: {
    term: "integrity",
    pronunciation: "in-TEG-ruh-tee",
    phonetic: "/ɪnˈteɡrəti/",
    chinese: "正直；完整性；安全治理",
    explanation:
      "Integrity usually means honesty and strong moral principles. In tech, it can also refer to platform safety and trust systems.",
    examples: [
      "She is respected for her integrity.",
      "The integrity team built moderation tools.",
      "Maintaining integrity requires strong enforcement systems."
    ]
  },
  copilot: {
    term: "copilot",
    pronunciation: "KOH-py-luht",
    phonetic: "/ˈkoʊˌpaɪlət/",
    chinese: "AI 助手；协作式智能工具",
    explanation:
      "A copilot is an AI assistant that works alongside a human to help complete tasks.",
    examples: [
      "The writing copilot polished her draft.",
      "A design copilot can suggest layouts.",
      "Copilots assist while humans stay in control."
    ]
  }
};

function normalizeTerm(term) {
  return String(term || "").trim().toLowerCase();
}

function titleCaseTerm(term) {
  return String(term || "")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function generateSmartFallback(rawTerm) {
  const term = String(rawTerm || "").trim();

  return {
    term: titleCaseTerm(term),
    pronunciation: "Could not fetch pronunciation",
    phonetic: "Could not fetch IPA",
    chinese: "暂时无法生成中文释义",
    explanation: `I could not connect to the AI lookup service for “${term}”.`,
    examples: [
      `Try searching “${term}” again later.`,
      "Check that the API endpoint is working.",
      "Check that the Gemini API key is configured in Vercel."
    ]
  };
}

function isValidDictionaryResult(value) {
  return Boolean(
    value &&
      typeof value.term === "string" &&
      typeof value.pronunciation === "string" &&
      typeof value.phonetic === "string" &&
      typeof value.chinese === "string" &&
      typeof value.explanation === "string" &&
      Array.isArray(value.examples)
  );
}

async function lookupTermWithAi(term) {
  const response = await fetch("/api/define-term", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ term })
  });

  if (!response.ok) {
    throw new Error("AI lookup failed");
  }

  const data = await response.json();

  if (!isValidDictionaryResult(data)) {
    throw new Error("AI lookup returned an unexpected shape");
  }

  return data;
}

function entriesMatchFilter(entry, filter) {
  const q = normalizeTerm(filter);

  if (!q) return true;

  return [entry.term, entry.explanation, entry.pronunciation, entry.phonetic, entry.chinese]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q);
}

function escapeCsvCell(cell) {
  return `"${String(cell ?? "").replaceAll('"', '""')}"`;
}

function createVocabularyCsv(entries) {
  const header = ["English term", "English explanation", "Pronunciation", "Phonetic symbol", "Chinese translation"];

  const rows = entries.map((entry) => [
    entry.term,
    entry.explanation,
    entry.pronunciation,
    entry.phonetic,
    entry.chinese
  ]);

  return [header, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");
}

export default function PersonalDictionaryApp() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState("search");

  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user || null);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    async function loadVocabulary() {
      if (!user) {
        setEntries([]);
        return;
      }

      const { data, error } = await supabase
        .from("vocabulary")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Load vocabulary error:", error);
        return;
      }

      setEntries(data || []);
    }

    loadVocabulary();
  }, [user]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => entriesMatchFilter(entry, filter));
  }, [entries, filter]);

  async function signUp() {
    const { error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) {
      alert(error.message);
    } else {
      alert("Account created. If email confirmation is enabled, please check your inbox.");
    }
  }

  async function signIn() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      alert(error.message);
    } else {
      setEmail("");
      setPassword("");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setEntries([]);
  }

  const saveResultToVocabulary = async (dictionaryResult) => {
    if (!user) return;

    const row = {
      user_id: user.id,
      term: dictionaryResult.term,
      explanation: dictionaryResult.explanation,
      pronunciation: dictionaryResult.pronunciation,
      phonetic: dictionaryResult.phonetic,
      chinese: dictionaryResult.chinese
    };

    const { data, error } = await supabase
      .from("vocabulary")
      .upsert(row, { onConflict: "user_id,term" })
      .select()
      .single();

    if (error) {
      console.error("Save vocabulary error:", error);
      return;
    }

    if (data) {
      setEntries((current) => {
        const withoutDuplicate = current.filter(
          (entry) => normalizeTerm(entry.term) !== normalizeTerm(data.term)
        );

        return [data, ...withoutDuplicate];
      });
    }
  };

  const handleLookup = async (event) => {
    event.preventDefault();

    const term = query.trim();

    if (!term) return;

    setIsLoading(true);

    try {
      const normalized = normalizeTerm(term);
      const found = sampleDictionary[normalized] || (await lookupTermWithAi(term));

      setResult(found);
      await saveResultToVocabulary(found);
    } catch (error) {
      console.error(error);
      const fallback = generateSmartFallback(term);
      setResult(fallback);
    } finally {
      setIsLoading(false);
    }
  };

  const removeEntry = async (id) => {
    const { error } = await supabase
      .from("vocabulary")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete vocabulary error:", error);
      return;
    }

    setEntries((current) => current.filter((entry) => entry.id !== id));
  };

  const clearResult = () => {
    setResult(null);
    setQuery("");
  };

  const speakTerm = (term) => {
    if (typeof window === "undefined" || !window.speechSynthesis || !term) return;

    const utterance = new SpeechSynthesisUtterance(term);
    utterance.lang = "en-US";
    utterance.rate = 0.82;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const exportVocabulary = () => {
    const csv = createVocabularyCsv(entries);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "personal-vocabulary-list.csv";
    link.click();

    URL.revokeObjectURL(url);
  };

  const tabClassName = (tabName) => {
    const isActive = page === tabName;

    return [
      "border-b-2 px-1 pb-3 text-[15px] font-medium transition",
      isActive
        ? "border-[#222222] text-[#222222]"
        : "border-transparent text-[#8a817c] hover:text-[#222222]"
    ].join(" ");
  };

  return (
    <main className="min-h-screen bg-[#faf7f4] text-[#222222]">
      <section className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-12">
        <header className="mb-10">
          <div className="mx-auto max-w-[780px]">
            <div className="flex min-h-[56px] items-center justify-between gap-6">
              <h1 className="text-[22px] font-semibold leading-none tracking-[-0.01em] text-[#222222] sm:text-[24px]">
                Ran's dictionary
              </h1>

              <div className="flex justify-end border-b border-[#e8dfd8]">
                <button
                  type="button"
                  onClick={() => setPage("search")}
                  className={tabClassName("search")}
                >
                  Search
                </button>

                <button
                  type="button"
                  onClick={() => setPage("vocabulary")}
                  className={`${tabClassName("vocabulary")} ml-8`}
                >
                  Vocabulary
                </button>
              </div>
            </div>
          </div>

          {!authLoading && (
            <div className="mx-auto mt-6 max-w-[780px]">
              {!user ? (
                <div className="rounded-[28px] bg-white p-5 shadow-[0_18px_60px_rgba(34,34,34,0.06)]">
                  <p className="mb-4 text-[15px] font-medium text-[#222222]">
                    Sign in to sync vocabulary across devices
                  </p>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="Email"
                      type="email"
                      className="min-w-0 flex-1 rounded-full bg-[#f7f3f0] px-4 py-3 text-[14px] outline-none placeholder:text-[#aaa39e]"
                    />

                    <input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Password"
                      type="password"
                      className="min-w-0 flex-1 rounded-full bg-[#f7f3f0] px-4 py-3 text-[14px] outline-none placeholder:text-[#aaa39e]"
                    />

                    <Button
                      type="button"
                      onClick={signIn}
                      className="rounded-full bg-[#222222] px-5 py-3 text-[14px] font-medium text-white"
                    >
                      Sign in
                    </Button>

                    <Button
                      type="button"
                      onClick={signUp}
                      className="rounded-full bg-[#ff385c] px-5 py-3 text-[14px] font-medium text-white"
                    >
                      Sign up
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-full bg-white px-5 py-3 text-[14px] text-[#8a817c] shadow-[0_12px_40px_rgba(34,34,34,0.05)]">
                  <span>Signed in as {user.email}</span>
                  <button
                    type="button"
                    onClick={signOut}
                    className="font-medium text-[#222222]"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}

          {page === "search" && (
            <form onSubmit={handleLookup} className="mx-auto mt-8 w-full max-w-[780px]">
              <div className="flex items-center rounded-full bg-white p-2 pl-5 shadow-[0_18px_60px_rgba(34,34,34,0.08)]">
                <Search className="mr-4 h-5 w-5 shrink-0 text-[#8a817c]" />

                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search an English term"
                  className="min-w-0 flex-1 bg-transparent text-[17px] leading-7 outline-none placeholder:text-[#b0aaa6]"
                />

                <Button
                  type="submit"
                  aria-label="Search"
                  disabled={isLoading}
                  className="ml-4 h-12 w-12 rounded-full bg-[#ff385c] p-0 hover:bg-[#e63252] disabled:opacity-60"
                >
                  {isLoading ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Search className="mx-auto h-5 w-5 text-white" />
                  )}
                </Button>
              </div>
            </form>
          )}
        </header>

        {page === "search" ? (
          <section className="mx-auto min-h-[360px] max-w-[780px]">
            <AnimatePresence mode="wait">
              {result && (
                <motion.article
                  key={result.term}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                  className="rounded-[32px] bg-white p-6 shadow-[0_18px_60px_rgba(34,34,34,0.07)] sm:p-8"
                >
                  <div className="mb-8 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-[36px] font-semibold leading-none tracking-[-0.04em] sm:text-[44px]">
                          {result.term}
                        </h2>

                        <button
                          type="button"
                          onClick={() => speakTerm(result.term)}
                          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f7f3f0] text-[#ff385c] transition hover:bg-[#fff0f3]"
                        >
                          <Volume2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[15px] leading-6 text-[#8a817c]">
                        <span>Pronunciation: {result.pronunciation}</span>
                        <span className="rounded-full bg-[#f7f3f0] px-3 py-1 font-medium text-[#6f665f]">
                          Phonetic: {result.phonetic}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={clearResult}
                      className="rounded-full p-2 text-[#8a817c] hover:bg-[#f7f3f0]"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-8">
                    <section>
                      <p className="mb-2 text-[13px] font-medium uppercase tracking-[0.14em] text-[#8a817c]">
                        English meaning
                      </p>

                      <p className="max-w-2xl text-[17px] leading-8 text-[#333333]">
                        {result.explanation}
                      </p>
                    </section>

                    <section>
                      <p className="mb-2 text-[13px] font-medium uppercase tracking-[0.14em] text-[#8a817c]">
                        Chinese meaning
                      </p>

                      <p className="text-[19px] font-medium leading-8 text-[#222222]">
                        {result.chinese}
                      </p>
                    </section>

                    <section>
                      <p className="mb-4 text-[13px] font-medium uppercase tracking-[0.14em] text-[#8a817c]">
                        Examples
                      </p>

                      <div className="space-y-4">
                        {(result.examples || []).map((example) => (
                          <p
                            key={example}
                            className="border-l-2 border-[#ff385c]/40 pl-4 text-[16px] leading-7 text-[#333333]"
                          >
                            {example}
                          </p>
                        ))}
                      </div>
                    </section>
                  </div>
                </motion.article>
              )}
            </AnimatePresence>
          </section>
        ) : (
          <section className="mx-auto max-w-[780px] rounded-[32px] bg-white p-6 shadow-[0_18px_60px_rgba(34,34,34,0.06)] sm:p-8">
            <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-[32px] font-semibold tracking-[-0.04em]">Vocabulary</h2>

                <p className="mt-2 text-[15px] leading-6 text-[#8a817c]">
                  Review the words saved to your account.
                </p>
              </div>

              <Button
                onClick={exportVocabulary}
                disabled={!entries.length}
                className="w-fit rounded-full px-4 text-[#555555] hover:bg-[#f7f3f0]"
              >
                <Download className="mr-2 inline h-4 w-4" />
                Export CSV
              </Button>
            </div>

            <div className="mb-6 flex max-w-md items-center gap-3 rounded-full bg-[#f7f3f0] px-4 py-3">
              <Search className="h-4 w-4 text-[#8a817c]" />

              <input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter words"
                className="w-full bg-transparent text-[14px] leading-5 outline-none placeholder:text-[#aaa39e]"
              />
            </div>

            {!user ? (
              <div className="rounded-[28px] bg-[#faf7f4] p-10 text-center">
                <p className="text-[17px] font-medium leading-6">Sign in to view synced vocabulary</p>
                <p className="mt-2 text-[15px] leading-6 text-[#8a817c]">
                  Your saved words will sync across laptop and phone after you sign in.
                </p>
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="rounded-[28px] bg-[#faf7f4] p-10 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#ff385c]">
                  <BookOpen className="h-5 w-5" />
                </div>

                <p className="text-[17px] font-medium leading-6">No saved words yet</p>

                <p className="mt-2 text-[15px] leading-6 text-[#8a817c]">
                  Search a term while signed in to save it automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="group rounded-[26px] border border-[#f0e9e4] p-5 transition hover:bg-[#faf7f4]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <button
                          type="button"
                          onClick={() => speakTerm(entry.term)}
                          className="text-left"
                        >
                          <p className="text-[22px] font-semibold tracking-[-0.03em]">
                            {entry.term}
                          </p>

                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[14px] leading-6 text-[#8a817c]">
                            <span>{entry.pronunciation}</span>
                            <span className="font-medium text-[#6f665f]">{entry.phonetic}</span>
                          </div>
                        </button>

                        <p className="mt-3 text-[15px] font-medium leading-6 text-[#222222]">
                          {entry.chinese}
                        </p>

                        <p className="mt-2 line-clamp-2 text-[14px] leading-6 text-[#555555]">
                          {entry.explanation}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeEntry(entry.id)}
                        className="rounded-full p-2 text-[#b0aaa6] transition hover:bg-white hover:text-[#ff385c]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  );
}