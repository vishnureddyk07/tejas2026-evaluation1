const API_URL = "https://tejas2026-evaluation.onrender.com";

const state = {
  projectId: null,
  deviceHash: null,
  voterName: null,
  eligible: true
};

const elements = {
  title: document.getElementById("project-title"),
  teamNumber: document.getElementById("project-team-number"),
  sector: document.getElementById("project-sector"),
  department: document.getElementById("project-department"),
  nameInput: document.getElementById("voter-name"),
  slider: document.getElementById("score-slider"),
  scoreValue: document.getElementById("score-value"),
  scoreEmoji: document.getElementById("score-emoji"),
  scoreBar: document.getElementById("score-bar-fill"),
  submitButton: document.getElementById("submit-vote"),
  message: document.getElementById("vote-message"),
  successCard: document.getElementById("success-card"),
  successTimestamp: document.getElementById("success-timestamp")
};

const scoreMeta = [
  { min: 0, max: 3, emoji: "😞", color: "#ff5d5d" },
  { min: 4, max: 7, emoji: "🙂", color: "#ffcc4d" },
  { min: 8, max: 10, emoji: "😄", color: "#3ddc84" }
];

const getScoreMeta = (value) => scoreMeta.find((item) => value >= item.min && value <= item.max);

const setScoreUI = (value) => {
  const meta = getScoreMeta(value);
  elements.scoreValue.textContent = value;
  elements.scoreEmoji.textContent = meta.emoji;
  elements.scoreBar.style.width = `${value * 10}%`;
  elements.scoreBar.style.background = meta.color;
};

const getProjectId = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("projectId");
};

const hashString = async (input) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const getDeviceFingerprint = async () => {
  const fingerprintSource = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.platform
  ].join("::");

  return hashString(fingerprintSource);
};

const setMessage = (text, isError = false) => {
  elements.message.textContent = text;
  elements.message.style.color = isError ? "#ff9b9b" : "#cbe5ff";
};

const disableVoting = (message) => {
  elements.submitButton.disabled = true;
  elements.slider.disabled = true;
  elements.nameInput.disabled = true;
  setMessage(message, true);
};

const lockName = (name) => {
  if (name) {
    localStorage.setItem("tejas_voter_name", name);
    elements.nameInput.value = name;
    elements.nameInput.disabled = true;
  }
};

const fetchProject = async () => {
  const response = await fetch(`${API_URL}/api/projects/${encodeURIComponent(state.projectId)}`);
  if (!response.ok) {
    throw new Error("Project not found");
  }
  return response.json();
};

const checkEligibility = async () => {
  const response = await fetch(`${API_URL}/api/votes/check?projectId=${encodeURIComponent(state.projectId)}&deviceHash=${encodeURIComponent(state.deviceHash)}`);
  if (!response.ok) {
    throw new Error("Unable to verify eligibility");
  }
  return response.json();
};

const submitVote = async () => {
  const payload = {
    projectId: state.projectId,
    deviceHash: state.deviceHash,
    voterName: elements.nameInput.value.trim(),
    score: Number(elements.slider.value)
  };

  const response = await fetch(`${API_URL}/api/votes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Vote submission failed");
  }

  return data;
};

const showSuccess = (timestamp) => {
  const finalName = elements.nameInput.value.trim();
  if (finalName) {
    localStorage.setItem("tejas_voter_name", finalName);
  }
  elements.successTimestamp.textContent = `Submitted at ${new Date(timestamp).toLocaleString()}`;
  elements.successCard.classList.add("show");
  elements.submitButton.disabled = true;
  elements.slider.disabled = true;
  elements.nameInput.disabled = true;
  setMessage("", false);
};

const init = async () => {
  state.projectId = getProjectId();
  if (!state.projectId) {
    disableVoting("Invalid QR code. Project ID missing.");
    return;
  }

  // Show placeholders immediately
  elements.title.textContent = 'Loading...';
  elements.teamNumber.textContent = state.projectId;
  elements.sector.textContent = 'Loading...';
  elements.department.textContent = 'Loading...';

  const cachedName = localStorage.getItem("tejas_voter_name");
  if (cachedName) {
    lockName(cachedName);
  }

  setScoreUI(Number(elements.slider.value));

  elements.slider.addEventListener("input", (event) => {
    setScoreUI(Number(event.target.value));
  });

  elements.submitButton.addEventListener("click", async () => {
    elements.submitButton.disabled = true;
    setMessage("Submitting your vote...");
    try {
      const result = await submitVote();
      showSuccess(result.timestamp);
    } catch (error) {
      elements.submitButton.disabled = false;
      setMessage(error.message, true);
    }
  });

  // Start eligibility check and project fetch in parallel
  state.deviceHash = await getDeviceFingerprint();
  const projectPromise = fetchProject().then(project => {
    elements.title.textContent = project.title || 'No Title';
    elements.teamNumber.textContent = project.teamNumber || state.projectId;
    elements.sector.textContent = project.sector || '';
    elements.department.textContent = project.department || '';
  }).catch(() => {
    elements.title.textContent = 'Project not found';
    elements.sector.textContent = '';
    elements.department.textContent = '';
  });

  const eligibilityPromise = checkEligibility().then(eligibility => {
    if (eligibility.voterName) {
      lockName(eligibility.voterName);
    }
    if (!eligibility.eligible) {
      state.eligible = false;
      disableVoting("Vote already recorded for this project on this device.");
    }
  }).catch(() => {
    disableVoting("Unable to verify eligibility");
  });

  await Promise.all([projectPromise, eligibilityPromise]);
};

init();
