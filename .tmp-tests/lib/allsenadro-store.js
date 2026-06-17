"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAllsenadroStore = void 0;
const zustand_1 = require("zustand");
const middleware_1 = require("zustand/middleware");
const client_1 = require("@/lib/supabase/client");
const getTodayDate = () => new Date().toISOString().slice(0, 10);
const isLocalHabitId = (id) => id.startsWith("local-habit-");
const mergeLocalFallbackHabits = (existing, incoming) => {
    const localOnlyHabits = existing.filter((habit) => isLocalHabitId(habit.id));
    return [...incoming, ...localOnlyHabits].sort((left, right) => left.sort_order - right.sort_order);
};
exports.useAllsenadroStore = (0, zustand_1.create)()((0, middleware_1.persist)((set, get) => ({
    userId: null,
    profile: null,
    setUserId: (id) => set({ userId: id }),
    setProfile: (profile) => set({ profile }),
    uiPreferences: {
        theme: 'light',
        accentColor: '#6366f1',
        activePresetId: null,
    },
    setUIPreferences: (prefs) => set((state) => ({
        uiPreferences: {
            ...state.uiPreferences,
            ...prefs,
        },
        activePresetId: prefs.activePresetId ?? state.activePresetId,
    })),
    isLoading: false,
    setIsLoading: (loading) => set({ isLoading: loading }),
    collections: [],
    fetchCollections: async () => {
        const userId = get().userId;
        if (!userId)
            return;
        const supabase = (0, client_1.createSupabaseBrowserClient)();
        const { data, error } = await supabase
            .from("collections")
            .select("*")
            .eq("user_id", userId)
            .order("sort_order", { ascending: true });
        if (error) {
            console.error('fetchCollections:', error);
            return;
        }
        set({ collections: (data ?? []) });
    },
    addCollection: async (collection) => {
        const supabase = (0, client_1.createSupabaseBrowserClient)();
        const { error } = await supabase.from("collections").insert(collection);
        if (error) {
            console.error('addCollection:', error);
            return;
        }
        await get().fetchCollections();
    },
    updateCollection: async (id, updates) => {
        const supabase = (0, client_1.createSupabaseBrowserClient)();
        const { error } = await supabase.from("collections").update(updates).eq("id", id);
        if (error) {
            console.error('updateCollection:', error);
            return;
        }
        await get().fetchCollections();
    },
    deleteCollection: async (id) => {
        const supabase = (0, client_1.createSupabaseBrowserClient)();
        const { error } = await supabase.from("collections").delete().eq("id", id);
        if (error) {
            console.error('deleteCollection:', error);
            return;
        }
        await get().fetchCollections();
        await get().fetchPresets();
    },
    presets: [],
    activePresetId: null,
    fetchPresets: async () => {
        const userId = get().userId;
        if (!userId)
            return;
        const supabase = (0, client_1.createSupabaseBrowserClient)();
        const { data, error } = await supabase
            .from("presets")
            .select("*, preset_collections(sort_order, collections(*))")
            .eq("user_id", userId)
            .order("sort_order", { ascending: true });
        if (error) {
            console.error('fetchPresets:', error);
            return;
        }
        const presets = (data ?? []).map((preset) => ({
            id: preset.id,
            user_id: preset.user_id,
            name: preset.name,
            is_default: preset.is_default,
            sort_order: preset.sort_order,
            created_at: preset.created_at,
            collections: (preset.preset_collections ?? [])
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .flatMap((link) => (link.collections ? [link.collections] : [])),
        }));
        set({ presets });
    },
    addPreset: async (name, collectionIds) => {
        const userId = get().userId;
        if (!userId)
            return;
        const supabase = (0, client_1.createSupabaseBrowserClient)();
        const nextSortOrder = get().presets.length;
        const { data, error } = await supabase
            .from("presets")
            .insert({
            user_id: userId,
            name,
            is_default: false,
            sort_order: nextSortOrder,
        })
            .select()
            .single();
        if (error) {
            console.error('addPreset:', error);
            return;
        }
        if (collectionIds.length > 0) {
            const links = collectionIds.map((collectionId, index) => ({
                preset_id: data.id,
                collection_id: collectionId,
                sort_order: index,
            }));
            const { error: linksError } = await supabase.from("preset_collections").insert(links);
            if (linksError) {
                console.error('addPreset:', linksError);
                return;
            }
        }
        await get().fetchPresets();
    },
    deletePreset: async (id) => {
        const supabase = (0, client_1.createSupabaseBrowserClient)();
        const { error } = await supabase.from("presets").delete().eq("id", id);
        if (error) {
            console.error('deletePreset:', error);
            return;
        }
        if (get().activePresetId === id) {
            set((state) => ({
                activePresetId: null,
                uiPreferences: {
                    ...state.uiPreferences,
                    activePresetId: null,
                },
            }));
        }
        await get().fetchPresets();
    },
    setActivePreset: (id) => set((state) => ({
        activePresetId: id,
        uiPreferences: {
            ...state.uiPreferences,
            activePresetId: id,
        },
    })),
    habits: [],
    fetchHabits: async () => {
        const userId = get().userId;
        if (!userId)
            return;
        const today = getTodayDate();
        const supabase = (0, client_1.createSupabaseBrowserClient)();
        const { data, error } = await supabase
            .from("habits")
            .select("*, habit_logs(id, completed)")
            .eq("user_id", userId)
            .eq("habit_logs.date", today)
            .order("sort_order", { ascending: true });
        if (error) {
            console.error('fetchHabits:', error);
            return;
        }
        const habits = (data ?? []).map((habit) => {
            const log = habit.habit_logs?.[0] ?? null;
            return {
                id: habit.id,
                user_id: habit.user_id,
                name: habit.name,
                repeat_duration_days: habit.repeat_duration_days,
                start_date: habit.start_date,
                end_date: habit.end_date,
                color: habit.color,
                sort_order: habit.sort_order,
                is_active: habit.is_active,
                created_at: habit.created_at,
                updated_at: habit.updated_at,
                completed_today: log?.completed ?? false,
                log_id: log?.id ?? null,
            };
        });
        set((state) => ({ habits: mergeLocalFallbackHabits(state.habits, habits) }));
    },
    addHabit: async (habit) => {
        const addLocalHabit = () => {
            const localHabit = {
                id: `local-habit-${globalThis.crypto.randomUUID()}`,
                user_id: habit.user_id,
                name: habit.name,
                repeat_duration_days: habit.repeat_duration_days,
                start_date: habit.start_date,
                end_date: habit.end_date,
                color: habit.color,
                sort_order: habit.sort_order,
                is_active: habit.is_active,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                completed_today: false,
                log_id: null,
            };
            set((state) => ({
                habits: [...state.habits, localHabit].sort((left, right) => left.sort_order - right.sort_order),
            }));
        };
        try {
            const supabase = (0, client_1.createSupabaseBrowserClient)();
            const { error } = await supabase.from("habits").insert(habit);
            if (error) {
                addLocalHabit();
                return;
            }
            await get().fetchHabits();
        }
        catch {
            addLocalHabit();
        }
    },
    updateHabit: async (id, updates) => {
        const supabase = (0, client_1.createSupabaseBrowserClient)();
        const { error } = await supabase.from("habits").update(updates).eq("id", id);
        if (error) {
            console.error('updateHabit:', error);
            return;
        }
        await get().fetchHabits();
    },
    deleteHabit: async (id) => {
        const supabase = (0, client_1.createSupabaseBrowserClient)();
        const { error } = await supabase.from("habits").delete().eq("id", id);
        if (error) {
            console.error('deleteHabit:', error);
            return;
        }
        await get().fetchHabits();
    },
    toggleHabitToday: async (habitId) => {
        const userId = get().userId;
        if (!userId)
            return;
        const habit = get().habits.find((entry) => entry.id === habitId);
        if (!habit)
            return;
        if (isLocalHabitId(habitId)) {
            set((state) => ({
                habits: state.habits.map((entry) => entry.id === habitId
                    ? {
                        ...entry,
                        completed_today: !entry.completed_today,
                    }
                    : entry),
            }));
            return;
        }
        const today = getTodayDate();
        const supabase = (0, client_1.createSupabaseBrowserClient)();
        if (habit.log_id) {
            const { error } = await supabase
                .from("habit_logs")
                .update({ completed: !habit.completed_today })
                .eq("id", habit.log_id);
            if (error) {
                console.error('toggleHabitToday:', error);
                return;
            }
        }
        else {
            const payload = {
                habit_id: habitId,
                user_id: userId,
                date: today,
                completed: true,
            };
            const { error } = await supabase.from("habit_logs").insert(payload);
            if (error) {
                console.error('toggleHabitToday:', error);
                return;
            }
        }
        await get().fetchHabits();
    },
    journalEntry: null,
    fetchJournalEntry: async (date) => {
        const userId = get().userId;
        if (!userId)
            return;
        const supabase = (0, client_1.createSupabaseBrowserClient)();
        const { data, error } = await supabase
            .from("journal_entries")
            .select("*")
            .eq("user_id", userId)
            .eq("date", date)
            .single();
        if (error) {
            if (error.code === 'PGRST116') {
                set({ journalEntry: null });
                return;
            }
            console.error('fetchJournalEntry:', error);
            return;
        }
        set({ journalEntry: data });
    },
    saveJournalEntry: async (content, date) => {
        const userId = get().userId;
        if (!userId)
            return;
        const supabase = (0, client_1.createSupabaseBrowserClient)();
        const trimmedContent = content.trim();
        if (!trimmedContent) {
            const { error } = await supabase
                .from("journal_entries")
                .delete()
                .eq("user_id", userId)
                .eq("date", date);
            if (error) {
                console.error('saveJournalEntry:', error);
                return;
            }
            set({ journalEntry: null });
            return;
        }
        const { data: existingEntry, error: existingEntryError } = await supabase
            .from("journal_entries")
            .select("id")
            .eq("user_id", userId)
            .eq("date", date)
            .maybeSingle();
        if (existingEntryError) {
            console.error('saveJournalEntry:', existingEntryError);
            return;
        }
        const { error } = existingEntry
            ? await supabase
                .from("journal_entries")
                .update({ content: trimmedContent })
                .eq("id", existingEntry.id)
            : await supabase.from("journal_entries").insert({
                user_id: userId,
                content: trimmedContent,
                date,
            });
        if (error) {
            console.error('saveJournalEntry:', error);
            return;
        }
        await get().fetchJournalEntry(date);
    },
    notificationSettings: null,
    fetchNotificationSettings: async () => {
        const userId = get().userId;
        if (!userId)
            return;
        const supabase = (0, client_1.createSupabaseBrowserClient)();
        const { data, error } = await supabase
            .from("notification_settings")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();
        if (error) {
            console.error('fetchNotificationSettings:', error);
            return;
        }
        set({ notificationSettings: data ?? null });
    },
    updateNotificationSettings: async (updates) => {
        const userId = get().userId;
        if (!userId)
            return;
        const supabase = (0, client_1.createSupabaseBrowserClient)();
        const { error } = await supabase
            .from("notification_settings")
            .update(updates)
            .eq("user_id", userId);
        if (error) {
            console.error('updateNotificationSettings:', error);
            return;
        }
        await get().fetchNotificationSettings();
    },
    initializeAllsenadro: async (userId) => {
        set({ userId, isLoading: true });
        const today = getTodayDate();
        const supabase = (0, client_1.createSupabaseBrowserClient)();
        const profilePromise = (async () => {
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userId)
                .maybeSingle();
            if (error) {
                console.error('initializeAllsenadro:', error);
                return;
            }
            set({ profile: data ?? null });
        })();
        await Promise.all([
            profilePromise,
            get().fetchCollections(),
            get().fetchPresets(),
            get().fetchHabits(),
            get().fetchJournalEntry(today),
            get().fetchNotificationSettings(),
        ]);
        set({ isLoading: false });
    },
}), {
    name: 'allsenadro-ui',
    partialize: (state) => ({
        uiPreferences: state.uiPreferences,
        activePresetId: state.activePresetId,
        habits: state.habits.filter((habit) => isLocalHabitId(habit.id)),
    }),
}));
