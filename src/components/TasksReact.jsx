import TasksReactBase from './TasksReactBase.jsx'
import TaskDeadlinesBoard from './TaskDeadlinesBoard.jsx'
import { useTodoistTasks } from '../hooks/useTodoistTasks.js'

export default function TasksReact(props) {
  useTodoistTasks({
    enabled: Boolean(props.session),
    tasks: props.office?.tasks || [],
    update: props.update,
  })

  return <>
    <TaskDeadlinesBoard
      office={props.office}
      update={props.update}
      onNavigate={props.onNavigate}
      onOpenTask={props.onOpenTask}
    />
    <TasksReactBase {...props} />
  </>
}
