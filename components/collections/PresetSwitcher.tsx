"use client"

import type { PresetWithCollections } from "@/lib/types"

type PresetSwitcherProps = {
  presets: PresetWithCollections[]
  activePresetId: string
  onSwitch: (presetId: string) => void
}

export function PresetSwitcher({ presets, activePresetId, onSwitch }: PresetSwitcherProps) {
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max items-center gap-2 pb-1">
        {presets.map((preset) => {
          const active = preset.id === activePresetId

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSwitch(preset.id)}
              className={[
                "rounded-full border px-3 py-1 text-xs transition",
                active
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-300 text-gray-500 hover:border-gray-500",
              ].join(" ")}
            >
              {preset.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
