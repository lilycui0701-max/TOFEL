const HISTORY_STORAGE_KEY = "toefl-speaking-practice-history";

const detailTitle = document.getElementById("detailTitle");
const detailTimestamp = document.getElementById("detailTimestamp");
const detailEmpty = document.getElementById("detailEmpty");
const detailContent = document.getElementById("detailContent");
const detailQuestion = document.getElementById("detailQuestion");
const detailTranscript = document.getElementById("detailTranscript");
const detailContentScore = document.getElementById("detailContentScore");
const detailOrganizationScore = document.getElementById("detailOrganizationScore");
const detailFluencyScore = document.getElementById("detailFluencyScore");
const detailSelfContent = document.getElementById("detailSelfContent");
const detailSelfOrganization = document.getElementById("detailSelfOrganization");
const detailSelfFluency = document.getElementById("detailSelfFluency");
const detailStrengths = document.getElementById("detailStrengths");
const detailSuggestions = document.getElementById("detailSuggestions");
const detailStructure = document.getElementById("detailStructure");
const detailAudioEmpty = document.getElementById("detailAudioEmpty");
const detailAudioContent = document.getElementById("detailAudioContent");
const detailAudioPlayer = document.getElementById("detailAudioPlayer");
const AUDIO_DB_NAME = "toefl-speaking-practice-audio";
const AUDIO_STORE_NAME = "recordings";
let detailAudioUrl = "";

function normalizeHistoryItem(item) {
  const fallbackId =
    item?.id ||
    item?.timestamp ||
    [item?.question, item?.transcript].filter(Boolean).join("::") ||
    `history-${Math.random().toString(36).slice(2, 10)}`;

  return {
    id: fallbackId,
    question: item?.question || "Practice session",
    transcript: item?.transcript || "",
    timestamp: item?.timestamp || new Date().toISOString(),
    scores: {
      content: item?.scores?.content ?? null,
      organization: item?.scores?.organization ?? null,
      fluency: item?.scores?.fluency ?? null
    },
    self_ratings: {
      content: item?.self_ratings?.content ?? null,
      organization: item?.self_ratings?.organization ?? null,
      fluency: item?.self_ratings?.fluency ?? null
    },
    audio_recording: item?.audio_recording
      ? {
          id: item.audio_recording.id || fallbackId,
          storage: item.audio_recording.storage || "indexeddb",
          mime_type: item.audio_recording.mime_type || null
        }
      : null,
    strengths: Array.isArray(item?.strengths) ? item.strengths : [],
    suggestions: Array.isArray(item?.suggestions) ? item.suggestions : [],
    better_structure: Array.isArray(item?.better_structure) ? item.better_structure : []
  };
}

function openAudioDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB is not supported in this browser."));
      return;
    }

    const request = window.indexedDB.open(AUDIO_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(AUDIO_STORE_NAME)) {
        db.createObjectStore(AUDIO_STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open audio database."));
  });
}

async function loadAudioRecording(id) {
  if (!id) {
    return null;
  }

  const db = await openAudioDatabase();
  const result = await new Promise((resolve, reject) => {
    const transaction = db.transaction(AUDIO_STORE_NAME, "readonly");
    const request = transaction.objectStore(AUDIO_STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("Failed to load audio."));
  });
  db.close();
  return result;
}

function clearDetailAudioUrl() {
  if (detailAudioUrl) {
    window.URL.revokeObjectURL(detailAudioUrl);
    detailAudioUrl = "";
  }
}

function renderDetailAudio(blob) {
  if (!detailAudioEmpty || !detailAudioContent || !detailAudioPlayer) {
    return;
  }

  clearDetailAudioUrl();

  if (!blob) {
    detailAudioEmpty.classList.remove("hidden");
    detailAudioContent.classList.add("hidden");
    detailAudioPlayer.removeAttribute("src");
    detailAudioPlayer.load();
    return;
  }

  detailAudioUrl = window.URL.createObjectURL(blob);
  detailAudioEmpty.classList.add("hidden");
  detailAudioContent.classList.remove("hidden");
  detailAudioPlayer.src = detailAudioUrl;
  detailAudioPlayer.load();
}

function getPracticeHistory() {
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw).map(normalizeHistoryItem) : [];
  } catch (error) {
    console.error("History load failed:", error);
    return [];
  }
}

function formatHistoryTime(timestamp) {
  try {
    return new Date(timestamp).toLocaleString();
  } catch (error) {
    return timestamp;
  }
}

function renderList(listElement, items, emptyMessage) {
  listElement.innerHTML = "";

  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = emptyMessage;
    listElement.appendChild(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    listElement.appendChild(li);
  });
}

function showMissingState() {
  detailEmpty.classList.remove("hidden");
  detailContent.classList.add("hidden");
  renderDetailAudio(null);
}

async function renderDetail(item) {
  detailEmpty.classList.add("hidden");
  detailContent.classList.remove("hidden");
  detailTitle.textContent = "Practice Session Review";
  detailTimestamp.textContent = `Saved ${formatHistoryTime(item.timestamp)}`;
  detailQuestion.textContent = item.question || "Practice question unavailable.";
  detailTranscript.textContent = item.transcript || "No transcript saved yet.";
  detailContentScore.textContent = item.scores?.content ?? "-";
  detailOrganizationScore.textContent = item.scores?.organization ?? "-";
  detailFluencyScore.textContent = item.scores?.fluency ?? "-";
  detailSelfContent.textContent = item.self_ratings?.content ?? "-";
  detailSelfOrganization.textContent = item.self_ratings?.organization ?? "-";
  detailSelfFluency.textContent = item.self_ratings?.fluency ?? "-";
  renderList(detailStrengths, item.strengths || [], "No strengths were saved for this session.");
  renderList(detailSuggestions, item.suggestions || [], "No suggestions were saved for this session.");
  renderList(
    detailStructure,
    item.better_structure || [],
    "No improved structure was saved for this session."
  );

  try {
    const audioRecord = item.audio_recording?.id
      ? await loadAudioRecording(item.audio_recording.id)
      : null;
    renderDetailAudio(audioRecord?.blob || null);
  } catch (error) {
    console.error("Audio load failed:", error);
    renderDetailAudio(null);
  }
}

async function loadHistoryDetail() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("id");

  if (!sessionId) {
    showMissingState();
    return;
  }

  const items = getPracticeHistory();
  const item = items.find((entry) => entry.id === sessionId);

  if (!item) {
    showMissingState();
    return;
  }

  await renderDetail(item);
}

loadHistoryDetail();
