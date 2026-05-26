import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Download, Plus, Search, Trash2, Volume2, X } from "lucide-react";
function Button({ children, className = "", ...props }) {
  return (
    <button className={className} {...props}>
      {children}
    </button>
  );
}

const STORAGE_KEY = "personal-en-zh-dictionary-v1";

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

function makeStableId(term, count) {
  const normalized = normalizeTerm(term)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${normalized || "term"}-${count + 1}`;
}

function generateSmartFallback(rawTerm) {
  const term = String(rawTerm || "").trim();

  return {
    term: titleCaseTerm(term),
    pronunciation: "Could not fetch pronunciation",
    phonetic: "Could not fetch IPA",
    chinese: "暂时无法生成中文释义",
    explanation: `I could not connect to the AI lookup service for “${term}”. Check that your /api/define-term endpoint is running and your API key is configured.`,
    examples: [
      `Try searching “${term}” again after the API endpoint is connected.`,
      "Your app will automatically save successful searches to Vocabulary.",
      "Keep your OpenAI API key on the server, not in this React component."
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

function createVocabularyEntry(result, count) {
  return {
    id: makeStableId(result.term, count),
    term: result.term,
    explanation: result.explanation,
    pronunciation: result.pronunciation,
    phonetic: result.phonetic,
    chinese: result.chinese
  };
}

function entriesMatchFilter(entry, filter) {
  const q = normalizeTerm(filter);

  if (!q) {
    return true;
  }

  return [entry.term, entry.explanation, entry.pronunciation, entry.phonetic, entry.chinese]
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

function safeLoadEntries() {
  try {
    if (typeof window === "undefined") {
      return [];
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function safeSaveEntries(entries) {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    }
  } catch {
    // ignore storage errors
  }
}

function runDeveloperTests() {
  console.assert(normalizeTerm(" AI-native ") === "ai-native", "normalizeTerm should trim and lowercase");
  console.assert(makeStableId("AI-native", 0) === "ai-native-1", "Stable IDs should work");
  console.assert(entriesMatchFilter(sampleDictionary.integrity, "安全"), "Chinese filtering should work");
  console.assert(createVocabularyCsv([sampleDictionary.copilot]).includes("Phonetic symbol"), "CSV header should exist");
  console.assert(generateSmartFallback("agentic").term === "Agentic", "Fallback should title case");
  console.assert(isValidDictionaryResult(sampleDictionary.copilot), "Sample dictionary entries should match the API response shape");
  console.assert(!isValidDictionaryResult({ term: "test" }), "Invalid API responses should be rejected");
}

if (typeof window !== "undefined") {
  runDeveloperTests();
}

export default function PersonalDictionaryApp() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState("search");

  useEffect(() => {
    setEntries(safeLoadEntries());
  }, []);

  useEffect(() => {
    safeSaveEntries(entries);
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => entriesMatchFilter(entry, filter));
  }, [entries, filter]);

  const saveResultToVocabulary = (dictionaryResult) => {
    setEntries((current) => {
      const normalized = normalizeTerm(dictionaryResult.term);
      const withoutDuplicate = current.filter((entry) => normalizeTerm(entry.term) !== normalized);
      const nextEntry = createVocabularyEntry(dictionaryResult, withoutDuplicate.length);

      return [nextEntry, ...withoutDuplicate];
    });
  };

  const handleLookup = async (event) => {
    event.preventDefault();

    const term = query.trim();

    if (!term) {
      return;
    }

    setIsLoading(true);

    try {
      const normalized = normalizeTerm(term);
      const found = sampleDictionary[normalized] || (await lookupTermWithAi(term));

      setResult(found);
      saveResultToVocabulary(found);
    } catch (error) {
      const fallback = generateSmartFallback(term);
      setResult(fallback);
    } finally {
      setIsLoading(false);
    }
  };

  const addToVocabulary = () => {
    if (!result) {
      return;
    }

    const normalized = normalizeTerm(result.term);

    setEntries((current) => {
      const withoutDuplicate = current.filter((entry) => normalizeTerm(entry.term) !== normalized);
      const nextEntry = createVocabularyEntry(result, withoutDuplicate.length);

      return [nextEntry, ...withoutDuplicate];
    });
  };

  const removeEntry = (id) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  };

  const clearResult = () => {
    setResult(null);
    setQuery("");
  };

  const speakTerm = (term) => {
    if (typeof window === "undefined" || !window.speechSynthesis || !term) {
      return;
    }

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
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Search className="h-5 w-5 text-white" />
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
                        {result.examples.map((example) => (
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
                  Review the words you saved from search.
                </p>
              </div>

              <Button
                onClick={exportVocabulary}
                disabled={!entries.length}
                variant="ghost"
                className="w-fit rounded-full px-4 text-[#555555] hover:bg-[#f7f3f0]"
              >
                <Download className="mr-2 h-4 w-4" />
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

            {filteredEntries.length === 0 ? (
              <div className="rounded-[28px] bg-[#faf7f4] p-10 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#ff385c]">
                  <BookOpen className="h-5 w-5" />
                </div>

                <p className="text-[17px] font-medium leading-6">No saved words yet</p>

                <p className="mt-2 text-[15px] leading-6 text-[#8a817c]">
                  Search a term and save it to build your personal list.
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
