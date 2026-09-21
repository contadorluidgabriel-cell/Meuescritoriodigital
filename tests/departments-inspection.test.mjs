import { readFileSync } from 'node:fs'
import test from 'node:test'

test('temporary department implementation diagnostics', () => {
  const html = readFileSync('legacy-v10-7.html','utf8')
  for (const term of ['function getDepartments()', 'function activeDepartments()', 'function renderDepartments()', 'data-department-index', 'function refreshDepartment', 'function renderDepartment', 'function getDepartment', 'const departments=', 'departments:Store.get', 'active:false', 'active:true', 'departmentList.addEventListener']) {
    let start = 0; let found = 0
    while (found < 3) {
      const i = html.indexOf(term,start)
      if (i < 0) break
      console.log('DEPTMATCH '+term+' index='+i+' '+html.slice(Math.max(0,i-250), Math.min(html.length,i+1900)).replace(/\s+/g,' '))
      start=i+term.length;found++
    }
  }
  const task=readFileSync('src/components/TasksReactBase.jsx','utf8')
  for (const term of ['departmentChoices =', 'office.departments', 'active !== false']) {
    const i=task.indexOf(term)
    if (i>=0) console.log('TASKMATCH '+term+' '+task.slice(Math.max(0,i-100),i+400).replace(/\s+/g,' '))
  }
})
