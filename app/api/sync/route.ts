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
    email: session?.user?.email ?? null,
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

    logQuery("users.upsert", { userId: user.id })
    const userUpsert = await admin.from("users").upsert({
      id: user.id,
      email: user.email,
      display_name: payload.profile.displayName ?? user.user_metadata?.display_name ?? null,
    })
    if (userUpsert.error) {
      console.error("/api/sync query users.upsert failed:", userUpsert.error)
      throw userUpsert.error
    }

    logQuery("tasks.select existing", { userId: user.id })
    const { data: existingTasks, error: existingTasksError } = await admin.from("tasks").select("id").eq("user_id", user.id)
    if (existingTasksError) {
      console.error("/api/sync query tasks.select existing failed:", existingTasksError)
      throw existingTasksError
    }

    logQuery("lists.select existing", { userId: user.id })
    const { data: existingLists, error: existingListsError } = await admin.from("lists").select("id").eq("user_id", user.id)
    if (existingListsError) {
      console.error("/api/sync query lists.select existing failed:", existingListsError)
      throw existingListsError
    }

    const existingTaskIds = (existingTasks ?? []).map((task) => task.id)
    const existingListIds = (existingLists ?? []).map((list) => list.id)
    const payloadTaskIds = new Set(payload.tasks.map((task) => task.id))
    const removedTaskIds = existingTaskIds.filter((taskId) => !payloadTaskIds.has(taskId))
    logStep("POST existing ids loaded", {
      existingTaskCount: existingTaskIds.length,
      existingListCount: existingListIds.length,
      removedTaskCount: removedTaskIds.length,
    })

    if (existingTaskIds.length > 0) {
      logQuery("task_labels.delete existing", { userId: user.id, taskCount: existingTaskIds.length })
      const result = await admin.from("task_labels").delete().in("task_id", existingTaskIds)
      if (result.error) {
        console.error("/api/sync query task_labels.delete existing failed:", result.error)
        throw result.error
      }
    }

    if (existingListIds.length > 0) {
      logQuery("list_items.delete existing", { userId: user.id, listCount: existingListIds.length })
      const result = await admin.from("list_items").delete().in("list_id", existingListIds)
      if (result.error) {
        console.error("/api/sync query list_items.delete existing failed:", result.error)
        throw result.error
      }
    }

    logQuery("bulk delete current rows", { userId: user.id })
    const [shoppingDelete, labelsDelete, listsDelete] = await Promise.all([
      admin.from("shopping_returns").delete().eq("user_id", user.id),
      admin.from("labels").delete().eq("user_id", user.id),
      admin.from("lists").delete().eq("user_id", user.id),
    ])

    if (shoppingDelete.error) {
      console.error("/api/sync query shopping_returns.delete failed:", shoppingDelete.error)
      throw shoppingDelete.error
    }
    if (labelsDelete.error) {
      console.error("/api/sync query labels.delete failed:", labelsDelete.error)
      throw labelsDelete.error
    }
    if (listsDelete.error) {
      console.error("/api/sync query lists.delete failed:", listsDelete.error)
      throw listsDelete.error
    }

    if (payload.labels.length > 0) {
      logQuery("labels.insert", { userId: user.id, count: payload.labels.length })
      const { error } = await admin.from("labels").upsert(
        payload.labels.map((label) => ({
          id: label.id,
          user_id: user.id,
          name: label.name,
          color: label.color,
          created_at: label.createdAt ?? new Date().toISOString(),
        })),
        { onConflict: "id" }
      )
      if (error) {
        console.error("/api/sync query labels.insert failed:", error)
        throw error
      }
    }

    if (payload.tasks.length > 0) {
      logQuery("tasks.insert", {
        userId: user.id,
        count: payload.tasks.length,
        preservesScheduledNotificationIds: true,
      })

      const { error } = await admin.from("tasks").upsert(
        payload.tasks.map((task) => ({
          id: task.id,
          user_id: user.id,
          title: task.title,
          date: task.date,
          time: task.time,
          priority: task.priority,
          completed: task.completed,
          completed_at: task.completedAt,
          notes: task.notes,
          location: task.location,
          duration: task.duration,
          url: task.url,
          photo_url: task.photoUrl,
          color: task.color,
          icon: task.icon,
          recurring: task.recurring,
          recurring_day: task.recurringDay,
          reminder: task.reminder,
          snoozed_until: task.snoozedUntil,
          parent_task_id: task.parentTaskId,
          order_index: task.orderIndex,
          when_added: task.whenAdded ?? new Date().toISOString(),
          created_at: task.createdAt ?? new Date().toISOString(),
          updated_at: task.updatedAt ?? new Date().toISOString(),
          end_of_day: task.endOfDay,
          is_heading: task.isHeading,
          recurring_days: task.recurringDays,
          recurring_interval: task.recurringInterval,
          recurring_custom_text: task.recurringCustomText,
          subtasks: task.subtasks,
        })),
        { onConflict: "id" }
      )
      if (error) {
        console.error("/api/sync query tasks.insert failed:", error)
        throw error
      }
    }

    if (removedTaskIds.length > 0) {
      logQuery("scheduled_notifications.detach removed tasks", { userId: user.id, count: removedTaskIds.length })
      const detachResult = await admin
        .from("scheduled_notifications")
        .update({ task_id: null })
        .eq("user_id", user.id)
        .in("task_id", removedTaskIds)

      if (detachResult.error) {
        console.error("/api/sync query scheduled_notifications.detach removed tasks failed:", detachResult.error)
        throw detachResult.error
      }

      logQuery("tasks.delete removed", { userId: user.id, count: removedTaskIds.length })
      const deleteResult = await admin
        .from("tasks")
        .delete()
        .eq("user_id", user.id)
        .in("id", removedTaskIds)

      if (deleteResult.error) {
        console.error("/api/sync query tasks.delete removed failed:", deleteResult.error)
        throw deleteResult.error
      }
    }

    if (payload.taskLabels.length > 0) {
      logQuery("task_labels.insert", { userId: user.id, count: payload.taskLabels.length })
      const { error } = await admin.from("task_labels").upsert(
        payload.taskLabels.map((item) => ({
          task_id: item.taskId,
          label_id: item.labelId,
        })),
        { onConflict: "task_id,label_id" }
      )
      if (error) {
        console.error("/api/sync query task_labels.insert failed:", error)
        throw error
      }
    }

    if (payload.lists.length > 0) {
      logQuery("lists.insert", { userId: user.id, count: payload.lists.length })
      const { error } = await admin.from("lists").upsert(
        payload.lists.map((list) => ({
          id: list.id,
          user_id: user.id,
          name: list.name,
          tab: list.tab,
          type: list.type,
          order_index: list.orderIndex,
          created_at: list.createdAt ?? new Date().toISOString(),
          updated_at: list.updatedAt ?? new Date().toISOString(),
        })),
        { onConflict: "id" }
      )
      if (error) {
        console.error("/api/sync query lists.insert failed:", error)
        throw error
      }
    }

    if (payload.listItems.length > 0) {
      logQuery("list_items.insert", { userId: user.id, count: payload.listItems.length })
      const { error } = await admin.from("list_items").upsert(
        payload.listItems.map((item) => ({
          id: item.id,
          list_id: item.listId,
          content: item.content,
          completed: item.completed,
          order_index: item.orderIndex,
          created_at: item.createdAt ?? new Date().toISOString(),
          notes: item.notes,
          updated_at: item.updatedAt ?? new Date().toISOString(),
        })),
        { onConflict: "id" }
      )
      if (error) {
        console.error("/api/sync query list_items.insert failed:", error)
        throw error
      }
    }

    if (payload.shoppingReturns.length > 0) {
      logQuery("shopping_returns.insert", { userId: user.id, count: payload.shoppingReturns.length })
      const { error } = await admin.from("shopping_returns").upsert(
        payload.shoppingReturns.map((item) => ({
          id: item.id,
          user_id: user.id,
          item: item.item,
          store: item.store,
          deadline: item.deadline,
          notes: item.notes,
          returned: item.returned,
          created_at: item.createdAt ?? new Date().toISOString(),
          updated_at: item.updatedAt ?? new Date().toISOString(),
        })),
        { onConflict: "id" }
      )
      if (error) {
        console.error("/api/sync query shopping_returns.insert failed:", error)
        throw error
      }
    }

    const response = await fetchSnapshot(admin, user.id, user.email ?? null)
    logStep("POST route success", { userId: user.id, isEmpty: response.isEmpty })
    return NextResponse.json(response)
  } catch (error) {
    console.error("/api/sync POST error:", error)
    return mapErrorToResponse(error)
  }
}
