import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { evaluateTodoistAccess } from "./access.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" };

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
const publishableKey = publishableKeys.default || Deno.env.get("SUPABASE_ANON_KEY") || "";
const secretKey = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const todoistToken = Deno.env.get("TODOIST_API_TOKEN") ?? "";
const configuredWorkspaceId = Deno.env.get("TODOIST_WORKSPACE_ID") || "119182a3-b58f-4088-ae9e-27e4fa1b1022";
const projectId = "6hP4XC379R6c6fHx";
const officeTimezone = "America/Sao_Paulo";
const sectionIds: Record<string, string> = {
  fiscal: "6hP4c8p83V95cwPQ",
  contabil: "6hP4c8qGCw9XWpcQ",
  dp: "6hP4c8p9GrxxP9wQ",
  societario: "6hP4c8q38f5r8Mpx",
  administrativo: "6hP4c8q4hCXX862x",
};
const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

class TodoistAccessError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = "TodoistAccessError";
    this.status = status;
  }
}

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}
function normalize(value: unknown) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}
function isCompleted(task: any) {
  return normalize(task?.status).startsWith("conclu");
}
function sectionFor(task: any) {
  const department = normalize(task?.departamento);
  if (department.includes("fiscal")) return sectionIds.fiscal;
  if (department.includes("contab")) return sectionIds.contabil;
  if (department === "dp" || department.includes("pessoal")) return sectionIds.dp;
  if (department.includes("societ")) return sectionIds.societario;
  return sectionIds.administrativo;
}
function priorityFor(task: any) {
  const priority = normalize(task?.prioridade);
  if (priority.includes("urgent")) return 1;
  if (priority.includes("alta")) return 2;
  if (priority.includes("baixa")) return 4;
  return 3;
}
function localToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: officeTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function officeFingerprint(task: any) {
  return JSON.stringify({
    titulo: String(task?.titulo || ""),
    descricao: String(task?.descricao || ""),
    prazo: String(task?.prazo || ""),
    prioridade: String(task?.prioridade || ""),
    departamento: String(task?.departamento || ""),
    status: String(task?.status || ""),
  });
}
function officePayload(task: any) {
  const prazo = task?.prazo ? String(task.prazo).slice(0, 10) : "";
  return {
    content: String(task?.titulo || "Tarefa sem título"),
    description: String(task?.descricao || ""),
    priority: priorityFor(task),
    ...(prazo ? { due_date: prazo } : { due_string: "today" }),
  };
}
function todoistDueNeedsRefresh(task: any, todoistTask: any) {
  if (task?.prazo) return false;
  const todoistDate = String(todoistTask?.due?.date || "").slice(0, 10);
  return todoistDate !== localToday();
}

async function authenticatedUser(req: Request) {
  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const client = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error) return null;
  return data.user;
}

async function activeWorkspaceId(userId: string, requestedWorkspaceId = "") {
  const requested = String(requestedWorkspaceId || "").trim();
  if (requested) return requested;
  const { data, error } = await admin
    .from("office_user_workspace_preferences")
    .select("active_workspace_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return String(data?.active_workspace_id || "");
}

async function authorizeWorkspace(userId: string, requestedWorkspaceId = "") {
  const workspaceId = await activeWorkspaceId(userId, requestedWorkspaceId);
  const [membershipResult, workspaceResult] = await Promise.all([
    admin
      .from("office_members")
      .select("user_id,workspace_id,role,status")
      .eq("user_id", userId)
      .eq("workspace_id", workspaceId || "__missing__")
      .maybeSingle(),
    admin
      .from("office_workspaces")
      .select("id,owner_user_id")
      .eq("id", workspaceId || "__missing__")
      .maybeSingle(),
  ]);
  if (membershipResult.error) throw membershipResult.error;
  if (workspaceResult.error) throw workspaceResult.error;

  const access = evaluateTodoistAccess({
    userId,
    requestedWorkspaceId: workspaceId,
    configuredWorkspaceId,
    membership: membershipResult.data,
    workspace: workspaceResult.data,
  });
  if (!access.ok) throw new TodoistAccessError(access.message, access.status);
  return workspaceId;
}

async function loadWorkspaceTasks(workspaceId: string) {
  const { data, error } = await admin
    .from("office_workspace_snapshots")
    .select("payload")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Snapshot do escritório não encontrado.");
  const tasks = data.payload?.med_tarefas;
  return Array.isArray(tasks) ? structuredClone(tasks) : [];
}

async function todoistRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.todoist.com/api/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${todoistToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let data: any = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!response.ok) {
    const message = data?.error || data?.message || data?.detail || `Todoist respondeu ${response.status}.`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return data;
}
async function listActiveTasks() {
  const tasks: any[] = [];
  let cursor = "";
  do {
    const query = new URLSearchParams({ project_id: projectId, limit: "200" });
    if (cursor) query.set("cursor", cursor);
    const data = await todoistRequest(`/tasks?${query}`);
    tasks.push(...(data?.results || []));
    cursor = data?.next_cursor || "";
  } while (cursor);
  return tasks;
}
async function listRecentCompletedTasks() {
  const tasks: any[] = [];
  let cursor = "";
  const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const since = new Date(Date.now() - 89 * 24 * 60 * 60 * 1000).toISOString();
  do {
    const query = new URLSearchParams({ project_id: projectId, since, until, limit: "200" });
    if (cursor) query.set("cursor", cursor);
    const data = await todoistRequest(`/tasks/completed/by_completion_date?${query}`);
    tasks.push(...(data?.items || []));
    cursor = data?.next_cursor || "";
  } while (cursor);
  return tasks;
}
async function saveMapping(userId: string, officeTask: any, todoistTask: any, todoistTimestamp?: string | null) {
  const { error } = await admin.from("todoist_task_mappings").upsert({
    user_id: userId,
    office_task_id: String(officeTask.id),
    todoist_task_id: String(todoistTask.id),
    office_updated_at: officeTask.updatedAt || new Date().toISOString(),
    todoist_updated_at: todoistTimestamp || todoistTask.updated_at || todoistTask.completed_at || new Date().toISOString(),
    office_fingerprint: officeFingerprint(officeTask),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,office_task_id" });
  if (error) throw error;
}
async function createTodoistTask(userId: string, officeTask: any) {
  const created = await todoistRequest("/tasks", {
    method: "POST",
    body: JSON.stringify({ ...officePayload(officeTask), project_id: projectId, section_id: sectionFor(officeTask) }),
  });
  if (isCompleted(officeTask)) {
    await todoistRequest(`/tasks/${encodeURIComponent(created.id)}/close`, { method: "POST", body: "{}" });
    await saveMapping(userId, officeTask, created, new Date().toISOString());
  } else {
    await saveMapping(userId, officeTask, created);
  }
  return created;
}
async function pushOfficeChanges(userId: string, officeTask: any, todoistTask: any) {
  let current = todoistTask;
  const wantedSection = sectionFor(officeTask);
  if (String(current.section_id || "") !== wantedSection) {
    current = await todoistRequest(`/tasks/${encodeURIComponent(current.id)}/move`, {
      method: "POST",
      body: JSON.stringify({ project_id: projectId, section_id: wantedSection }),
    });
  }
  current = await todoistRequest(`/tasks/${encodeURIComponent(current.id)}`, {
    method: "POST",
    body: JSON.stringify(officePayload(officeTask)),
  });
  await saveMapping(userId, officeTask, current);
  return current;
}

async function synchronize(userId: string, workspaceId: string) {
  if (!todoistToken) throw new Error("TODOIST_API_TOKEN ainda não está configurado no Supabase.");
  const tasks = await loadWorkspaceTasks(workspaceId);
  const [activeTasks, completedTasks, mappingResult] = await Promise.all([
    listActiveTasks(),
    listRecentCompletedTasks(),
    admin.from("todoist_task_mappings").select("*").eq("user_id", userId),
  ]);
  if (mappingResult.error) throw mappingResult.error;

  const activeById = new Map(activeTasks.map((task: any) => [String(task.id), task]));
  const completedById = new Map(completedTasks.map((task: any) => [String(task.id), task]));
  const mappingByOffice = new Map((mappingResult.data || []).map((mapping: any) => [String(mapping.office_task_id), mapping]));
  let changed = 0;
  let created = 0;
  let pushed = 0;
  let completedFromTodoist = 0;
  let reopened = 0;

  for (let index = 0; index < tasks.length; index++) {
    let officeTask = tasks[index];
    if (!officeTask?.id) continue;
    const officeId = String(officeTask.id);
    const mapping: any = mappingByOffice.get(officeId);

    if (!mapping) {
      if (isCompleted(officeTask)) continue;
      const newTodoistTask = await createTodoistTask(userId, officeTask);
      activeById.set(String(newTodoistTask.id), newTodoistTask);
      created++;
      changed++;
      continue;
    }

    const todoistId = String(mapping.todoist_task_id);
    let activeTask: any = activeById.get(todoistId);
    const completedTask: any = completedById.get(todoistId);
    const officeChanged = officeFingerprint(officeTask) !== String(mapping.office_fingerprint || "");

    if (activeTask) {
      if (isCompleted(officeTask)) {
        await todoistRequest(`/tasks/${encodeURIComponent(todoistId)}/close`, { method: "POST", body: "{}" });
        await saveMapping(userId, officeTask, activeTask, new Date().toISOString());
        activeById.delete(todoistId);
        pushed++;
        changed++;
        continue;
      }
      const refreshToday = todoistDueNeedsRefresh(officeTask, activeTask);
      if (officeChanged || refreshToday) {
        activeTask = await pushOfficeChanges(userId, officeTask, activeTask);
        activeById.set(todoistId, activeTask);
        pushed++;
        changed++;
      }
      continue;
    }

    if (completedTask) {
      const completedAt = completedTask.completed_at || completedTask.updated_at || new Date().toISOString();
      const officeUpdatedAt = new Date(officeTask.updatedAt || 0).getTime();
      const completedAtMs = new Date(completedAt).getTime();
      const baselineTodoistMs = new Date(mapping.todoist_updated_at || 0).getTime();
      const todoistCompletionIsNew = completedAtMs > baselineTodoistMs + 999;

      if (isCompleted(officeTask)) {
        await saveMapping(userId, officeTask, completedTask, completedAt);
        continue;
      }
      if (officeChanged && officeUpdatedAt >= completedAtMs) {
        await todoistRequest(`/tasks/${encodeURIComponent(todoistId)}/reopen`, { method: "POST", body: "{}" });
        const reopenedTask = await todoistRequest(`/tasks/${encodeURIComponent(todoistId)}`);
        await pushOfficeChanges(userId, officeTask, reopenedTask);
        reopened++;
        changed++;
        continue;
      }
      if (todoistCompletionIsNew) {
        officeTask = { ...officeTask, status: "Concluída", updatedAt: completedAt };
        tasks[index] = officeTask;
        await saveMapping(userId, officeTask, completedTask, completedAt);
        completedFromTodoist++;
        changed++;
      }
      continue;
    }

    if (!isCompleted(officeTask)) {
      await admin.from("todoist_task_mappings").delete().eq("user_id", userId).eq("office_task_id", officeId);
      const recreated = await createTodoistTask(userId, officeTask);
      activeById.set(String(recreated.id), recreated);
      created++;
      changed++;
    }
  }

  return {
    tasks,
    changed,
    created,
    pushed,
    completedFromTodoist,
    reopened,
    syncedAt: new Date().toISOString(),
    projectId,
    workspaceId,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ message: "Método não permitido." }, 405);
  try {
    const user = await authenticatedUser(req);
    if (!user) return reply({ message: "Sessão inválida. Entre novamente." }, 401);
    const input = await req.json().catch(() => ({}));
    const action = input.action || "status";
    const workspaceId = await authorizeWorkspace(user.id, input.workspaceId);
    const configured = Boolean(todoistToken);

    if (action === "status") {
      if (!configured) return reply({ configured: false, connected: false, projectId, workspaceId, allowed: true });
      await todoistRequest(`/tasks?${new URLSearchParams({ project_id: projectId, limit: "1" })}`);
      return reply({ configured: true, connected: true, projectId, workspaceId, allowed: true });
    }
    if (!configured) return reply({ message: "TODOIST_API_TOKEN ainda não está configurado no Supabase." }, 503);
    if (action === "sync") return reply(await synchronize(user.id, workspaceId));
    return reply({ message: "Ação desconhecida." }, 400);
  } catch (error) {
    if (error instanceof TodoistAccessError) {
      return reply({ message: error.message, allowed: false }, error.status);
    }
    console.error("[todoist-sync]", error);
    return reply({ message: error instanceof Error ? error.message : "Falha inesperada na integração com o Todoist." }, 500);
  }
});
