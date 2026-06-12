import { NextResponse } from "next/server"
import { randomUUID } from "crypto"

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server"
import type { CloudSnapshot } from "@/lib/cloud-sync"

export const dynamic = "force-dynamic"

type SupabaseClient = ReturnType<typeof createSupabaseAdminClient>

type SupabaseSnapshotResponse = {
  snapshot: CloudSnapshot
  isEmpty: boolean
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const isUuid = (value: string) => UUID_PATTERN.test(value)

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return error.message
  }

  return "Unknown error"
}

function logStep(step: string, details?: Record<string, unknown>) {
  if (details) {
    console.log(`/api/sync ${step}:`, details)
    return
  }

  console.log(`/api/sync ${step}`)
}

function logQuery(name: string, details?: Record<string, unknown>) {
  logStep(`query ${name}`, details)
}

function normalizeSyncPayloadIds(payload: Omit<CloudSnapshot, "latestUpdatedAt">) {
  const labelIdMap = new Map<string, string>()
  const listIdMap = new Map<string, string>()
  const listItemIdMap = new Map<string, string>()
  const shoppingReturnIdMap = new Map<string, string>()

  const rewriteId = (value: string, map: Map<string, string>) => {
    if (isUuid(value)) {
      return value
    }

    const existing = map.get(value)
    if (existing) {
      return existing
    }

    const next = randomUUID()
    map.set(value, next)
    return next
  }

  payload.labels = payload.labels.map((label) => ({
    ...label,
    id: rewriteId(label.id, labelIdMap),
  }))

  payload.lists = payload.lists.map((list) => ({
    ...list,
    id: rewriteId(list.id, listIdMap),
  }))

  payload.listItems = payload.listItems
    .map((item) => {
      const normalizedListId = listIdMap.get(item.listId) ?? (isUuid(item.listId) ? item.listId : null)
      if (!normalizedListId) {
        return null
      }

      return {
        ...item,
        id: rewriteId(item.id, listItemIdMap),
        listId: normalizedListId,
      }
    })
    .filter((item): item is typeof payload.listItems[number] => item !== null)

  payload.shoppingReturns = payload.shoppingReturns.map((item) => ({
    ...item,
    id: rewriteId(item.id, shoppingReturnIdMap),
  }))

  const normalizedLabelIds = new Set(payload.labels.map((label) => label.id))
  const normalizedListIds = new Set(payload.lists.map((list) => list.id))

  payload.taskLabels = payload.taskLabels
    .map((item) => {
      const normalizedTaskId = isUuid(item.taskId) ? item.taskId : null
      const normalizedLabelId = labelIdMap.get(item.labelId) ?? (isUuid(item.labelId) ? item.labelId : null)

      if (!normalizedTaskId || !normalizedLabelId) {
        return null
      }

      if (!normalizedLabelIds.has(normalizedLabelId)) {
        return null
      }

      return {
        taskId: normalizedTaskId,
        labelId: normalizedLabelId,
      }
    })
    .filter((item): item is typeof payload.taskLabels[number] => item !== null)

  payload.listItems = payload.listItems.filter((item) => normalizedListIds.has(item.listId))

  return {
    labelIdsRewritten: labelIdMap.size,
    listIdsRewritten: listIdMap.size,
    listItemIdsRewritten: listItemIdMap.size,
    shoppingReturnIdsRewritten: shoppingReturnIdMap.size,
  }
}

function mapErrorToResponse(error: unknown) {
  const message = getErrorMessage(error)

  if (message.includes("Missing Supabase env")) {
    console.error("/api/sync env/config error:", error)
    return NextResponse.json({ error: message }, { status: 503 })
  }

  if (message.includes("legacy JWT format")) {
    console.error("/api/sync service role format error:", error)
    return NextResponse.json({ error: message }, { status: 503 })
  }

  console.error("/api/sync unhandled error:", error)
  return NextResponse.json({ error: message }, { status: 500 })
}

function getLatestTimestamp(snapshot: CloudSnapshot) {
  const timestamps = [
    ...snapshot.tasks.map((task) => task.updatedAt),
    ...snapshot.labels.map((label) => label.createdAt),
    ...snapshot.lists.map((list) => list.updatedAt),
    ...snapshot.listItems.map((item) => item.updatedAt),
    ...snapshot.shoppingReturns.map((item) => item.updatedAt),
  ].filter((value): value is string => Boolean(value))

  if (timestamps.length === 0) {
    return null
  }

  return timestamps.sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null
}

async function requireUser() {
  logStep("auth check starting")
  const supabase = await createSupabaseServerClient()
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) {
    console.error("/api/sync auth check error:", error)
    throw error
  }

  logStep("auth check result", {
    authenticated: Boolean(session?.user),
    userId: session?.user?.id ?? null,
  })

  return { user: session?.user ?? null }
}

async function fetchSnapshot(
  supabase: SupabaseClient,
  userId: string,
  email: string | null
): Promise<SupabaseSnapshotResponse> {
  logStep("fetchSnapshot starting", { userId })

  logQuery("users.select", { userId })
  const userResultPromise = supabase.from("users").select("id, email, display_name, created_at, updated_at").eq("id", userId).maybeSingle()

  logQuery("tasks.select", { userId })
  const tasksResultPromise = supabase.from("tasks").select("*").eq("user_id", userId).order("order_index", { ascending: true })

  logQuery("labels.select", { userId })
  const labelsResultPromise = supabase.from("labels").select("*").eq("user_id", userId).order("created_at", { ascending: true })

  logQuery("task_labels.select", { userId })
  const taskLabelsResultPromise = supabase
    .from("task_labels")
    .select("task_id, label_id, tasks!inner(user_id)")
    .eq("tasks.user_id", userId)

  logQuery("lists.select", { userId })
  const listsResultPromise = supabase.from("lists").select("*").eq("user_id", userId).order("order_index", { ascending: true })

  logQuery("list_items.select", { userId })
  const listItemsResultPromise = supabase
    .from("list_items")
    .select("id, list_id, content, completed, order_index, created_at, notes, updated_at, lists!inner(user_id)")
    .eq("lists.user_id", userId)
    .order("order_index", { ascending: true })

  logQuery("shopping_returns.select", { userId })
  const shoppingReturnsResultPromise = supabase
    .from("shopping_returns")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })

  const [userResult, tasksResult, labelsResult, taskLabelsResult, listsResult, listItemsResult, shoppingReturnsResult] =
    await Promise.all([
      userResultPromise,
      tasksResultPromise,
      labelsResultPromise,
      taskLabelsResultPromise,
      listsResultPromise,
      listItemsResultPromise,
      shoppingReturnsResultPromise,
    ])

  if (userResult.error) {
    console.error("/api/sync query users.select failed:", userResult.error)
    throw userResult.error
  }
  if (tasksResult.error) {
    console.error("/api/sync query tasks.select failed:", tasksResult.error)
    throw tasksResult.error
  }
  if (labelsResult.error) {
    console.error("/api/sync query labels.select failed:", labelsResult.error)
    throw labelsResult.error
  }
  if (taskLabelsResult.error) {
    console.error("/api/sync query task_labels.select failed:", taskLabelsResult.error)
    throw taskLabelsResult.error
  }
  if (listsResult.error) {
    console.error("/api/sync query lists.select failed:", listsResult.error)
    throw listsResult.error
  }
  if (listItemsResult.error) {
    console.error("/api/sync query list_items.select failed:", listItemsResult.error)
    throw listItemsResult.error
  }
  if (shoppingReturnsResult.error) {
    console.error("/api/sync query shopping_returns.select failed:", shoppingReturnsResult.error)
    throw shoppingReturnsResult.error
  }

  const snapshot: CloudSnapshot = {
    profile: {
      email: userResult.data?.email ?? email,
      displayName: userResult.data?.display_name ?? null,
    },
    tasks: (tasksResult.data ?? []).map((task) => ({
      id: task.id,
      title: task.title,
      date: task.date,
      time: task.time,
      priority: task.priority,
      completed: task.completed,
      completedAt: task.completed_at,
      notes: task.notes,
      location: task.location,
      phone: task.phone,
      duration: task.duration,
      url: task.url,
      photoUrl: task.photo_url,
      color: task.color,
      icon: task.icon,
      recurring: task.recurring,
      recurringDay: task.recurring_day,
      reminder: task.reminder,
      scheduledNotificationId: task.scheduled_notification_id ?? null,
      snoozedUntil: task.snoozed_until,
      parentTaskId: task.parent_task_id,
      orderIndex: task.order_index,
      whenAdded: task.when_added,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      endOfDay: task.end_of_day ?? false,
      isHeading: task.is_heading ?? false,
      recurringDays: task.recurring_days ?? null,
      recurringInterval: task.recurring_interval ?? null,
      recurringCustomText: task.recurring_custom_text ?? null,
      subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
    })),
    labels: (labelsResult.data ?? []).map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color,
      createdAt: label.created_at,
    })),
    taskLabels: (taskLabelsResult.data ?? []).map((item) => ({
      taskId: item.task_id,
      labelId: item.label_id,
    })),
    lists: (listsResult.data ?? []).map((list) => ({
      id: list.id,
      name: list.name,
      tab: list.tab,
      type: list.type ?? "list",
      orderIndex: list.order_index,
      createdAt: list.created_at,
      updatedAt: list.updated_at,
    })),
    listItems: (listItemsResult.data ?? []).map((item) => ({
      id: item.id,
      listId: item.list_id,
      content: item.content,
      completed: item.completed,
      orderIndex: item.order_index,
      createdAt: item.created_at,
      notes: item.notes,
      updatedAt: item.updated_at,
    })),
    shoppingReturns: (shoppingReturnsResult.data ?? []).map((item) => ({
      id: item.id,
      item: item.item,
      store: item.store,
      deadline: item.deadline,
      notes: item.notes,
      returned: item.returned,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    })),
    latestUpdatedAt: null,
  }

  snapshot.latestUpdatedAt = getLatestTimestamp(snapshot)

  const isEmpty =
    snapshot.tasks.length === 0 &&
    snapshot.labels.length === 0 &&
    snapshot.lists.length === 0 &&
    snapshot.shoppingReturns.length === 0

  logStep("fetchSnapshot complete", {
    taskCount: snapshot.tasks.length,
    labelCount: snapshot.labels.length,
    listCount: snapshot.lists.length,
    shoppingReturnCount: snapshot.shoppingReturns.length,
    isEmpty,
  })

  return { snapshot, isEmpty }
}

export async function GET() {
  logStep("GET route start")

  try {
    const { user } = await requireUser()
    if (!user) {
      logStep("GET unauthorized")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const admin = createSupabaseAdminClient()
    logStep("GET admin client ready", { userId: user.id })
    const response = await fetchSnapshot(admin, user.id, user.email ?? null)
    logStep("GET route success", { userId: user.id, isEmpty: response.isEmpty })
    return NextResponse.json(response)
  } catch (error) {
    console.error("/api/sync GET error:", error)
    return mapErrorToResponse(error)
  }
}

export async function POST(request: Request) {
  logStep("POST route start")

  try {
    const { user } = await requireUser()
    if (!user) {
      logStep("POST unauthorized")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const admin = createSupabaseAdminClient()
    logStep("POST admin client ready", { userId: user.id })

    const payload = (await request.json()) as Omit<CloudSnapshot, "latestUpdatedAt">

    // Hard cap: reject absurdly large payloads before touching the DB.
    const LIMITS = { tasks: 5000, labels: 500, lists: 500, listItems: 10000, shoppingReturns: 1000 }
    if (
      (payload.tasks?.length ?? 0) > LIMITS.tasks ||
      (payload.labels?.length ?? 0) > LIMITS.labels ||
      (payload.lists?.length ?? 0) > LIMITS.lists ||
      (payload.listItems?.length ?? 0) > LIMITS.listItems ||
      (payload.shoppingReturns?.length ?? 0) > LIMITS.shoppingReturns
    ) {
      logStep("POST payload exceeds limits", {
        tasks: payload.tasks?.length,
        labels: payload.labels?.length,
        lists: payload.lists?.length,
        listItems: payload.listItems?.length,
        shoppingReturns: payload.shoppingReturns?.length,
      })
      return NextResponse.json({ error: "Payload too large" }, { status: 413 })
    }

    logStep("POST payload parsed", {
      userId: user.id,
      taskCount: payload.tasks.length,
      labelCount: payload.labels.length,
      taskLabelCount: payload.taskLabels.length,
      listCount: payload.lists.length,
      listItemCount: payload.listItems.length,
      shoppingReturnCount: payload.shoppingReturns.length,
    })

    const skippedTaskIds: string[] = []
    payload.tasks = payload.tasks.filter((task) => {
      if (isUuid(task.id)) {
        return true
      }

      console.warn(`Skipping non-UUID task: ${task.id}`)
      skippedTaskIds.push(task.id)
      return false
    })

    if (skippedTaskIds.length > 0) {
      const validTaskIds = new Set(payload.tasks.map((task) => task.id))
      payload.taskLabels = payload.taskLabels.filter((item) => validTaskIds.has(item.taskId))
    }

    if (payload.tasks.length === 0 && skippedTaskIds.length > 0) {
      logStep("POST all tasks skipped", { skipped: skippedTaskIds.length })
      return NextResponse.json({ synced: 0, skipped: skippedTaskIds.length })
    }

    const normalizedIdStats = normalizeSyncPayloadIds(payload)
    logStep("POST payload ids normalized", {
      userId: user.id,
      ...normalizedIdStats,
      skippedTaskCount: skippedTaskIds.length,
      taskCount: payload.tasks.length,
      labelCount: payload.labels.length,
      listCount: payload.lists.length,
      listItemCount: payload.listItems.length,
      shoppingReturnCount: payload.shoppingReturns.length,
      taskLabelCount: payload.taskLabels.length,
    })

    // Notification scheduling is an async side-effect that can race snapshot sync.
    // Let /api/notifications/schedule own scheduled_notification_id after task rows exist.
    payload.tasks = payload.tasks.map((task) => ({ ...task, scheduledNotificationId: null }))

    logQuery("sync_user_snapshot.rpc", {
      userId: user.id,
      taskCount: payload.tasks.length,
      labelCount: payload.labels.length,
      taskLabelCount: payload.taskLabels.length,
      listCount: payload.lists.length,
      listItemCount: payload.listItems.length,
      shoppingReturnCount: payload.shoppingReturns.length,
    })
    const syncResult = await admin.rpc("sync_user_snapshot", {
      p_user_id: user.id,
      p_email: user.email ?? payload.profile.email ?? null,
      p_display_name: payload.profile.displayName ?? user.user_metadata?.display_name ?? null,
      p_tasks: payload.tasks,
      p_labels: payload.labels,
      p_task_labels: payload.taskLabels,
      p_lists: payload.lists,
      p_list_items: payload.listItems,
      p_shopping_returns: payload.shoppingReturns,
    })

    if (syncResult.error) {
      console.error("/api/sync query sync_user_snapshot.rpc failed:", syncResult.error)
      throw syncResult.error
    }

    const response = await fetchSnapshot(admin, user.id, user.email ?? null)
    logStep("POST route success", { userId: user.id, isEmpty: response.isEmpty })
    return NextResponse.json(response)
  } catch (error) {
    console.error("/api/sync POST error:", error)
    return mapErrorToResponse(error)
  }
}
