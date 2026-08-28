# V11.1 Migration Integrity Record

Validation date: 2026-08-27 (America/Sao_Paulo)

This branch is a migration workspace. `main` and the production deployment were not changed by this migration.

## Source backups

- Original V11.1 ZIP SHA-256: `b04d2fc5e40956c6a4db931ebdb2c8003c6b1bf45c175191c5ab55847081601f`
- Google Drive backup file ID: `1GtsK41wTm1GhlO_U9i1ePf_nA_9bhg51`
- Original legacy V10.7 SHA-256: `454c07fbc6283faca3f55e10f51fd09a03dea14017a1cbdd67cb8f14b1612659`
- Original pnpm lockfile SHA-256: `98eacaed2e491adbe09f8bf887afe2a3e59c726b5f05130e97607dbd7ad04a35`

## Reconstructed files validated byte-for-byte

- `src/components/ProcessesReact.jsx`: `9a9508407b3ddeae914fc9a43d2743e11240bb5a405f92ae6c32d958997cb3de`
- `src/components/TasksReact.jsx`: `fd503e3cc4eb41230962d25bcd6584a3ea281ccfe0aa93d2827a63e1cb3af9e6`
- `src/calendar-react.css`: `bb5a2b496cfff89a0d87cb8e8acb02444f8c1ef0d5d652c69d14b75c94e6c830`
- `src/clients-react.css`: `eadfbd68dbeb5611d31a5a58d1906703a6b201a3d7ffb5eff9884a4760756eed`
- `src/dashboard-react.css`: `82bff7bc3e4b83ce7b50c79365193bcd0c58786e58f0fbe02652670717cfdaee`
- `src/finance-react.css`: `4fb3b5665784fbd47735c9ac53024accd85472f1050817d5695431212aeb4f05`
- `src/migration-shell.css`: `18298a6cee01a17fb928f5ad6ae51cc197a538a2426db609b69defaefad89825`
- `src/obligations-react.css`: `4f0c9e59cabf75459a9ad5a3cf4d0e962c4a62545f72adcf98705ca814c2bfc5`
- `src/processes-react.css`: `26c5fc8c64767d39f8edce54f005a91dc0a57c80357c5355292d870e6edef4a8`
- `src/styles.css`: `3c628559e8f8bfa8ceb647939c54a1b73a95d074185d08260aa1b91c9d69dca5`
- `src/tasks-react.css`: `c289febe8a9d88d62c3d0966bf4a536551edbbc6c7a0ed2b7f35c0c52b72ae17`
- `legacy-v10-7.html`: `454c07fbc6283faca3f55e10f51fd09a03dea14017a1cbdd67cb8f14b1612659`
- `pnpm-lock.yaml` payload: `98eacaed2e491adbe09f8bf887afe2a3e59c726b5f05130e97607dbd7ad04a35`

Local reconstruction test result: **all files matched the original source byte-for-byte**.

## Migration safeguards

- Large source files are stored as gzip/base64 payloads to avoid connector truncation.
- `vite.config.js` restores Processos, Tarefas, CSS files and the legacy HTML before the Vite build.
- Legacy chunks `02` and `08` had transmission differences in their first copies. Those copies remain only for history; the build uses verified `02a + 02b` and `08a + 08b` copies whose Git blob hashes match the local originals.
- The original lockfile is preserved as `source-payloads/pnpm-lock.yaml.gz.b64`.
- Vercel uses `scripts/restore-lockfile.mjs` before `pnpm install --frozen-lockfile`, restoring the exact validated lockfile before dependency installation.
- The visible title in `index.html` was intentionally corrected from V11.0 to V11.1; this is the only intentional version-label correction relative to the source ZIP.

## Promotion rule

Do not merge this branch into `main` or promote it to production until Preview validation is complete.
