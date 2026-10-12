const express = require("express");
const cors = require("cors");
const path = require("path");
const { readDB, writeDB, nextId } = require("./db");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- AUTH (very simplified — no hashing/JWT, demo only) ----------

app.post("/api/auth/student/login", (req, res) => {
  const { email, password } = req.body;
  const db = readDB();
  const student = db.students.find(s => s.email === email && s.password === password);
  if (!student) return res.status(401).json({ error: "Invalid student credentials" });
  const { password: _pw, ...safe } = student;
  res.json({ user: safe, role: "student" });
});

app.post("/api/auth/company/login", (req, res) => {
  const { email, password } = req.body;
  const db = readDB();
  const company = db.companies.find(c => c.email === email && c.password === password);
  if (!company) return res.status(401).json({ error: "Invalid company credentials" });
  const { password: _pw, ...safe } = company;
  res.json({ user: safe, role: "company" });
});

app.post("/api/auth/student/register", (req, res) => {
  const { name, email, password, branch, cgpa } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "Missing fields" });
  const db = readDB();
  if (db.students.some(s => s.email === email)) {
    return res.status(409).json({ error: "Email already registered" });
  }
  const student = {
    id: nextId("s", db.students),
    name, email, password,
    branch: branch || "N/A",
    cgpa: Number(cgpa) || 0,
    resumeLink: "",
  };
  db.students.push(student);
  writeDB(db);
  const { password: _pw, ...safe } = student;
  res.status(201).json({ user: safe, role: "student" });
});

// ---------- DRIVES (job postings) ----------

app.get("/api/drives", (req, res) => {
  const db = readDB();
  const drivesWithCompany = db.drives.map(d => ({
    ...d,
    company: db.companies.find(c => c.id === d.companyId)?.name || "Unknown",
  }));
  res.json(drivesWithCompany);
});

app.post("/api/drives", (req, res) => {
  const { companyId, role, description, minCgpa, eligibleBranches, package: pkg, lastDate } = req.body;
  const db = readDB();
  const company = db.companies.find(c => c.id === companyId);
  if (!company) return res.status(404).json({ error: "Company not found" });

  const drive = {
    id: nextId("d", db.drives),
    companyId, role, description,
    minCgpa: Number(minCgpa) || 0,
    eligibleBranches: eligibleBranches || [],
    package: pkg || "Not disclosed",
    lastDate: lastDate || "",
    status: "open",
  };
  db.drives.push(drive);
  writeDB(db);
  res.status(201).json(drive);
});

// Eligibility check: returns drives a given student actually qualifies for
app.get("/api/drives/eligible/:studentId", (req, res) => {
  const db = readDB();
  const student = db.students.find(s => s.id === req.params.studentId);
  if (!student) return res.status(404).json({ error: "Student not found" });

  const eligible = db.drives.filter(d =>
    d.status === "open" &&
    student.cgpa >= d.minCgpa &&
    d.eligibleBranches.includes(student.branch)
  ).map(d => ({
    ...d,
    company: db.companies.find(c => c.id === d.companyId)?.name || "Unknown",
  }));

  res.json(eligible);
});

// ---------- APPLICATIONS ----------

app.post("/api/applications", (req, res) => {
  const { studentId, driveId } = req.body;
  const db = readDB();

  const student = db.students.find(s => s.id === studentId);
  const drive = db.drives.find(d => d.id === driveId);
  if (!student || !drive) return res.status(404).json({ error: "Student or drive not found" });

  if (student.cgpa < drive.minCgpa || !drive.eligibleBranches.includes(student.branch)) {
    return res.status(403).json({ error: "Student is not eligible for this drive" });
  }
  if (db.applications.some(a => a.studentId === studentId && a.driveId === driveId)) {
    return res.status(409).json({ error: "Already applied to this drive" });
  }

  const application = {
    id: nextId("a", db.applications),
    studentId, driveId,
    status: "applied",
    appliedOn: new Date().toISOString().slice(0, 10),
  };
  db.applications.push(application);
  writeDB(db);
  res.status(201).json(application);
});

app.get("/api/applications/student/:studentId", (req, res) => {
  const db = readDB();
  const apps = db.applications
    .filter(a => a.studentId === req.params.studentId)
    .map(a => {
      const drive = db.drives.find(d => d.id === a.driveId);
      const company = db.companies.find(c => c.id === drive?.companyId);
      return { ...a, role: drive?.role, company: company?.name };
    });
  res.json(apps);
});

app.get("/api/applications/drive/:driveId", (req, res) => {
  const db = readDB();
  const apps = db.applications
    .filter(a => a.driveId === req.params.driveId)
    .map(a => {
      const student = db.students.find(s => s.id === a.studentId);
      return { ...a, studentName: student?.name, email: student?.email, cgpa: student?.cgpa };
    });
  res.json(apps);
});

// ---------- STATUS TRANSITIONS ----------

const VALID_STAGES = ["applied", "shortlisted", "interview", "selected", "rejected"];

app.patch("/api/applications/:id/status", (req, res) => {
  const { status } = req.body;
  if (!VALID_STAGES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STAGES.join(", ")}` });
  }
  const db = readDB();
  const app_ = db.applications.find(a => a.id === req.params.id);
  if (!app_) return res.status(404).json({ error: "Application not found" });
  app_.status = status;
  writeDB(db);
  res.json(app_);
});

// Helper for parsing compensation strings like "7.5 LPA", "3.6", "12.0 LPA"
function parsePackage(pkgStr) {
  if (!pkgStr) return 0;
  const match = String(pkgStr).match(/([0-9]+(?:\.[0-9]+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

// ---------- STATS & ADVANCED ANALYTICS ----------

app.get("/api/stats", (req, res) => {
  const db = readDB();
  const totalStudents = db.students.length;
  const totalCompanies = db.companies.length;
  const totalDrives = db.drives.length;
  const totalApplications = db.applications.length;
  const selectedCount = db.applications.filter(a => a.status === "selected").length;
  const shortlistedCount = db.applications.filter(a => a.status === "shortlisted").length;
  const interviewCount = db.applications.filter(a => a.status === "interview").length;

  res.json({
    totalStudents,
    totalCompanies,
    totalDrives,
    totalApplications,
    selectedCount,
    shortlistedCount,
    interviewCount,
    placementRate: totalStudents > 0 ? Math.round((selectedCount / totalStudents) * 100) : 0
  });
});

app.get("/api/analytics", (req, res) => {
  const db = readDB();
  const totalStudents = db.students.length;
  const totalCompanies = db.companies.length;
  const totalDrives = db.drives.length;
  const totalApplications = db.applications.length;

  // Compensation analytics
  const packages = db.drives.map(d => parsePackage(d.package)).filter(p => p > 0);
  const highestPackage = packages.length > 0 ? Math.max(...packages) : 0;
  const avgPackage = packages.length > 0 ? Number((packages.reduce((a, b) => a + b, 0) / packages.length).toFixed(2)) : 0;

  // Department / Branch distribution
  const branches = ["CSE", "IT", "ECE", "MECH", "CIVIL"];
  const branchBreakdown = branches.map(b => {
    const studentsInBranch = db.students.filter(s => s.branch === b);
    const placedStudents = studentsInBranch.filter(s =>
      db.applications.some(a => a.studentId === s.id && a.status === "selected")
    );
    return {
      branch: b,
      totalStudents: studentsInBranch.length,
      placedCount: placedStudents.length,
      placementRate: studentsInBranch.length > 0 ? Math.round((placedStudents.length / studentsInBranch.length) * 100) : 0
    };
  }).filter(b => b.totalStudents > 0);

  // Recruiter drive distribution
  const companyLeaderboard = db.companies.map(c => {
    const companyDrives = db.drives.filter(d => d.companyId === c.id);
    const driveIds = companyDrives.map(d => d.id);
    const offers = db.applications.filter(a => driveIds.includes(a.driveId) && a.status === "selected").length;
    return {
      companyName: c.name,
      drivesPosted: companyDrives.length,
      offersExtended: offers
    };
  });

  // Pipeline stages count
  const pipeline = {
    applied: db.applications.filter(a => a.status === "applied").length,
    shortlisted: db.applications.filter(a => a.status === "shortlisted").length,
    interview: db.applications.filter(a => a.status === "interview").length,
    selected: db.applications.filter(a => a.status === "selected").length,
    rejected: db.applications.filter(a => a.status === "rejected").length,
  };

  res.json({
    summary: {
      totalStudents,
      totalCompanies,
      totalDrives,
      totalApplications,
      highestPackageLPA: highestPackage,
      averagePackageLPA: avgPackage,
      overallPlacementRate: totalStudents > 0 ? Math.round((pipeline.selected / totalStudents) * 100) : 0
    },
    branchBreakdown,
    companyLeaderboard,
    pipeline
  });
});

// ---------- CSV REPORT EXPORT ----------

app.get("/api/export/drives.csv", (req, res) => {
  const db = readDB();
  const headers = ["Drive ID", "Company", "Role", "Min CGPA", "Eligible Branches", "Package", "Deadline", "Status"];
  const rows = db.drives.map(d => {
    const compName = db.companies.find(c => c.id === d.companyId)?.name || "N/A";
    const branches = (d.eligibleBranches || []).join(";");
    return [d.id, `"${compName}"`, `"${d.role}"`, d.minCgpa, `"${branches}"`, `"${d.package}"`, d.lastDate, d.status].join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="placement-drives.csv"');
  res.send(csv);
});

app.get("/api/export/applications.csv", (req, res) => {
  const db = readDB();
  const headers = ["Application ID", "Student Name", "Email", "Branch", "CGPA", "Company", "Role", "Status", "Applied On"];
  const rows = db.applications.map(a => {
    const student = db.students.find(s => s.id === a.studentId);
    const drive = db.drives.find(d => d.id === a.driveId);
    const comp = db.companies.find(c => c.id === drive?.companyId);
    return [
      a.id,
      `"${student?.name || 'N/A'}"`,
      `"${student?.email || 'N/A'}"`,
      student?.branch || "N/A",
      student?.cgpa || 0,
      `"${comp?.name || 'N/A'}"`,
      `"${drive?.role || 'N/A'}"`,
      a.status,
      a.appliedOn
    ].join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="campus-applications.csv"');
  res.send(csv);
});

// ---------- OPENAPI SPECIFICATION & SWAGGER UI ----------

const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Campus Placement Management System API",
    version: "1.1.0",
    description: "RESTful API services for students, recruiters, and placement officers to manage recruitment drives, candidate eligibility, and placement workflows."
  },
  servers: [{ url: "http://localhost:4000", description: "Local Development Server" }],
  paths: {
    "/api/stats": {
      get: { summary: "Get system overview statistics", responses: { 200: { description: "High-level KPI metrics" } } }
    },
    "/api/analytics": {
      get: { summary: "Get in-depth placement analytics and breakdown", responses: { 200: { description: "Department, salary, and pipeline breakdown" } } }
    },
    "/api/drives": {
      get: { summary: "List all placement drives", responses: { 200: { description: "Array of drives" } } },
      post: { summary: "Create a new placement drive", responses: { 201: { description: "Created drive" } } }
    },
    "/api/drives/eligible/{studentId}": {
      get: { summary: "List drives a specific student qualifies for", responses: { 200: { description: "Array of eligible drives" } } }
    },
    "/api/applications": {
      post: { summary: "Submit a new job application", responses: { 201: { description: "Created application" } } }
    },
    "/api/applications/{id}/status": {
      patch: { summary: "Update application workflow status", responses: { 200: { description: "Updated application" } } }
    },
    "/api/export/drives.csv": {
      get: { summary: "Download CSV report of placement drives", responses: { 200: { description: "CSV file" } } }
    },
    "/api/export/applications.csv": {
      get: { summary: "Download CSV report of applications", responses: { 200: { description: "CSV file" } } }
    }
  }
};

app.get("/api/openapi.json", (req, res) => {
  res.json(openApiSpec);
});

app.get("/api-docs", (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Campus Placement API Docs | Swagger UI</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; background: #0f172a; }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: "/api/openapi.json",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ]
      });
    };
  </script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`Campus Placement Management System running at http://localhost:${PORT}`);
  console.log(`Interactive API documentation available at http://localhost:${PORT}/api-docs`);
});
