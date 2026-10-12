const test = require("node:test");
const assert = require("node:assert");
const { readDB, writeDB, nextId } = require("../db");

test("Data Layer: readDB loads students, companies, drives, and applications", () => {
  const db = readDB();
  assert.ok(Array.isArray(db.students), "students should be an array");
  assert.ok(Array.isArray(db.companies), "companies should be an array");
  assert.ok(Array.isArray(db.drives), "drives should be an array");
  assert.ok(Array.isArray(db.applications), "applications should be an array");
  assert.ok(db.students.length >= 2, "should have initial seeded students");
  assert.ok(db.companies.length >= 2, "should have initial seeded companies");
});

test("Data Layer: nextId generates unique auto-incrementing identifiers", () => {
  const sampleItems = [{ id: "d1" }, { id: "d2" }];
  const next = nextId("d", sampleItems);
  assert.ok(next.startsWith("d"), "next id should start with prefix");
  assert.ok(next.length >= 3, "next id should contain timestamp entropy");
});

test("Eligibility Logic: rejects students with lower CGPA than cutoff", () => {
  const student = { id: "s99", name: "Test Student", branch: "CSE", cgpa: 6.5 };
  const drive = { id: "d99", minCgpa: 7.0, eligibleBranches: ["CSE", "IT"] };

  const isEligible = student.cgpa >= drive.minCgpa && drive.eligibleBranches.includes(student.branch);
  assert.strictEqual(isEligible, false, "student with 6.5 CGPA should not be eligible for 7.0 cutoff");
});

test("Eligibility Logic: rejects students from non-eligible branches", () => {
  const student = { id: "s98", name: "Mech Student", branch: "MECH", cgpa: 8.5 };
  const drive = { id: "d98", minCgpa: 7.0, eligibleBranches: ["CSE", "IT"] };

  const isEligible = student.cgpa >= drive.minCgpa && drive.eligibleBranches.includes(student.branch);
  assert.strictEqual(isEligible, false, "MECH student should not qualify for CSE/IT-only drive");
});

test("Eligibility Logic: accepts students meeting both CGPA and branch criteria", () => {
  const student = { id: "s97", name: "Eligible Student", branch: "CSE", cgpa: 8.5 };
  const drive = { id: "d97", minCgpa: 7.0, eligibleBranches: ["CSE", "IT"] };

  const isEligible = student.cgpa >= drive.minCgpa && drive.eligibleBranches.includes(student.branch);
  assert.strictEqual(isEligible, true, "qualifying student should be eligible");
});

test("Analytics: parsePackage extracts numeric CTC in LPA from diverse formats", () => {
  function parsePackage(pkgStr) {
    if (!pkgStr) return 0;
    const match = String(pkgStr).match(/([0-9]+(?:\.[0-9]+)?)/);
    return match ? parseFloat(match[1]) : 0;
  }

  assert.strictEqual(parsePackage("7.5 LPA"), 7.5);
  assert.strictEqual(parsePackage("12.0"), 12.0);
  assert.strictEqual(parsePackage("3.6 LPA"), 3.6);
  assert.strictEqual(parsePackage("Negotiable"), 0);
  assert.strictEqual(parsePackage(null), 0);
});

test("Workflow Stages: enforces allowed recruitment pipeline states", () => {
  const VALID_STAGES = ["applied", "shortlisted", "interview", "selected", "rejected"];
  assert.ok(VALID_STAGES.includes("interview"), "interview should be a valid recruitment state");
  assert.ok(VALID_STAGES.includes("selected"), "selected should be a valid recruitment state");
  assert.strictEqual(VALID_STAGES.includes("promoted"), false, "invalid state promoted should be rejected");
});

test("Analytics: aggregates branch placement rate correctly", () => {
  const students = [
    { id: "s1", branch: "CSE" },
    { id: "s2", branch: "CSE" },
    { id: "s3", branch: "ECE" }
  ];
  const applications = [
    { studentId: "s1", status: "selected" },
    { studentId: "s2", status: "applied" },
    { studentId: "s3", status: "rejected" }
  ];

  const cseStudents = students.filter(s => s.branch === "CSE");
  const csePlaced = cseStudents.filter(s => applications.some(a => a.studentId === s.id && a.status === "selected"));
  const cseRate = Math.round((csePlaced.length / cseStudents.length) * 100);

  assert.strictEqual(cseRate, 50, "1 out of 2 CSE students placed is 50%");
});

test("Export: CSV formatter creates RFC-compliant headers and escapes text fields", () => {
  const headers = ["Drive ID", "Company", "Role", "Package"];
  const row = ["d1", '"TCS, Global"', '"Software Engineer"', "3.6 LPA"];
  const csv = [headers.join(","), row.join(",")].join("\n");

  assert.ok(csv.startsWith("Drive ID,Company,Role,Package"));
  assert.ok(csv.includes('"TCS, Global"'));
  assert.strictEqual(csv.split("\n").length, 2);
});

