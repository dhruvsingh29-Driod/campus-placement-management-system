const API = "/api";
let currentUser = null; // { user, role }
let selectedRole = "student";

// ---------- API Wrapper ----------
async function apiCall(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function show(id) { document.getElementById(id).classList.remove("hidden"); }
function hide(id) { document.getElementById(id).classList.add("hidden"); }

// ---------- System-wide Stats Loader ----------
async function loadGlobalStats() {
  try {
    const res = await apiCall("/analytics");
    const summary = res.summary || {};
    document.getElementById("statDrives").textContent = summary.totalDrives ?? "0";
    document.getElementById("statStudents").textContent = summary.totalStudents ?? "0";
    document.getElementById("statApplications").textContent = summary.totalApplications ?? "0";
    document.getElementById("statOffers").textContent = res.pipeline?.selected ?? "0";
    
    const highestEl = document.getElementById("statHighest");
    if (highestEl) {
      highestEl.textContent = summary.highestPackageLPA ? `${summary.highestPackageLPA} LPA` : "—";
    }
    const rateEl = document.getElementById("statRate");
    if (rateEl) {
      rateEl.textContent = `${summary.overallPlacementRate ?? 0}%`;
    }
  } catch (err) {
    console.warn("Analytics error, falling back to basic stats:", err);
    try {
      const stats = await apiCall("/stats");
      document.getElementById("statDrives").textContent = stats.totalDrives ?? "0";
      document.getElementById("statStudents").textContent = stats.totalStudents ?? "0";
      document.getElementById("statApplications").textContent = stats.totalApplications ?? "0";
      document.getElementById("statOffers").textContent = stats.selectedCount ?? "0";
    } catch (e) {
      console.error(e);
    }
  }
}

// Initial stats fetch
loadGlobalStats();

// ---------- Tabs & Role Switching ----------
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.add("hidden"));
    document.getElementById(btn.dataset.tab).classList.remove("hidden");
  });
});

document.querySelectorAll(".role-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".role-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedRole = btn.dataset.role;
  });
});

// ---------- Quick Fill Demo Credentials ----------
document.getElementById("fillStudentDemo").addEventListener("click", () => {
  document.getElementById("roleStudentBtn").click();
  document.getElementById("loginEmail").value = "ananya@vit.edu";
  document.getElementById("loginPassword").value = "pass123";
});

document.getElementById("fillCompanyDemo").addEventListener("click", () => {
  document.getElementById("roleCompanyBtn").click();
  document.getElementById("loginEmail").value = "hr@tcs.com";
  document.getElementById("loginPassword").value = "pass123";
});

// ---------- Authentication (Login & Register) ----------
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();
  const errEl = document.getElementById("loginError");
  errEl.textContent = "";

  try {
    const data = await apiCall(`/auth/${selectedRole}/login`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    onLoginSuccess(data);
  } catch (err) {
    errEl.textContent = err.message;
  }
});

document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = {
    name: document.getElementById("regName").value.trim(),
    email: document.getElementById("regEmail").value.trim(),
    password: document.getElementById("regPassword").value.trim(),
    branch: document.getElementById("regBranch").value,
    cgpa: Number(document.getElementById("regCgpa").value),
  };
  const errEl = document.getElementById("registerError");
  errEl.textContent = "";

  try {
    const data = await apiCall("/auth/student/register", {
      method: "POST",
      body: JSON.stringify(body),
    });
    onLoginSuccess(data);
    loadGlobalStats();
  } catch (err) {
    errEl.textContent = err.message;
  }
});

function onLoginSuccess({ user, role }) {
  currentUser = { user, role };
  hide("authView");
  
  const userBadge = document.getElementById("userBadge");
  userBadge.classList.remove("hidden");
  document.getElementById("userAvatar").textContent = user.name ? user.name[0].toUpperCase() : "U";
  document.getElementById("userLabel").textContent = `${user.name} (${role.toUpperCase()})`;

  if (role === "student") {
    show("studentView");
    hide("companyView");
    loadStudentDashboard();
  } else {
    show("companyView");
    hide("studentView");
    loadCompanyDashboard();
  }
}

document.getElementById("logoutBtn").addEventListener("click", () => {
  currentUser = null;
  hide("studentView");
  hide("companyView");
  hide("userBadge");
  show("authView");
  loadGlobalStats();
});

// ---------- Student Dashboard ----------
async function loadStudentDashboard() {
  const student = currentUser.user;
  document.getElementById("studentWelcomeName").textContent = `Welcome back, ${student.name}! 👋`;
  document.getElementById("studentWelcomeMeta").textContent = `Branch: ${student.branch}  |  CGPA: ${student.cgpa}  |  Email: ${student.email}`;

  // Fetch drives user qualifies for
  const drives = await apiCall(`/drives/eligible/${student.id}`);
  const container = document.getElementById("eligibleDrives");
  document.getElementById("eligibleCountLabel").textContent = `${drives.length} drives matched your profile`;
  container.innerHTML = "";

  if (drives.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 2.5rem; background: var(--bg-surface); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
        <p style="color: var(--text-muted); font-size: 1.05rem;">No open drives currently match your CGPA & branch criteria.</p>
        <p style="color: var(--text-subtle); font-size: 0.85rem; margin-top: 0.5rem;">New companies post drives regularly — please check back soon.</p>
      </div>
    `;
  }

  // Fetch existing applications to toggle button state
  const existingApps = await apiCall(`/applications/student/${student.id}`);
  const appliedDriveIds = new Set(existingApps.map(a => a.driveId));

  drives.forEach(d => {
    const isApplied = appliedDriveIds.has(d.id);
    const card = document.createElement("div");
    card.className = "drive-card";
    
    const branchTagsHtml = d.eligibleBranches.map(b => `<span class="badge badge-branch">${b}</span>`).join(" ");

    card.innerHTML = `
      <div>
        <div class="drive-header">
          <div class="drive-title-group">
            <h3>${d.role}</h3>
            <div class="drive-company-name">🏢 ${d.company}</div>
          </div>
          <span class="package-badge">💰 ${d.package}</span>
        </div>
        <p class="drive-description">${d.description}</p>
        <div class="drive-criteria">
          <div class="criteria-row"><span>Cutoff Requirement:</span> <strong>≥ ${d.minCgpa} CGPA</strong></div>
          <div class="criteria-row"><span>Application Deadline:</span> <strong>${d.lastDate || "Rolling"}</strong></div>
          <div class="branch-tags">${branchTagsHtml}</div>
        </div>
      </div>
      <div>
        <button class="btn-apply" data-drive="${d.id}" ${isApplied ? "disabled" : ""}>
          ${isApplied ? "Application Submitted ✓" : "Apply for Drive 🚀"}
        </button>
      </div>
    `;

    const btn = card.querySelector("button");
    if (!isApplied) {
      btn.addEventListener("click", async () => {
        try {
          btn.disabled = true;
          btn.textContent = "Submitting...";
          await apiCall("/applications", {
            method: "POST",
            body: JSON.stringify({ studentId: student.id, driveId: d.id }),
          });
          btn.textContent = "Application Submitted ✓";
          loadMyApplications();
          loadGlobalStats();
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
          btn.textContent = "Apply for Drive 🚀";
        }
      });
    }

    container.appendChild(card);
  });

  loadMyApplications();
}

async function loadMyApplications() {
  const apps = await apiCall(`/applications/student/${currentUser.user.id}`);
  const tbody = document.getElementById("myApplicationsBody");

  if (!apps || apps.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No applications submitted yet. Browse eligible drives above to apply!</td></tr>`;
    return;
  }

  tbody.innerHTML = apps.map(a => `
    <tr>
      <td><strong>${a.role || "—"}</strong></td>
      <td>🏢 ${a.company || "—"}</td>
      <td><span class="badge badge-status status-${a.status}">${a.status}</span></td>
      <td>${a.appliedOn}</td>
    </tr>
  `).join("");
}

// ---------- Company Dashboard ----------
document.getElementById("driveForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const branches = Array.from(document.getElementById("driveBranches").selectedOptions).map(o => o.value);
  const body = {
    companyId: currentUser.user.id,
    role: document.getElementById("driveRole").value.trim(),
    description: document.getElementById("driveDescription").value.trim(),
    minCgpa: Number(document.getElementById("driveMinCgpa").value),
    eligibleBranches: branches,
    package: document.getElementById("drivePackage").value.trim(),
    lastDate: document.getElementById("driveLastDate").value,
  };

  try {
    await apiCall("/drives", { method: "POST", body: JSON.stringify(body) });
    e.target.reset();
    alert("Placement Drive published successfully! Eligible students can now apply.");
    loadCompanyDashboard();
    loadGlobalStats();
  } catch (err) {
    alert(err.message);
  }
});

async function loadCompanyDashboard() {
  const company = currentUser.user;
  document.getElementById("companyWelcomeName").textContent = `${company.name} Recruiter Portal 🏢`;

  const allDrives = await apiCall("/drives");
  const myDrives = allDrives.filter(d => d.companyId === company.id);

  const container = document.getElementById("companyDrives");
  container.innerHTML = "";

  if (myDrives.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 2rem; background: var(--bg-surface); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
        <p style="color: var(--text-muted);">No drives posted yet. Fill out the form above to announce a recruitment drive.</p>
      </div>
    `;
  } else {
    myDrives.forEach(d => {
      const card = document.createElement("div");
      card.className = "drive-card";
      const branchTagsHtml = d.eligibleBranches.map(b => `<span class="badge badge-branch">${b}</span>`).join(" ");

      card.innerHTML = `
        <div>
          <div class="drive-header">
            <div class="drive-title-group">
              <h3>${d.role}</h3>
              <div class="drive-company-name">Status: <span style="color:var(--accent-emerald)">Active</span></div>
            </div>
            <span class="package-badge">${d.package}</span>
          </div>
          <p class="drive-description">${d.description}</p>
          <div class="drive-criteria">
            <div class="criteria-row"><span>Min Cutoff:</span> <strong>${d.minCgpa} CGPA</strong></div>
            <div class="criteria-row"><span>Deadline:</span> <strong>${d.lastDate || "Rolling"}</strong></div>
            <div class="branch-tags">${branchTagsHtml}</div>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // Populate Drive Selector for reviewing applicants
  const selector = document.getElementById("driveSelector");
  selector.innerHTML = myDrives.map(d => `<option value="${d.id}">${d.role} (${d.package})</option>`).join("");
  
  if (myDrives.length) {
    loadApplicants(myDrives[0].id);
    selector.onchange = () => loadApplicants(selector.value);
  } else {
    document.getElementById("applicantsBody").innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">Post a drive to view candidate applications.</td></tr>`;
  }
}

async function loadApplicants(driveId) {
  const apps = await apiCall(`/applications/drive/${driveId}`);
  const tbody = document.getElementById("applicantsBody");

  if (!apps || apps.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">No candidates have applied for this drive yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = apps.map(a => `
    <tr>
      <td><strong>${a.studentName || "Candidate"}</strong></td>
      <td>${a.email || "—"}</td>
      <td>⭐ ${a.cgpa ?? "—"}</td>
      <td><span class="badge badge-status status-${a.status}">${a.status}</span></td>
      <td>
        <select class="status-select" data-app="${a.id}">
          ${["applied", "shortlisted", "interview", "selected", "rejected"].map(s =>
            `<option value="${s}" ${s === a.status ? "selected" : ""}>${s.toUpperCase()}</option>`
          ).join("")}
        </select>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll("select[data-app]").forEach(sel => {
    sel.addEventListener("change", async () => {
      try {
        await apiCall(`/applications/${sel.dataset.app}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: sel.value }),
        });
        loadApplicants(driveId);
        loadGlobalStats();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}
