const PREP_SECONDS = 15;
const SPEAK_SECONDS = 45;
const QUESTION_BANK = [
  "Some people prefer to study alone, while others prefer to study with a group. Which do you prefer and why?",
  "Do you agree or disagree that university students should take classes outside their major? Explain your opinion.",
  "Some students like to complete assignments early, while others wait until closer to the deadline. Which approach do you prefer?",
  "Do you prefer living in a large city or in a small town? Give reasons and examples to support your answer.",
  "Some people like to spend free time outdoors, while others prefer staying inside. Which do you prefer and why?",
  "Do you agree or disagree that it is better to have a job you enjoy than a job that pays more money?",
  "Some students prefer morning classes, while others prefer afternoon or evening classes. Which do you prefer?",
  "Do you agree or disagree that technology has made communication better between people?",
  "Would you rather travel with a detailed plan or be spontaneous during a trip? Explain your choice.",
  "Some people prefer reading printed books, while others prefer reading on a screen. Which do you prefer and why?",
  "Do you agree or disagree that schools should require students to do community service?",
  "Some people like to make many friends, while others prefer a few close friends. Which do you prefer?",
  "Do you think it is better for students to live on campus or at home with family? Explain your answer.",
  "Some people prefer to learn by listening, while others learn better by doing. Which way is better for you?",
  "Do you agree or disagree that students should be allowed to use smartphones during class for learning purposes?",
  "Would you prefer to work for a large company or a small company? Give reasons for your preference.",
  "Some people enjoy cooking at home, while others prefer buying prepared food. Which do you prefer and why?",
  "Do you agree or disagree that success comes mostly from hard work rather than natural talent?",
  "Some students like to take notes by hand, while others prefer typing notes on a laptop. Which do you prefer?",
  "Do you think it is better to save money for the future or spend money on experiences now? Explain your opinion."
];

const timeValue = document.getElementById("timeValue");
const phaseBadge = document.getElementById("phaseBadge");
const phaseTitle = document.getElementById("phaseTitle");
const phaseCopy = document.getElementById("phaseCopy");
const startPracticeBtn = document.getElementById("startPracticeBtn");
const resetPracticeBtn = document.getElementById("resetPracticeBtn");
const questionText = document.getElementById("questionText");
const questionCounter = document.getElementById("questionCounter");
const nextQuestionBtn = document.getElementById("nextQuestionBtn");
const saveSelfRatingBtn = document.getElementById("saveSelfRatingBtn");

const startRecordingBtn = document.getElementById("startRecordingBtn");
const stopRecordingBtn = document.getElementById("stopRecordingBtn");
const analyzeBtn = document.getElementById("analyzeBtn");
const recordingStatus = document.getElementById("recordingStatus");
const analysisStatus = document.getElementById("analysisStatus");
const transcriptPreview = document.getElementById("transcriptPreview");
const recordingReviewEmpty = document.getElementById("recordingReviewEmpty");
const recordingReviewContent = document.getElementById("recordingReviewContent");
const recordingReviewPlayer = document.getElementById("recordingReviewPlayer");
const recordingReviewHint = document.getElementById("recordingReviewHint");

const opinionInput = document.getElementById("opinionInput");
const supportInput = document.getElementById("supportInput");
const unclearInput = document.getElementById("unclearInput");
const generateFeedbackBtn = document.getElementById("generateFeedbackBtn");
const feedbackText = document.getElementById("feedbackText");

const analysisEmpty = document.getElementById("analysisEmpty");
const analysisResults = document.getElementById("analysisResults");
const analysisResultsCard = document.getElementById("analysisResultsCard");
const historyEmpty = document.getElementById("historyEmpty");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const progressEmpty = document.getElementById("progressEmpty");
const progressCurve = document.getElementById("progressCurve");
const transcriptOutput = document.getElementById("transcriptOutput");
const contentScore = document.getElementById("contentScore");
const organizationScore = document.getElementById("organizationScore");
const fluencyScore = document.getElementById("fluencyScore");
const strengthsList = document.getElementById("strengthsList");
const suggestionsList = document.getElementById("suggestionsList");
const structureList = document.getElementById("structureList");

let countdown = PREP_SECONDS;
let currentPhase = "ready";
let timerId = null;
let currentQuestionIndex = 0;
let analysisStatusTimer = null;
let backendConnected = false;
let transcriptText = "";
let recognition = null;
let isRecognizing = false;
let shouldStopRecognition = false;
let currentHistoryItemId = null;
let currentAnalysisResult = null;
const HISTORY_STORAGE_KEY = "toefl-speaking-practice-history";
const AUDIO_DB_NAME = "toefl-speaking-practice-audio";
const AUDIO_STORE_NAME = "recordings";
let mediaRecorder = null;
let mediaStream = null;
let mediaRecorderMimeType = "";
let recordedChunks = [];
let isAudioCapturing = false;
let currentAudioBlob = null;
let currentAudioUrl = "";
let currentAudioMimeType = "";
let audioFinalizePromise = Promise.resolve();
let resolveAudioFinalize = null;

function getSpeechRecognitionConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
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

async function saveAudioRecording(id, blob, mimeType) {
  if (!id || !blob) {
    return;
  }

  const db = await openAudioDatabase();

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(AUDIO_STORE_NAME, "readwrite");
    transaction.objectStore(AUDIO_STORE_NAME).put({
      id,
      blob,
      mimeType: mimeType || blob.type || "audio/webm",
      updatedAt: Date.now()
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Failed to save audio."));
  });

  db.close();
}

async function clearAllAudioRecordings() {
  try {
    const db = await openAudioDatabase();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(AUDIO_STORE_NAME, "readwrite");
      transaction.objectStore(AUDIO_STORE_NAME).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Failed to clear audio."));
    });
    db.close();
  } catch (error) {
    console.error("Audio clear failed:", error);
  }
}

function getSupportedAudioMimeType() {
  if (!window.MediaRecorder) {
    return "";
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4"
  ];

  return candidates.find((type) => window.MediaRecorder.isTypeSupported(type)) || "";
}

function createAudioReference(id, mimeType) {
  if (!id) {
    return null;
  }

  return {
    id,
    storage: "indexeddb",
    mime_type: mimeType || null
  };
}

function clearCurrentAudioUrl() {
  if (currentAudioUrl) {
    window.URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = "";
  }
}

function renderRecordingReview() {
  if (!recordingReviewEmpty || !recordingReviewContent || !recordingReviewPlayer) {
    return;
  }

  if (!currentAudioBlob || !currentAudioUrl) {
    recordingReviewEmpty.classList.remove("hidden");
    recordingReviewContent.classList.add("hidden");
    recordingReviewPlayer.removeAttribute("src");
    recordingReviewPlayer.load();
    return;
  }

  recordingReviewEmpty.classList.add("hidden");
  recordingReviewContent.classList.remove("hidden");
  recordingReviewPlayer.src = currentAudioUrl;
  recordingReviewPlayer.load();
  if (recordingReviewHint) {
    recordingReviewHint.textContent =
      "Replay your recording as many times as you need while reviewing your feedback.";
  }
}

function setCurrentAudio(blob, mimeType) {
  clearCurrentAudioUrl();
  currentAudioBlob = blob;
  currentAudioMimeType = mimeType || blob?.type || "";
  currentAudioUrl = blob ? window.URL.createObjectURL(blob) : "";
  renderRecordingReview();
}

function clearCurrentAudio() {
  clearCurrentAudioUrl();
  currentAudioBlob = null;
  currentAudioMimeType = "";
  renderRecordingReview();
}

function resetAudioFinalizePromise() {
  audioFinalizePromise = new Promise((resolve) => {
    resolveAudioFinalize = resolve;
  });
}

function resolvePendingAudioFinalize() {
  if (resolveAudioFinalize) {
    resolveAudioFinalize();
    resolveAudioFinalize = null;
  }
}

async function startMediaCapture() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    return {
      ok: false,
      message: "Audio recording review is not supported in this browser."
    };
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderMimeType = getSupportedAudioMimeType();
    recordedChunks = [];
    resetAudioFinalizePromise();

    mediaRecorder = mediaRecorderMimeType
      ? new MediaRecorder(mediaStream, { mimeType: mediaRecorderMimeType })
      : new MediaRecorder(mediaStream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstart = () => {
      isAudioCapturing = true;
      setRecordingState(true);
    };

    mediaRecorder.onstop = () => {
      isAudioCapturing = false;
      setRecordingState(isRecognizing);

      const blobType = mediaRecorderMimeType || mediaRecorder?.mimeType || "audio/webm";
      const blob = recordedChunks.length ? new Blob(recordedChunks, { type: blobType }) : null;

      if (blob && blob.size > 0) {
        setCurrentAudio(blob, blobType);
      }

      recordedChunks = [];
      mediaRecorder = null;

      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStream = null;
      }

      resolvePendingAudioFinalize();
    };

    mediaRecorder.onerror = (event) => {
      console.error("Media recorder error:", event.error);
      isAudioCapturing = false;
      resolvePendingAudioFinalize();
    };

    mediaRecorder.start();
    return { ok: true };
  } catch (error) {
    console.error("Media capture start failed:", error);
    resolvePendingAudioFinalize();
    return {
      ok: false,
      message: "Audio recording could not start. Please allow microphone access and try again."
    };
  }
}

function stopMediaCapture() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    return;
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }

  isAudioCapturing = false;
  resolvePendingAudioFinalize();
}

function updateSpeechSupportState() {
  if (getSpeechRecognitionConstructor()) {
    return;
  }

  recordingStatus.textContent =
    "Speech recognition is not supported in this browser. Please use Chrome.";
  startRecordingBtn.disabled = true;
  stopRecordingBtn.disabled = true;
}

function setRecordingState(isRecording) {
  startRecordingBtn.disabled = isRecording;
  stopRecordingBtn.disabled = !isRecording;
  transcriptPreview.classList.toggle("is-live", isRecording);
}

function setAnalyzeState(isDisabled) {
  analyzeBtn.disabled = isDisabled;
}

function setAnalysisMessage(message) {
  analysisStatus.textContent = message;
}

function updateTranscriptPreview(text) {
  transcriptPreview.textContent =
    text || "Your browser transcript will appear here while you speak.";
}

function clearAnalysisStatusTimer() {
  if (analysisStatusTimer) {
    window.clearTimeout(analysisStatusTimer);
    analysisStatusTimer = null;
  }
}

function resetAnalysisResults() {
  analysisEmpty.classList.remove("hidden");
  analysisResults.classList.add("hidden");
  transcriptOutput.textContent = "";
  contentScore.textContent = "-";
  organizationScore.textContent = "-";
  fluencyScore.textContent = "-";
  strengthsList.innerHTML = "";
  suggestionsList.innerHTML = "";
  structureList.innerHTML = "";
}

function renderList(listElement, items) {
  listElement.innerHTML = "";

  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    listElement.appendChild(li);
  });
}

function renderAnalysisResult(result) {
  analysisEmpty.classList.add("hidden");
  analysisResults.classList.remove("hidden");
  transcriptOutput.textContent = result.transcript || "Transcript unavailable.";
  contentScore.textContent = result.scores?.content ?? "-";
  organizationScore.textContent = result.scores?.organization ?? "-";
  fluencyScore.textContent = result.scores?.fluency ?? "-";
  renderList(strengthsList, result.strengths || []);
  renderList(suggestionsList, result.suggestions || []);
  renderList(structureList, result.better_structure || []);

  requestAnimationFrame(() => {
    analysisResultsCard.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });
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

function savePracticeHistory(items) {
  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items));
}

function formatHistoryTime(timestamp) {
  try {
    return new Date(timestamp).toLocaleString();
  } catch (error) {
    return timestamp;
  }
}

function getSelectedRating(name) {
  const selected = document.querySelector(`input[name="${name}"]:checked`);
  return selected ? Number(selected.value) : null;
}

function getCurrentSelfRatings() {
  return {
    content: getSelectedRating("content"),
    organization: getSelectedRating("organization"),
    fluency: getSelectedRating("fluency")
  };
}

function hasAnySelfRating() {
  return Object.values(getCurrentSelfRatings()).some((value) => value !== null);
}

function updateSelfRatingSaveState() {
  saveSelfRatingBtn.disabled = !hasAnySelfRating();
}

function applySelfRatings(ratings = {}) {
  ["content", "organization", "fluency"].forEach((name) => {
    const inputs = document.querySelectorAll(`input[name="${name}"]`);
    inputs.forEach((input) => {
      input.checked = Number(input.value) === Number(ratings?.[name]);
    });
  });
}

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

function resetCurrentSessionHistoryLink() {
  currentHistoryItemId = null;
  currentAnalysisResult = null;
}

async function upsertPracticeHistoryItem(item) {
  const normalizedItem = normalizeHistoryItem(item);
  const audioReference =
    normalizedItem.audio_recording ||
    (currentAudioBlob ? createAudioReference(normalizedItem.id, currentAudioMimeType) : null);

  if (audioReference) {
    normalizedItem.audio_recording = audioReference;
  }

  if (currentAudioBlob && audioReference?.id) {
    await saveAudioRecording(audioReference.id, currentAudioBlob, currentAudioMimeType);
  }

  const items = getPracticeHistory();
  const existingIndex = items.findIndex((entry) => entry.id === normalizedItem.id);

  if (existingIndex >= 0) {
    items.splice(existingIndex, 1);
  }

  items.unshift(normalizedItem);
  savePracticeHistory(items.slice(0, 20));
  renderPracticeHistory();

  currentHistoryItemId = normalizedItem.id;
  currentAnalysisResult = normalizedItem;

  return normalizedItem;
}

function getProgressSessions(items) {
  return items.filter((item) =>
    [item.scores?.content, item.scores?.organization, item.scores?.fluency].every(
      (score) => Number.isFinite(Number(score))
    )
  );
}

function buildProgressCurveSvg(items) {
  const width = 640;
  const height = 240;
  const padding = { top: 24, right: 20, bottom: 36, left: 36 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const total = items.length;
  const scoreToY = (score) =>
    padding.top + ((5 - score) / 4) * innerHeight;
  const indexToX = (index) =>
    padding.left + (total === 1 ? innerWidth / 2 : (index / (total - 1)) * innerWidth);

  const series = [
    { key: "content", color: "#ff4d6d", label: "Content" },
    { key: "organization", color: "#ff8da1", label: "Organization" },
    { key: "fluency", color: "#d95d8c", label: "Fluency" }
  ];

  const gridLines = [1, 2, 3, 4, 5]
    .map((score) => {
      const y = scoreToY(score);
      return `
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#f3ccd6" stroke-width="1" />
        <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" font-size="12" fill="#8d6a74">${score}</text>
      `;
    })
    .join("");

  const xLabels = items
    .map((item, index) => {
      const x = indexToX(index);
      return `<text x="${x}" y="${height - 12}" text-anchor="middle" font-size="12" fill="#8d6a74">#${index + 1}</text>`;
    })
    .join("");

  const lineMarkup = series
    .map((entry) => {
      const points = items.map((item, index) => ({
        x: indexToX(index),
        y: scoreToY(Number(item.scores[entry.key]))
      }));

      const path = points
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
        .join(" ");

      const circles = points
        .map(
          (point) =>
            `<circle cx="${point.x}" cy="${point.y}" r="4.5" fill="${entry.color}" stroke="#fff7f9" stroke-width="2" />`
        )
        .join("");

      return `<path d="${path}" fill="none" stroke="${entry.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />${circles}`;
    })
    .join("");

  const legend = `
    <div class="progress-legend">
      ${series
        .map(
          (entry) => `
            <span class="progress-legend-item">
              <span class="progress-legend-swatch" style="background:${entry.color}"></span>
              ${entry.label}
            </span>
          `
        )
        .join("")}
    </div>
  `;

  const svg = `
    <svg class="progress-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Progress curve showing content, organization, and fluency scores over time">
      ${gridLines}
      <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#efbac8" stroke-width="1.2" />
      <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#efbac8" stroke-width="1.2" />
      ${lineMarkup}
      ${xLabels}
    </svg>
  `;

  return `${legend}${svg}`;
}

function openHistoryItem(item) {
  currentHistoryItemId = item.id;
  currentAnalysisResult = item;
  renderAnalysisResult(item);
  transcriptText = item.transcript || "";
  updateTranscriptPreview(transcriptText);
  applySelfRatings(item.self_ratings);
  updateSelfRatingSaveState();
  setAnalysisMessage("Showing a saved practice session from your history.");
}

function renderPracticeHistory() {
  if (!historyList || !historyEmpty || !progressCurve || !progressEmpty) {
    return;
  }

  const items = getPracticeHistory();
  historyList.innerHTML = "";
  renderProgressCurve(items);

  if (!items.length) {
    historyEmpty.classList.remove("hidden");
    return;
  }

  historyEmpty.classList.add("hidden");

  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-item";
    button.innerHTML = `
      <p class="history-item-title">${item.question}</p>
      <p class="history-item-time">${formatHistoryTime(item.timestamp)}</p>
      <p class="history-item-scores">AI Scores: C ${item.scores?.content ?? "-"} | O ${item.scores?.organization ?? "-"} | F ${item.scores?.fluency ?? "-"}</p>
      <p class="history-item-self">Self Ratings: C ${item.self_ratings?.content ?? "-"} | O ${item.self_ratings?.organization ?? "-"} | F ${item.self_ratings?.fluency ?? "-"}</p>
      <p class="history-item-preview">${item.transcript}</p>
    `;
    button.addEventListener("click", () => openHistoryItem(item));
    historyList.appendChild(button);
  });
}

function renderProgressCurve(items) {
  if (!progressCurve || !progressEmpty) {
    return;
  }

  const progressItems = getProgressSessions(items);

  if (progressItems.length < 2) {
    progressCurve.classList.add("hidden");
    progressEmpty.classList.remove("hidden");
    progressEmpty.textContent = "Complete at least 2 practice sessions to see your progress.";
    progressCurve.innerHTML = "";
    return;
  }

  progressEmpty.classList.add("hidden");
  progressCurve.classList.remove("hidden");
  progressCurve.innerHTML = buildProgressCurveSvg(progressItems);
}

function addPracticeHistoryItem(result) {
  const historyId = currentHistoryItemId || `history-${Date.now()}`;
  const historyItem = {
    id: historyId,
    question: QUESTION_BANK[currentQuestionIndex],
    transcript: result.transcript || "",
    scores: {
      content: result.scores?.content ?? null,
      organization: result.scores?.organization ?? null,
      fluency: result.scores?.fluency ?? null
    },
    self_ratings: getCurrentSelfRatings(),
    strengths: result.strengths || [],
    suggestions: result.suggestions || [],
    better_structure: result.better_structure || [],
    audio_recording: currentAudioBlob ? createAudioReference(historyId, currentAudioMimeType) : null,
    timestamp: new Date().toISOString()
  };

  return upsertPracticeHistoryItem(historyItem);
}

async function saveSelfRatingToHistory() {
  if (!hasAnySelfRating()) {
    return;
  }

  try {
    await audioFinalizePromise;

    const selfRatings = getCurrentSelfRatings();
    const items = getPracticeHistory();
    const existingItem = items.find((item) => item.id === currentHistoryItemId);
    const baseId = currentHistoryItemId || `history-${Date.now()}`;
    const baseItem =
      existingItem
        ? existingItem
        : normalizeHistoryItem({
            id: baseId,
            question: currentAnalysisResult?.question || QUESTION_BANK[currentQuestionIndex],
            transcript: transcriptText || transcriptOutput.textContent || "",
            timestamp: new Date().toISOString(),
            scores: currentAnalysisResult?.scores || {},
            strengths: currentAnalysisResult?.strengths || [],
            suggestions: currentAnalysisResult?.suggestions || [],
            better_structure: currentAnalysisResult?.better_structure || [],
            audio_recording:
              currentAnalysisResult?.audio_recording ||
              (currentAudioBlob ? createAudioReference(baseId, currentAudioMimeType) : null)
          });

    const updatedItem = {
      ...baseItem,
      question: baseItem.question || currentAnalysisResult?.question || QUESTION_BANK[currentQuestionIndex],
      transcript: baseItem.transcript || transcriptText || transcriptOutput.textContent || "",
      scores: {
        content: baseItem.scores?.content ?? currentAnalysisResult?.scores?.content ?? null,
        organization: baseItem.scores?.organization ?? currentAnalysisResult?.scores?.organization ?? null,
        fluency: baseItem.scores?.fluency ?? currentAnalysisResult?.scores?.fluency ?? null
      },
      strengths: baseItem.strengths?.length ? baseItem.strengths : currentAnalysisResult?.strengths || [],
      suggestions: baseItem.suggestions?.length ? baseItem.suggestions : currentAnalysisResult?.suggestions || [],
      better_structure:
        baseItem.better_structure?.length ? baseItem.better_structure : currentAnalysisResult?.better_structure || [],
      audio_recording:
        baseItem.audio_recording ||
        currentAnalysisResult?.audio_recording ||
        (currentAudioBlob ? createAudioReference(baseItem.id, currentAudioMimeType) : null),
      self_ratings: selfRatings
    };

    await upsertPracticeHistoryItem(updatedItem);
    window.location.href = "history.html";
  } catch (error) {
    console.error("Self rating save failed:", error);
    setAnalysisMessage("We could not save your self rating right now. Please try again.");
  }
}

function clearPracticeHistory() {
  window.localStorage.removeItem(HISTORY_STORAGE_KEY);
  clearAllAudioRecordings();
  resetCurrentSessionHistoryLink();
  renderPracticeHistory();
  setAnalysisMessage("Practice history cleared.");
}

function updateQuestion(index) {
  currentQuestionIndex = index;
  questionText.textContent = QUESTION_BANK[currentQuestionIndex];
  questionCounter.textContent = `Question ${currentQuestionIndex + 1} of ${QUESTION_BANK.length}`;
}

function showRandomQuestion() {
  if (QUESTION_BANK.length <= 1) {
    resetCurrentSessionHistoryLink();
    updateQuestion(0);
    return;
  }

  let nextIndex = currentQuestionIndex;

  while (nextIndex === currentQuestionIndex) {
    nextIndex = Math.floor(Math.random() * QUESTION_BANK.length);
  }

  resetCurrentSessionHistoryLink();
  updateQuestion(nextIndex);
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function generateFeedback() {
  const opinion = opinionInput.value.trim();
  const support = supportInput.value.trim();
  const unclear = unclearInput.value.trim();
  const feedbackParts = [];

  if (!opinion) {
    feedbackParts.push("Your main opinion is unclear.");
  } else {
    feedbackParts.push("Your opinion is clear.");
  }

  if (!support) {
    feedbackParts.push("Your supporting points are missing, so add two clear reasons.");
  } else if (countWords(support) < 10) {
    feedbackParts.push(
      "Your supporting points need more detail. Try adding specific examples or explanations."
    );
  } else {
    feedbackParts.push("Your supporting points give useful support to your answer.");
  }

  if (unclear) {
    feedbackParts.push(
      "You identified an unclear part, which is a strong revision habit. Try rewriting that section with simpler transitions or a more direct example."
    );
  }

  if (opinion && countWords(support) >= 10 && unclear) {
    feedbackParts.push(
      "Overall, you are reflecting thoughtfully like a careful speaker, and that will help you improve quickly."
    );
  } else if (opinion && countWords(support) >= 10 && !unclear) {
    feedbackParts.push(
      "Overall, this is a strong response. Keep the same clear structure and continue listening for small fluency improvements."
    );
  }

  feedbackText.textContent = feedbackParts.join(" ");
}

function updateTimerUI() {
  timeValue.textContent = countdown;

  if (currentPhase === "ready") {
    phaseBadge.textContent = "Ready";
    phaseTitle.textContent = "Preparation Time";
    phaseCopy.textContent =
      "Think of your opinion and two reasons before you begin speaking.";
    return;
  }

  if (currentPhase === "prep") {
    phaseBadge.textContent = "Prepare";
    phaseTitle.textContent = "Preparation Time";
    phaseCopy.textContent =
      "Use these seconds to plan your opinion, reasons, and examples.";
    return;
  }

  if (currentPhase === "speak") {
    phaseBadge.textContent = "Speak";
    phaseTitle.textContent = "Speaking Time";
    phaseCopy.textContent =
      "Start speaking clearly and keep your answer organized until time ends.";
    return;
  }

  phaseBadge.textContent = "Complete";
  phaseTitle.textContent = "Practice Finished";
  phaseCopy.textContent =
    "Nice work. Review your transcript and complete the reflection notes below.";
}

function clearTimer() {
  if (timerId) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

function resetPractice() {
  clearTimer();
  shouldStopRecognition = true;
  if (recognition && isRecognizing) {
    stopRecording({ silent: true });
  } else if (isAudioCapturing) {
    stopMediaCapture();
  }
  countdown = PREP_SECONDS;
  currentPhase = "ready";
  startPracticeBtn.disabled = false;
  updateTimerUI();
}

function startPractice() {
  if (currentPhase === "prep" || currentPhase === "speak") {
    return;
  }

  clearTimer();
  currentPhase = "prep";
  countdown = PREP_SECONDS;
  startPracticeBtn.disabled = true;
  updateTimerUI();

  timerId = window.setInterval(() => {
    countdown -= 1;

    if (countdown >= 0) {
      updateTimerUI();
    }

    if (countdown < 0 && currentPhase === "prep") {
      currentPhase = "speak";
      countdown = SPEAK_SECONDS;
      updateTimerUI();
      if (!isRecognizing && !isAudioCapturing) {
        void startRecording({ autoStart: true }).then((started) => {
          if (!started) {
            recordingStatus.textContent =
              "Automatic recording could not start. Please allow microphone access or use Chrome, then press Start Recording.";
          }
        });
      }
      return;
    }

    if (countdown < 0 && currentPhase === "speak") {
      currentPhase = "done";
      clearTimer();
      countdown = 0;
      shouldStopRecognition = true;
      startPracticeBtn.disabled = false;
      if (isRecognizing || isAudioCapturing) {
        stopRecording({ silent: true });
      }
      updateTimerUI();
    }
  }, 1000);
}

function initializeSpeechRecognition() {
  const SpeechRecognition = getSpeechRecognitionConstructor();

  if (!SpeechRecognition) {
    return null;
  }

  if (recognition) {
    return recognition;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onstart = () => {
    isRecognizing = true;
    setRecordingState(true);
    recordingStatus.textContent = "Listening now. Speak naturally and clearly.";
  };

  recognition.onresult = (event) => {
    let combinedTranscript = "";

    for (let index = 0; index < event.results.length; index += 1) {
      combinedTranscript += `${event.results[index][0].transcript} `;
    }

    transcriptText = combinedTranscript.trim();
    updateTranscriptPreview(transcriptText);
    setAnalyzeState(!transcriptText);
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);

    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      recordingStatus.textContent =
        "Microphone permission was blocked. Please allow microphone access and try again.";
    } else if (event.error === "no-speech") {
      recordingStatus.textContent =
        "No speech was detected. Try speaking a little closer to the microphone.";
    } else {
      recordingStatus.textContent =
        "Speech recognition had a problem. Please try again in Chrome.";
    }

    isRecognizing = false;
    setRecordingState(isAudioCapturing);
    setAnalyzeState(!transcriptText);
  };

  recognition.onend = () => {
    isRecognizing = false;
    setRecordingState(isAudioCapturing);
    setAnalyzeState(!transcriptText);

    if (!shouldStopRecognition && currentPhase === "speak") {
      try {
        recognition.start();
        return;
      } catch (error) {
        console.error("Speech recognition restart failed:", error);
      }
    }

    shouldStopRecognition = false;

    if (transcriptText) {
      recordingStatus.textContent =
        "Transcript captured. Review it below, then analyze your response.";
    } else {
      recordingStatus.textContent =
        "Speech capture stopped. Try again if your transcript is empty.";
    }
  };

  return recognition;
}

async function startRecording(options = {}) {
  const { autoStart = false } = options;
  const speechRecognition = initializeSpeechRecognition();

  if (!speechRecognition) {
    recordingStatus.textContent =
      "Speech recognition is not supported in this browser. Please use Chrome.";
    return false;
  }

  if (isRecognizing || isAudioCapturing) {
    return true;
  }

  try {
    shouldStopRecognition = false;
    resetCurrentSessionHistoryLink();
    transcriptText = "";
    clearCurrentAudio();
    updateTranscriptPreview("");
    resetAnalysisResults();
    setAnalyzeState(true);
    setAnalysisMessage(
      autoStart
        ? "Speaking time started. Your response is now being transcribed."
        : "Speak your answer, then click Analyze My Response."
    );
    const audioCaptureResult = await startMediaCapture();
    if (!audioCaptureResult.ok) {
      recordingStatus.textContent = audioCaptureResult.message;
    }
    speechRecognition.start();
    return true;
  } catch (error) {
    console.error("Speech recognition start failed:", error);
    stopMediaCapture();
    recordingStatus.textContent =
      autoStart
        ? "Automatic recording could not start. Please allow microphone access and try again."
        : "Speech recognition could not start. Please try again in Chrome.";
    return false;
  }
}

function stopRecording(options = {}) {
  const { silent = false } = options;
  const hasActiveRecognition = Boolean(recognition && isRecognizing);
  const hasActiveAudio = isAudioCapturing;

  if (!hasActiveRecognition && !hasActiveAudio) {
    if (!silent) {
      recordingStatus.textContent = "There is no active speech capture to stop right now.";
    }
    return;
  }

  shouldStopRecognition = true;
  if (hasActiveRecognition) {
    recognition.stop();
  }
  if (hasActiveAudio) {
    stopMediaCapture();
  }
}

async function analyzeResponse() {
  if (!transcriptText) {
    setAnalysisMessage("Please capture your spoken response before analysis.");
    return;
  }

  if (!backendConnected) {
    setAnalysisMessage(
      "The analysis service is not connected right now. Please refresh the page and try again."
    );
    return;
  }

  setAnalyzeState(true);
  resetAnalysisResults();
  clearAnalysisStatusTimer();
  setAnalysisMessage("Analyzing response...");

  try {
    await audioFinalizePromise;

    const response = await fetch("/api/analyze-speaking", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: QUESTION_BANK[currentQuestionIndex],
        transcript: transcriptText
      })
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const serverMessage =
        typeof payload === "string"
          ? payload
          : payload?.error || payload?.message || "Analysis failed.";
      throw new Error(serverMessage);
    }

    renderAnalysisResult(payload);
    await addPracticeHistoryItem(payload);
    updateSelfRatingSaveState();
    setAnalysisMessage("Analysis complete. Review your transcript and tutor feedback below.");
  } catch (error) {
    console.error("Analysis error:", error);
    const message =
      error instanceof TypeError
        ? "Connection failed. Tried: /api/analyze-speaking."
        : error.message || "We could not analyze your response right now. Please try again.";
    setAnalysisMessage(message);
  } finally {
    clearAnalysisStatusTimer();
    setAnalyzeState(false);
  }
}

async function checkBackendHealth() {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) {
      throw new Error(`Health check failed with status ${response.status}`);
    }

    const data = await response.json();
    if (data?.status !== "ok") {
      throw new Error("Health check returned an unexpected response.");
    }

    backendConnected = true;
    console.log("Backend health check:", data);
    setAnalysisMessage("Backend connected. Speak, then analyze your response.");
    return;
  } catch (error) {
    console.error("Backend health check failed:", error);
  }

  backendConnected = false;
  setAnalysisMessage("Could not connect to the backend. Tried: /api/health.");
}

startPracticeBtn.addEventListener("click", startPractice);
resetPracticeBtn.addEventListener("click", resetPractice);
startRecordingBtn.addEventListener("click", () => {
  void startRecording();
});
stopRecordingBtn.addEventListener("click", stopRecording);
analyzeBtn.addEventListener("click", analyzeResponse);
nextQuestionBtn.addEventListener("click", showRandomQuestion);
generateFeedbackBtn.addEventListener("click", generateFeedback);
if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener("click", clearPracticeHistory);
}

if (saveSelfRatingBtn) {
  saveSelfRatingBtn.addEventListener("click", saveSelfRatingToHistory);
}
document.querySelectorAll('input[name="content"], input[name="organization"], input[name="fluency"]').forEach((input) => {
  input.addEventListener("change", updateSelfRatingSaveState);
});

updateQuestion(0);
updateTimerUI();
resetAnalysisResults();
updateTranscriptPreview("");
renderRecordingReview();
updateSpeechSupportState();
renderPracticeHistory();
updateSelfRatingSaveState();
checkBackendHealth();
