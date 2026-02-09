const tokenKey = "tejus_admin_token";

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
  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
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
    item.innerHTML = `
      <img src="/qr/${project.id}.png" alt="${project.id}" />
      <div>
        <div><strong>${project.id}</strong> — ${project.title}</div>
        <div class="muted">${project.category || project.sector || ""}</div>
      </div>
    `;
    item.addEventListener("click", () => onSelect(project));
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
      <td>${vote.project_id || vote.projectId}</td>
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

  const inputs = {
    title: document.getElementById("project-title"),
    sector: document.getElementById("project-sector"),
    department: document.getElementById("project-department"),
    members: document.getElementById("project-members"),
    abstract: document.getElementById("project-abstract")
  };

  const resetForm = () => {
    selectedProjectId = null;
    currentProject.textContent = "No project selected";
    updateBtn.disabled = true;
    deleteBtn.disabled = true;
    inputs.title.value = "";
    inputs.sector.value = "";
    inputs.department.value = "";
    inputs.members.value = "";
    inputs.abstract.value = "";
    qrPreview.innerHTML = "";
  };

  const setFormFromProject = (project) => {
    selectedProjectId = project.id;
    currentProject.textContent = `Editing ${project.id}`;
    updateBtn.disabled = false;
    deleteBtn.disabled = false;
    inputs.title.value = project.title || "";
    inputs.sector.value = project.sector || project.category || "";
    inputs.department.value = project.department || "";
    inputs.members.value = project.team_members || project.teamMembers || "";
    inputs.abstract.value = project.abstract || project.description || "";
    qrPreview.innerHTML = `<img src="/qr/${project.id}.png" alt="QR" />`;
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
    const payload = {
      title: inputs.title.value.trim(),
      sector: inputs.sector.value.trim(),
      department: inputs.department.value.trim(),
      teamMembers: inputs.members.value.trim(),
      abstract: inputs.abstract.value.trim()
    };
    setMessage(projectMessage, "Generating QR...");
    try {
      const result = await apiFetch("/api/admin/projects", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      qrPreview.innerHTML = `<img src="${result.qrDataUrl}" alt="QR" />`;
      setMessage(projectMessage, `Created ${result.project.id}`);
      resetForm();
      await loadProjects();
    } catch (error) {
      setMessage(projectMessage, error.message, true);
    }
  });

  updateBtn.addEventListener("click", async () => {
    if (!selectedProjectId) return;
    const payload = {
      title: inputs.title.value.trim(),
      sector: inputs.sector.value.trim(),
      department: inputs.department.value.trim(),
      teamMembers: inputs.members.value.trim(),
      abstract: inputs.abstract.value.trim()
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

  deleteBtn.addEventListener("click", async () => {
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

  document.getElementById("apply-filters").addEventListener("click", async () => {
    const filters = {
      projectId: document.getElementById("filter-project").value.trim(),
      minScore: document.getElementById("filter-min").value,
      maxScore: document.getElementById("filter-max").value,
      from: document.getElementById("filter-from").value,
      to: document.getElementById("filter-to").value
    };
    await loadVotes(filters);
  });

  logoutBtn.addEventListener("click", () => {
    clearToken();
    window.location.href = "/admin/login";
  });

  try {
    resetForm();
    await loadProjects();
    await loadVotes();
  } catch (error) {
    setMessage(projectMessage, error.message, true);
  }
};

initLogin();
initDashboard();