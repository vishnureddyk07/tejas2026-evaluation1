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
      localStorage.setItem("tejus_admin_email", email);
      window.location.href = "/admin/dashboard";
    } catch (error) {
      setMessage(messageEl, error.message, true);
    }
  });
};

const renderGallery = (container, projects, onSelect) => {
  if (!container) return;
  container.innerHTML = "";
  // Update QR count box
  const countBox = document.getElementById("qr-count-box");
  const totalCount = window.projectCache ? window.projectCache.length : projects.length;
  if (countBox) {
    countBox.textContent = `Showing ${projects.length} of ${totalCount} QR codes`;
  }
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

const renderVotes = (tbody, votes, onReloadVotes) => {
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
      <td>${createdAt ? new Date(createdAt).toLocaleString() : ""}</td>
      <td><button class="delete-vote-btn" data-vote-id="${vote.id}" style="background:#ff5d5d; border:none; color:#fff; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px;">Delete</button></td>
    `;
    tbody.appendChild(row);

    // Add delete handler
    const deleteBtn = row.querySelector(".delete-vote-btn");
    deleteBtn.addEventListener("click", async () => {
      if (confirm("Are you sure you want to delete this vote?")) {
        try {
          console.log(`[DELETE] Deleting vote with ID: ${vote.id}`);
          const response = await apiFetch(`/api/admin/votes/${vote.id}`, {
            method: "DELETE"
          });
          console.log("[DELETE] Success:", response);
          alert("Vote deleted successfully!");
          if (onReloadVotes) await onReloadVotes(); // Reload votes
        } catch (error) {
          console.error("[DELETE] Error:", error);
          alert("Failed to delete vote: " + error.message);
        }
      }
    });
  });
};

let currentVotes = [];
let scoreSortState = 0; // 0: normal, 1: ascending, 2: descending

const initDashboard = async () => {
  const createBtn = document.getElementById("create-project");
  if (!createBtn) return;

  if (!getToken()) {
    window.location.href = "/admin/login";
    return;
  }

  // Show voting toggle only for developer
  const toggleVotingBtn = document.getElementById("toggle-voting-btn");
  if (toggleVotingBtn) {
    toggleVotingBtn.style.display = "inline-block";
  }
  // Voting toggle logic with status fetch and confirmation
  async function updateVotingToggleUI() {
    try {
      const status = await apiFetch("/api/admin/voting/status", { method: "GET" });
      if (toggleVotingBtn) {
        if (status.success && status.enabled) {
          toggleVotingBtn.textContent = "🔴 Stop Voting";
          toggleVotingBtn.style.background = "rgba(255,100,100,0.2)";
        } else if (status.success && !status.enabled) {
          toggleVotingBtn.textContent = "🟢 Start Voting";
          toggleVotingBtn.style.background = "rgba(100,255,100,0.2)";
        } else {
          toggleVotingBtn.textContent = "Voting Toggle (Error)";
        }
      }
    } catch (e) {
      if (toggleVotingBtn) toggleVotingBtn.textContent = "Voting Toggle (Error)";
    }
  }

  if (toggleVotingBtn) {
    await updateVotingToggleUI();
    toggleVotingBtn.addEventListener("click", async () => {
      try {
        const isEnabled = toggleVotingBtn.textContent.includes("Stop");
        const action = isEnabled ? "stop" : "start";
        const confirmMsg = isEnabled
          ? "Are you sure you want to STOP voting? This will prevent all users from voting."
          : "Are you sure you want to START voting? This will allow users to submit votes.";
        if (!window.confirm(confirmMsg)) return;
        await apiFetch(`/api/admin/voting/${action}`, { method: "POST" });
        setMessage(projectMessage, `Voting ${action === "start" ? "enabled" : "disabled"} successfully.`);
        await updateVotingToggleUI();
      } catch (error) {
        setMessage(projectMessage, error.message, true);
      }
    });
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
    // Expose projectCache globally for count box
    window.projectCache = projectCache;
    renderGallery(gallery, projectCache, setFormFromProject);
    // QR Gallery search bar logic
    const qrSearch = document.getElementById("qr-search");
    if (qrSearch) {
      qrSearch.value = "";
      qrSearch.oninput = function () {
        const q = qrSearch.value.trim().toLowerCase();
        if (!q) {
          renderGallery(gallery, projectCache, setFormFromProject);
          return;
        }
        const filtered = projectCache.filter(p =>
          (p.title && p.title.toLowerCase().includes(q)) ||
          (p.teamNumber && p.teamNumber.toLowerCase().includes(q)) ||
          (p.id && p.id.toLowerCase().includes(q))
        );
        renderGallery(gallery, filtered, setFormFromProject);
      };
    }
  };

  const updateTotalVotesPanel = (count) => {
    const panel = document.getElementById("total-votes-panel");
    if (panel) panel.textContent = count;
  };

  const loadVotes = async (filters = {}) => {
    // Remove empty filter values before sending to API
    const cleanFilters = {};
    Object.keys(filters).forEach(key => {
      const value = filters[key];
      if (value !== null && value !== undefined && value !== "") {
        cleanFilters[key] = value;
      }
    });
    
    const query = new URLSearchParams(cleanFilters).toString();
    const data = await apiFetch(`/api/admin/votes?${query}`);
    currentVotes = data.votes || [];
    // Update total votes panel (all time, not just filtered)
    if (data.totalVotes !== undefined) {
      updateTotalVotesPanel(data.totalVotes);
    } else if (data.stats && data.stats.count !== undefined) {
      updateTotalVotesPanel(data.stats.count);
    }
    scoreSortState = 0; // Reset sort state when loading new data
    document.getElementById("score-sort-indicator").textContent = "";
    renderVotes(resultsTable, currentVotes, loadVotes);
    
    // Display statistics
    const stats = data.stats || { count: 0, totalScore: 0, averageScore: 0 };
    const statsDiv = document.getElementById("filter-stats");
    const hasFilters = Object.keys(cleanFilters).length > 0;
    
    if (hasFilters && stats.count > 0) {
      document.getElementById("stat-count").textContent = stats.count;
      document.getElementById("stat-avg").textContent = stats.averageScore.toFixed(2);
      document.getElementById("stat-total").textContent = stats.totalScore;
      statsDiv.style.display = "block";
    } else {
      statsDiv.style.display = "none";
    }
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
      voterName: document.getElementById("filter-voter").value.trim(),
      minScore: document.getElementById("filter-min").value,
      maxScore: document.getElementById("filter-max").value
    };
    await loadVotes(filters);
  });

  document.getElementById("clear-filters").addEventListener("click", async () => {
    document.getElementById("filter-title").value = "";
    document.getElementById("filter-team").value = "";
    document.getElementById("filter-department").value = "";
    document.getElementById("filter-sector").value = "";
    document.getElementById("filter-voter").value = "";
    document.getElementById("filter-min").value = "";
    document.getElementById("filter-max").value = "";
    await loadVotes({});
  });

  document.getElementById("score-header").addEventListener("click", () => {
    scoreSortState = (scoreSortState + 1) % 3; // Cycle: 0 -> 1 -> 2 -> 0
    
    let sortedVotes = [...currentVotes];
    const indicator = document.getElementById("score-sort-indicator");
    
    if (scoreSortState === 1) {
      // Ascending
      sortedVotes.sort((a, b) => a.score - b.score);
      indicator.textContent = " ↑";
    } else if (scoreSortState === 2) {
      // Descending
      sortedVotes.sort((a, b) => b.score - a.score);
      indicator.textContent = " ↓";
    } else {
      // Normal (original order)
      indicator.textContent = "";
    }
    
    renderVotes(resultsTable, sortedVotes, loadVotes);
  });

  document.getElementById("download-all-qr").addEventListener("click", async () => {
    if (!projectCache || projectCache.length === 0) {
      alert("No QR codes available to download");
      return;
    }

    try {
      const zip = new JSZip();
      const imgFolder = zip.folder("tejas2026-qr-codes");

      for (const project of projectCache) {
        try {
          const qrUrl = project.qrDataUrl || `${API_URL}/qr/${project.id}.png`;
          
          // Fetch QR image as blob
          let blob;
          if (qrUrl.startsWith("data:")) {
            // Convert data URL to blob
            const response = await fetch(qrUrl);
            blob = await response.blob();
          } else {
            // Fetch from server
            const response = await fetch(qrUrl);
            if (!response.ok) throw new Error(`Failed to fetch QR for ${project.id}`);
            blob = await response.blob();
          }

          // Add to ZIP with filename: TeamNumber_ProjectTitle.png
          const filename = `${project.teamNumber || project.id}_${(project.title || "Project").replace(/[^a-zA-Z0-9]/g, "_")}.png`;
          imgFolder.file(filename, blob);
        } catch (err) {
          console.error(`Failed to add ${project.id} to ZIP:`, err);
        }
      }

      // Generate and download ZIP
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = `tejas2026-all-qr-codes-${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error("Error creating ZIP:", error);
      alert("Failed to create ZIP file. Please try again.");
    }
  });

  logoutBtn.addEventListener("click", () => {
    console.log("[AUTH] Logging out...");
    clearToken();
    window.location.href = "/admin/login";
  });

  // Developer Modal State
  let currentTab = "auth";
  let activityLogs = [];

  // Load activity logs
  async function loadActivityLogs(type = null) {
    try {
      const url = type ? `/api/admin/activity-logs?type=${type}&limit=200` : `/api/admin/activity-logs?limit=200`;
      const data = await apiFetch(url);
      activityLogs = data.logs || [];
      return activityLogs;
    } catch (error) {
      console.error("Failed to load activity logs:", error);
      return [];
    }
  }

  // Format details for display
  function formatDetails(details) {
    if (!details || typeof details !== 'object') return '-';
    
    const entries = Object.entries(details)
      .filter(([key]) => key !== 'ipAddress')
      .map(([key, value]) => {
        if (typeof value === 'object') {
          return `${key}: ${JSON.stringify(value)}`;
        }
        return `${key}: ${value}`;
      });
    
    return entries.join(', ') || '-';
  }

  // Format timestamp
  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  }

  // Render activity table
  function renderActivityTable(logs) {
    const tbody = document.getElementById("dev-table-body");
    const countEl = document.getElementById("dev-count");
    
    countEl.textContent = `${logs.length} entries`;
    
    if (logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#818CF8;">No activity logged yet</td></tr>';
      return;
    }

    tbody.innerHTML = logs.map(log => {
      const typeColor = {
        'auth': '#34D399',
        'project': '#818CF8',
        'vote': '#FBBF24',
        'filter': '#F472B6'
      }[log.type] || '#fff';

      const actionBadge = {
        'login_success': '✅',
        'login_failed': '❌',
        'create': '➕',
        'update': '✏️',
        'delete': '🗑️',
        'submit': '📝',
        'apply': '🔍'
      }[log.action] || '•';

      return `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.1);">
          <td style="padding:10px 8px; font-size:12px;">${formatTimestamp(log.timestamp)}</td>
          <td style="padding:10px 8px;"><span style="color:${typeColor}; font-weight:600;">${log.type}</span></td>
          <td style="padding:10px 8px;">${actionBadge} ${log.action}</td>
          <td style="padding:10px 8px; color:#34D399;">${log.user || '-'}</td>
          <td style="padding:10px 8px; font-family:monospace; font-size:11px;">${log.ipAddress || '-'}</td>
          <td style="padding:10px 8px; font-size:11px; max-width:300px; overflow:hidden; text-overflow:ellipsis;">${formatDetails(log.details)}</td>
        </tr>
      `;
    }).join('');
  }

  // Switch tab
  async function switchTab(tab) {
    currentTab = tab;
    
    // Update tab buttons
    document.querySelectorAll('.dev-tab').forEach(btn => {
      const isActive = btn.dataset.tab === tab;
      btn.style.background = isActive ? '#34D399' : 'rgba(255,255,255,0.2)';
      btn.style.color = isActive ? '#000' : '#fff';
      btn.style.fontWeight = isActive ? '600' : '400';
    });

    // Update title
    const titles = {
      'auth': '🔐 Authentication Activity',
      'project': '📁 Project Activity',
      'vote': '🗳️ Vote Activity',
      'filter': '🔍 Filter Activity',
      'all': '📊 All Activity'
    };
    document.getElementById("dev-table-title").textContent = titles[tab] || 'Activity Log';

    // Load and render logs
    const logs = await loadActivityLogs(tab === 'all' ? null : tab);
    renderActivityTable(logs);
  }

  // Open developer modal
  document.getElementById("developer-btn").addEventListener("click", async () => {
    try {
      // Load activity logs and show modal
      document.getElementById("developer-modal").style.display = "block";
      await switchTab('auth');

      // Load projects and votes for raw JSON view
      const [projectsData, votesData] = await Promise.all([
        apiFetch("/api/admin/projects"),
        apiFetch("/api/admin/votes")
      ]);
      
      document.getElementById("dev-projects").textContent = JSON.stringify(projectsData, null, 2);
      document.getElementById("dev-votes").textContent = JSON.stringify(votesData, null, 2);
    } catch (error) {
      alert("Failed to load developer data: " + error.message);
    }
  });

  // Tab click handlers
  document.querySelectorAll('.dev-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Toggle raw JSON
  document.getElementById("toggle-raw-json").addEventListener("click", (e) => {
    const container = document.getElementById("raw-json-container");
    const isVisible = container.style.display !== "none";
    container.style.display = isVisible ? "none" : "block";
    e.target.textContent = isVisible ? "▼ Show Raw JSON Data" : "▲ Hide Raw JSON Data";
  });

  // Close developer modal
  document.getElementById("close-developer").addEventListener("click", () => {
    document.getElementById("developer-modal").style.display = "none";
  });

  // Download activity logs as Excel
  document.getElementById("download-logs-btn").addEventListener("click", async () => {
    try {
      const downloadBtn = document.getElementById("download-logs-btn");
      const originalText = downloadBtn.textContent;
      downloadBtn.textContent = "⏳ Downloading...";
      downloadBtn.disabled = true;

      // Get current filter type
      const filterType = currentTab === 'all' ? '' : `&type=${currentTab}`;
      
      // Fetch the Excel file
      const response = await fetch(`${API_URL}/api/admin/download-activity-logs?limit=500${filterType}`, {
        headers: {
          Authorization: `Bearer ${getToken()}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to download logs");
      }

      // Create blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `activity-logs-${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      downloadBtn.textContent = originalText;
      downloadBtn.disabled = false;
    } catch (error) {
      console.error("Download error:", error);
      alert("Failed to download logs: " + error.message);
      document.getElementById("download-logs-btn").textContent = "⬇️ Download Excel";
      document.getElementById("download-logs-btn").disabled = false;
    }
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