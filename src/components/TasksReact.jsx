import { useState } from 'react'
import TasksReactBase from './TasksReactBase.jsx'
import TaskDeadlinesBoard from './TaskDeadlinesBoard.jsx'

export default function TasksReact(props) {
  const [deadlineTarget, setDeadlineTarget] = useState({ id: '', request: 0 })

  function openTaskFromDeadlines(id) {
    setDeadlineTarget(current => ({ id: String(id || ''), request: current.request + 1 }))
  }

  const baseProps = deadlineTarget.request
    ? {
        ...props,
        initialTaskId: deadlineTarget.id,
        openTaskRequest: Number(props.openTaskRequest || 0) + deadlineTarget.request,
      }
    : props

  return <>
    <TaskDeadlinesBoard
      office={props.office}
      update={props.update}
      onNavigate={props.onNavigate}
      onOpenTask={openTaskFromDeadlines}
    />
    <TasksReactBase {...baseProps} />
  </>
}
