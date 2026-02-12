const tokenKey = "tejus_admin_token";
const API_URL = "https://tejas2026-evaluation.onrender.com";

const setMessage = (el, text, isError = false) => {
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? "#ff9b9b" : "#cbe5ff";
};

const saveToken = (token) => localStorage.setItem(tokenKey, token);
const getToken = () => localStorage.getItem(tokenKey);
const clearToken = () => localStorage.removeItem(tokenKey);

const apiFetch = async (url, options = {}) => {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const fullUrl = url.startsWith("http") ? url : `${API_URL}${url}`;
  const response = await fetch(fullUrl, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  
  // Check for authorization errors
  if (response.status === 401) {
    console.warn("[AUTH] Token expired or invalid, redirecting to login");
    clearToken();
    window.location.href = "/admin/login";
    throw new Error("Session expired. Please login again.");
  }
  
  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }
  return data;
};

const initLogin = () => {
  const loginBtn = document.getElementById("login-btn");
  if (!loginBtn) return;

  const messageEl = document.getElementById("login-message");
  loginBtn.addEventListener("click", async () => {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    setMessage(messageEl, "Signing in...");
    try {
      const result = await apiFetch("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      saveToken(result.token);
      window.location.href = "/admin/dashboard";
    } catch (error) {
      setMessage(messageEl, error.message, true);
    }
  });
};

const renderGallery = (container, projects, onSelect) => {
  if (!container) return;
  container.innerHTML = "";
  projects.forEach((project) => {
    const item = document.createElement("div");
    item.className = "qr-item";
    const qrSrc = project.qrDataUrl || `${API_URL}/qr/${project.id}.png`;
    item.innerHTML = `
      <img src="${qrSrc}" alt="${project.id}" />
      <div>
        <div><strong>${project.id}</strong> — ${project.title}</div>
        <div class="muted">${project.category || project.sector || ""}</div>
      </div>
      <button class="download-qr-btn" data-project-id="${project.id}" title="Download QR">⬇️</button>
    `;
    item.addEventListener("click", (e) => {
      if (!e.target.classList.contains("download-qr-btn")) {
        onSelect(project);
      }
    });
    
    const downloadBtn = item.querySelector(".download-qr-btn");
    downloadBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const link = document.createElement("a");
      link.href = qrSrc;
      link.download = `${project.id}-qr.png`;
      link.click();
    });
    
    container.appendChild(item);
  });
};

const renderVotes = (tbody, votes) => {
  if (!tbody) return;
  tbody.innerHTML = "";
  votes.forEach((vote) => {
    const row = document.createElement("tr");
    const createdAt = vote.created_at || vote.createdAt;
    row.innerHTML = `
      <td>${vote.teamNumber || vote.project_id || vote.projectId}</td>
      <td>${vote.projectTitle || ""}</td>
      <td>${vote.department || ""}</td>
      <td>${vote.sector || ""}</td>
      <td>${vote.score}</td>
      <td>${vote.voter_name || vote.voterName || ""}</td>
      <td>${vote.device_hash || vote.deviceHash}</td>
      <td>${createdAt ? new Date(createdAt).toLocaleString() : ""}</td>
    `;
    tbody.appendChild(row);
  });
};

const initDashboard = async () => {
  const createBtn = document.getElementById("create-project");
  if (!createBtn) return;

  if (!getToken()) {
    window.location.href = "/admin/login";
    return;
  }

  const projectMessage = document.getElementById("project-message");
  const qrPreview = document.getElementById("qr-preview");
  const gallery = document.getElementById("qr-gallery");
  const resultsTable = document.getElementById("results-table");
  const logoutBtn = document.getElementById("logout-btn");
  const currentProject = document.getElementById("current-project");
  const updateBtn = document.getElementById("update-project");
  const deleteBtn = document.getElementById("delete-project");

  let selectedProjectId = null;
  let projectCache = [];
  let currentQrDataUrl = null;

  const downloadQr = async () => {
    if (!currentQrDataUrl || !selectedProjectId) return;
    const link = document.createElement("a");
    link.href = currentQrDataUrl;
    link.download = `${selectedProjectId}-qr.png`;
    link.click();
  };

  const inputs = {
    teamNumber: document.getElementById("project-team-number"),
    sector: document.getElementById("project-sector"),
    title: document.getElementById("project-title"),
    department: document.getElementById("project-department")
  };

  const resetForm = () => {
    selectedProjectId = null;
    currentQrDataUrl = null;
    document.getElementById("current-project").textContent = "No project selected";
    document.getElementById("update-project").disabled = true;
    document.getElementById("delete-project").disabled = true;
    document.getElementById("download-qr").disabled = true;
    inputs.teamNumber.value = "";
    inputs.sector.value = "";
    inputs.title.value = "";
    inputs.department.value = "";
    qrPreview.innerHTML = "";
  };

  const setFormFromProject = (project) => {
    selectedProjectId = project.id;
    currentQrDataUrl = project.qrDataUrl || `${API_URL}/qr/${project.id}.png`;
    document.getElementById("current-project").textContent = `Editing ${project.id}`;
    document.getElementById("update-project").disabled = false;
    document.getElementById("delete-project").disabled = false;
    document.getElementById("download-qr").disabled = false;
    inputs.teamNumber.value = project.teamNumber || project.id || "";
    inputs.sector.value = project.sector || project.category || "";
    inputs.title.value = project.title || "";
    inputs.department.value = project.department || "";
    const qrSrc = project.qrDataUrl || `${API_URL}/qr/${project.id}.png`;
    qrPreview.innerHTML = `<img src="${qrSrc}" alt="QR" style="max-width: 300px; border-radius: 8px;" />`;
  };

  const loadProjects = async () => {
    const data = await apiFetch("/api/admin/projects");
    projectCache = data.projects || [];
    renderGallery(gallery, projectCache, setFormFromProject);
  };

  const loadVotes = async (filters = {}) => {
    const query = new URLSearchParams(filters).toString();
    const data = await apiFetch(`/api/admin/votes?${query}`);
    renderVotes(resultsTable, data.votes || []);
  };

  createBtn.addEventListener("click", async () => {
    const teamNumber = inputs.teamNumber.value.trim();
    if (!teamNumber) {
      setMessage(projectMessage, "Team Number is required", true);
      return;
    }
    const payload = {
      teamNumber: teamNumber,
      sector: inputs.sector.value.trim(),
      title: inputs.title.value.trim(),
      department: inputs.department.value.trim()
    };
    setMessage(projectMessage, "Generating QR...");
    try {
      const result = await apiFetch("/api/admin/projects", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      
      // Immediately display the QR
      currentQrDataUrl = result.qrDataUrl;
      qrPreview.innerHTML = `<img src="${result.qrDataUrl}" alt="QR" style="max-width: 300px; border-radius: 8px;" />`;
      selectedProjectId = result.project.id;
      document.getElementById("download-qr").disabled = false;
      setMessage(projectMessage, `✓ Created ${result.project.id} - Saving data...`);
      
      // Reload projects list in the background
      await loadProjects();
      
      // Once projects are loaded, verify the new project is in the list
      const newProject = projectCache.find(p => p.id === result.project.id);
      if (newProject) {
        setMessage(projectMessage, `✓ Created and saved ${result.project.id}`);
      }
    } catch (error) {
      setMessage(projectMessage, error.message, true);
      currentQrDataUrl = null;
      document.getElementById("download-qr").disabled = true;
    }
  });

  document.getElementById("update-project").addEventListener("click", async () => {
    if (!selectedProjectId) return;
    const payload = {
      sector: inputs.sector.value.trim(),
      title: inputs.title.value.trim(),
      department: inputs.department.value.trim()
    };
    setMessage(projectMessage, "Updating project...");
    try {
      await apiFetch(`/api/admin/projects/${encodeURIComponent(selectedProjectId)}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      setMessage(projectMessage, `Updated ${selectedProjectId}`);
      await loadProjects();
    } catch (error) {
      setMessage(projectMessage, error.message, true);
    }
  });

  document.getElementById("delete-project").addEventListener("click", async () => {
    if (!selectedProjectId) return;
    if (!confirm(`Delete project ${selectedProjectId}? This removes QR and votes.`)) return;
    setMessage(projectMessage, "Deleting project...");
    try {
      await apiFetch(`/api/admin/projects/${encodeURIComponent(selectedProjectId)}`, {
        method: "DELETE"
      });
      setMessage(projectMessage, `Deleted ${selectedProjectId}`);
      resetForm();
      await loadProjects();
    } catch (error) {
      setMessage(projectMessage, error.message, true);
    }
  });

  document.getElementById("download-qr").addEventListener("click", downloadQr);

  document.getElementById("apply-filters").addEventListener("click", async () => {
    const filters = {
      projectTitle: document.getElementById("filter-title").value.trim(),
      teamNumber: document.getElementById("filter-team").value.trim(),
      department: document.getElementById("filter-department").value.trim(),
      sector: document.getElementById("filter-sector").value.trim(),
      minScore: document.getElementById("filter-min").value,
      maxScore: document.getElementById("filter-max").value
    };
    await loadVotes(filters);
  });

  logoutBtn.addEventListener("click", () => {
    console.log("[AUTH] Logging out...");
    clearToken();
    window.location.href = "/admin/login";
  });

  try {
    console.log("[DASHBOARD] Initializing dashboard...");
    resetForm();
    await loadProjects();
    console.log("[DASHBOARD] ✓ Projects loaded, loading votes...");
    await loadVotes();
    console.log("[DASHBOARD] ✓ Dashboard initialized");
  } catch (error) {
    console.error("[DASHBOARD] Initialization error:", error.message);
    if (error.message.includes("Session expired") || error.message.includes("Unauthorized")) {
      setMessage(projectMessage, "Session expired. Please login again.", true);
      setTimeout(() => {
        clearToken();
        window.location.href = "/admin/login";
      }, 2000);
    } else {
      setMessage(projectMessage, error.message, true);
    }
  }
};

initLogin();
initDashboard();