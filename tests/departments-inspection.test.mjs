import { readFileSync } from 'node:fs'
import test from 'node:test'

function inspect(file, terms, max = 12) {
  const source = readFileSync(file, 'utf8')
  console.log(`\nINSPECT ${file} length=${source.length}`)
  for (const term of terms) {
    let offset = 0; let count = 0
    while (count < max) {
      const index = source.indexOf(term, offset)
      if (index < 0) break
      console.log(`MATCH ${JSON.stringify(term)} ${index}: ${source.slice(Math.max(0,index-400), Math.min(source.length,index+700)).replace(/\s+/g,' ')}`)
      offset = index + term.length; count += 1
    }
  }
}
test('temporary department source diagnostics', () => {
  inspect('legacy-v10-7.html', ['department-row', 'department-list', 'departmentToggle', 'departments.map', 'departments.filter', 'Departamento', 'departamentos'], 5)
  inspect('src/components/TasksReactBase.jsx', ['departments.filter', 'departments.map', 'departamento', 'active'], 4)
})
