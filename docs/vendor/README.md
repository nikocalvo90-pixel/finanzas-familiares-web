# SheetJS Community Edition

Pinned unmodified standalone build: **0.20.3** (Apache-2.0).

- Source: https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js
- License: https://cdn.sheetjs.com/xlsx-0.20.3/package/LICENSE (copy in SHEETJS-LICENSE.txt)
- SHA-256: `cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41`
- Installation reference: https://docs.sheetjs.com/docs/getting-started/installation/standalone/
- Parser options: https://docs.sheetjs.com/docs/api/parse-options/

The complete build is needed for binary XLS and XLSX. It loads from this app's
origin only when an Excel file is selected, inside a short-lived worker. No CDN
requests, file uploads, formula evaluation or macro execution occur during parsing.
HTML/SpreadsheetML exported with an XLS extension is read as data, never inserted
into the page. Import confirmation and server validation remain unchanged.

Version 0.20.3 includes the fixes described in the upstream advisories:
https://cdn.sheetjs.com/advisories/CVE-2023-30533 and
https://cdn.sheetjs.com/advisories/CVE-2024-22363.

Run parser and import regression tests with `node --test tests/bank-import.test.cjs`.
Fixtures are synthetic and do not contain bank customer data.
