import { readFileSync, writeFileSync } from 'node:fs'

const marker = '/* shared-v2 */'

export function applySharingStylesPatch(root) {
  const path = `${root}src/styles.css`
  const source = readFileSync(path, 'utf8')
  if (source.includes(marker)) return
  const extra = `

${marker}
.shared-client-box,.shared-responsibility-box,.shared-finance-default-box,.shared-service-box,.shared-work-responsibility{border:1px solid #0000001f;border-radius:14px;padding:14px;background:#fff;box-sizing:border-box}
.shared-client-box>span,.shared-responsibility-box>span,.shared-finance-default-box>span,.shared-service-box>span,.shared-work-responsibility>span{font-weight:700;color:#000}
.shared-responsibility-list{display:grid;gap:8px;margin-top:10px}
.shared-responsibility-row{display:grid;grid-template-columns:minmax(120px,1fr) minmax(150px,1fr) minmax(150px,1fr);gap:8px;align-items:center}
.shared-responsibility-row select,.shared-finance-default-grid select,.shared-finance-default-grid input,.shared-work-responsibility select{width:100%}
.shared-responsibility-office{font-size:12px;color:#00000099}
.shared-finance-default-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px}
.shared-finance-default-grid label{display:grid;gap:5px;font-size:12px}
.shared-finance-default-grid label>span{font-weight:600}
.shared-finance-check{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;padding:9px 10px;border-radius:10px;background:#2456E80d;border:1px solid #2456E833;font-size:12px}
.shared-finance-check.invalid{border-width:2px;border-color:#2456E8}
.shared-work-responsibility{grid-column:1/-1;display:grid;gap:8px;margin:2px 0 6px}
.shared-work-responsibility>div{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.partner-card{position:relative}
.partner-inactive{opacity:.72}
.partner-card .outsourced-company-field span{display:block;font-size:11px;color:#00000099;margin-top:2px}
.partner-balance-section{margin-bottom:14px}
.partner-balance-head h2{margin:0;color:#000}.partner-balance-head p{margin:3px 0 12px;color:#00000099}
.partner-balance-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}
.partner-balance-grid article{display:grid;gap:4px;padding:12px;border:1px solid #0000001f;border-radius:12px;background:#fff}
.partner-balance-grid article b{color:#000}.partner-balance-grid article span{font-size:12px;color:#000000aa}.partner-balance-grid article strong{color:#2456E8}
.finance-row-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px}.finance-row-actions button{white-space:nowrap}
.finance-row>div:nth-child(2){display:grid;gap:3px}.finance-row>div:nth-child(2) small{font-size:11px;color:#00000099;line-height:1.35}
.shared-service-box{display:grid;gap:10px}.shared-service-box .choice-list{margin-top:0}
.shared-finance-modal{max-width:760px}
@media(max-width:760px){.shared-responsibility-row,.shared-finance-default-grid,.shared-work-responsibility>div{grid-template-columns:1fr}.finance-row-actions{justify-content:flex-start;flex-wrap:wrap}}
`
  writeFileSync(path, source + extra)
}
