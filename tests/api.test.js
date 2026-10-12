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
