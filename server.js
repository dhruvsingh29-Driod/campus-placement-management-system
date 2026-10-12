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

app.patch("/api/applications/:id/status", (req, res) => {
  const { status } = req.body; // "applied" | "shortlisted" | "rejected" | "selected"
  const db = readDB();
  const app_ = db.applications.find(a => a.id === req.params.id);
  if (!app_) return res.status(404).json({ error: "Application not found" });
  app_.status = status;
  writeDB(db);
  res.json(app_);
});

// ---------- STATS (System-wide metrics) ----------

app.get("/api/stats", (req, res) => {
  const db = readDB();
  const totalStudents = db.students.length;
  const totalCompanies = db.companies.length;
  const totalDrives = db.drives.length;
  const totalApplications = db.applications.length;
  const selectedCount = db.applications.filter(a => a.status === "selected").length;
  const shortlistedCount = db.applications.filter(a => a.status === "shortlisted").length;

  res.json({
    totalStudents,
    totalCompanies,
    totalDrives,
    totalApplications,
    selectedCount,
    shortlistedCount,
    placementRate: totalStudents > 0 ? Math.round((selectedCount / totalStudents) * 100) : 0
  });
});

app.listen(PORT, () => {
  console.log(`Campus Placement Management System running at http://localhost:${PORT}`);
});
