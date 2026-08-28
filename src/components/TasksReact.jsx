import TasksReactBase from './TasksReactBase.jsx'
import { useTodoistTasks } from '../hooks/useTodoistTasks.js'

export default function TasksReact(props) {
  useTodoistTasks({
    enabled: Boolean(props.session),
    tasks: props.office?.tasks || [],
    update: props.update,
  })

  return <TasksReactBase {...props} />
}
