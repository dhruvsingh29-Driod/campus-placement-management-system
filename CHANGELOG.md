# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2026-10-13
### Added
- Executive placement analytics endpoint (`/api/analytics`) calculating salary KPIs and department rates.
- RFC-compliant CSV export endpoints for recruitment drives and candidate applications.
- Embedded OpenAPI 3.0 specification and interactive Swagger UI at `/api-docs`.
- Recruitment workflow interview stage transition (`interview`).
- Expanded automated test suite with 9 passing tests covering calculations, exports, and stage validation.

## [1.1.0] - 2026-10-13
### Added
- Native automated unit and business logic test suite (`tests/api.test.js`).
- Production containerization via `Dockerfile` and `docker-compose.yml`.
- Standard MIT License and contribution guidelines.
- Live placement statistics counter endpoint (`/api/stats`).

## [1.0.0] - 2026-10-12
### Added
- Initial full-stack implementation of Campus Placement Management System.
- Express.js REST API with student registration and company login.
- Server-side eligibility enforcement for CGPA cutoffs and branch constraints.
- Modern glassmorphic user interface with student and recruiter dashboards.
