"use client"

import { useMemo, useRef, useState } from "react"
import { Pipette, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DEFAULT_COLOR_PALETTE, mergeColorPalette, normalizeHexColor, upsertColorPalette } from "@/lib/colors"

interface ColorPickerPanelProps {
  value?: string
  palette?: readonly string[]
  onChange: (color: string) => void
  onPaletteChange?: (palette: string[]) => void
  onClear?: () => void
  title?: string
  description?: string
  clearLabel?: string
}

export function ColorPickerPanel({
  value,
  palette = DEFAULT_COLOR_PALETTE,
  onChange,
  onPaletteChange,
  onClear,
  title = "Color",
  description = "Choose a saved swatch or open the system color wheel.",
  clearLabel = "Clear",
}: ColorPickerPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const normalizedValue = normalizeHexColor(value)
  const [draftHex, setDraftHex] = useState(normalizedValue ?? "#000000")
  const [isEditingHex, setIsEditingHex] = useState(false)

  const swatches = useMemo(
    () => mergeColorPalette(palette, DEFAULT_COLOR_PALETTE),
    [palette]
  )

  const applyColor = (nextColor: string) => {
    const normalized = normalizeHexColor(nextColor)
    if (!normalized) {
      return
    }

    setDraftHex(normalized)
    onChange(normalized)
    onPaletteChange?.(upsertColorPalette(palette, normalized))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{title}</div>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{description}</p>
        </div>
        {onClear ? (
          <Button type="button" variant="outline" size="sm" className="h-7 text-[11px]" onClick={onClear}>
            <RotateCcw className="mr-1.5 size-3.5" />
            {clearLabel}
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "size-10 shrink-0 rounded-xl border shadow-sm transition-transform hover:scale-[1.03]",
            normalizedValue ? "border-black/10 dark:border-white/10" : "border-border bg-background"
          )}
          style={normalizedValue ? { backgroundColor: normalizedValue } : undefined}
          aria-label="Open color wheel"
          title="Open color wheel"
        />
        <input
          ref={inputRef}
          type="color"
          value={draftHex}
          onChange={(event) => applyColor(event.target.value)}
          className="sr-only"
          aria-label="Pick a color"
        />
        <input
          type="text"
          value={isEditingHex ? draftHex : normalizedValue ?? ""}
          onChange={(event) => setDraftHex(event.target.value)}
          onFocus={() => {
            setIsEditingHex(true)
            setDraftHex(normalizedValue ?? "#000000")
          }}
          onBlur={() => {
            const normalized = normalizeHexColor(draftHex)
            if (normalized) {
              applyColor(normalized)
            } else {
              setDraftHex(normalizedValue ?? "#000000")
            }
            setIsEditingHex(false)
          }}
          placeholder="#rrggbb"
          className="h-9 flex-1 rounded-md border border-border bg-transparent px-3 text-[11px] uppercase outline-none"
          spellCheck={false}
        />
        <Button type="button" variant="outline" size="sm" className="h-9 text-[11px]" onClick={() => inputRef.current?.click()}>
          <Pipette className="mr-1.5 size-3.5" />
          Wheel
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {swatches.map((hex) => (
          <button
            key={hex}
            type="button"
            onClick={() => applyColor(hex)}
            className={cn(
              "size-7 rounded-md border transition-transform hover:scale-105",
              hex === "#ffffff" ? "border-border" : "border-black/5 dark:border-white/10",
              normalizedValue === hex && "ring-2 ring-foreground ring-offset-2 ring-offset-background"
            )}
            style={{ backgroundColor: hex }}
            title={hex.toUpperCase()}
            aria-label={`Use ${hex}`}
          />
        ))}
      </div>
    </div>
  )
}
