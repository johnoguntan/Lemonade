"use client"

import { useEffect, useRef } from "react"
import { Paperclip, Plus, X } from "lucide-react"
import type { TaskDraftState } from "@/components/task-creation/QuickInputBar"

type AttachmentDropdownProps = {
  value: TaskDraftState
  onChange: (updates: Partial<TaskDraftState>) => void
}

export function AttachmentDropdown({ value, onChange }: AttachmentDropdownProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const notesRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const node = notesRef.current
    if (!node) return
    node.style.height = "0px"
    node.style.height = `${node.scrollHeight}px`
  }, [value.notes])

  const updateSubtask = (index: number, nextValue: string) => {
    onChange({
      subtasks: value.subtasks.map((item, itemIndex) => (itemIndex === index ? nextValue : item)),
    })
  }

  return (
    <div className="w-[380px] rounded-2xl border border-gray-100 bg-white p-5 shadow-xl">
      <div>
        <div className="mb-3 text-base text-gray-900">Add Subtasks</div>
        <button
          type="button"
          onClick={() => onChange({ subtasks: [...value.subtasks, ""] })}
          className="mb-3 text-lg text-black"
        >
          <Plus size={18} />
        </button>

        <div className="space-y-2">
          {value.subtasks.map((subtask, index) => (
            <div key={`${index}-${subtask}`} className="flex items-center gap-2">
              <input
                value={subtask}
                onChange={(event) => updateSubtask(index, event.target.value)}
                className="flex-1 border-b border-gray-200 px-1 py-1 text-sm outline-none"
                placeholder="Subtask"
              />
              <button
                type="button"
                onClick={() => onChange({ subtasks: value.subtasks.filter((_, itemIndex) => itemIndex !== index) })}
                className="text-gray-400"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <div className="space-y-3">
          <input
            value={value.url}
            onChange={(event) => onChange({ url: event.target.value })}
            placeholder="Add URL"
            className="w-full text-lg text-gray-400 outline-none placeholder:text-gray-300"
          />
          <input
            value={value.phone}
            onChange={(event) => onChange({ phone: event.target.value })}
            placeholder="Add Phone"
            className="w-full text-lg text-gray-400 outline-none placeholder:text-gray-300"
          />
          <input
            value={value.address}
            onChange={(event) => onChange({ address: event.target.value })}
            placeholder="Add Address"
            className="w-full text-lg text-gray-400 outline-none placeholder:text-gray-300"
          />
        </div>
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-3 text-[18px] text-black"
        >
          <span>Add Attachment</span>
          <Paperclip size={18} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null
            if (!file) {
              onChange({ attachmentFile: null, attachmentName: null, attachmentDataUrl: null })
              return
            }
            // Whitelist safe MIME types — block executables, scripts, and arbitrary HTML.
            const ALLOWED_MIME_TYPES = [
              "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
              "application/pdf",
              "text/plain",
            ]
            if (!ALLOWED_MIME_TYPES.includes(file.type)) {
              onChange({ attachmentFile: file, attachmentName: `${file.name} (unsupported file type)`, attachmentDataUrl: null })
              return
            }
            // Cap at ~2MB so a base64 attachment can't blow the localStorage quota.
            if (file.size > 2 * 1024 * 1024) {
              onChange({ attachmentFile: file, attachmentName: `${file.name} (too large to store)`, attachmentDataUrl: null })
              return
            }
            const reader = new FileReader()
            reader.onload = () =>
              onChange({
                attachmentFile: file,
                attachmentName: file.name,
                attachmentDataUrl: typeof reader.result === "string" ? reader.result : null,
              })
            reader.readAsDataURL(file)
          }}
        />
        {value.attachmentName ? <p className="mt-2 text-sm text-gray-400">{value.attachmentName}</p> : null}
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <textarea
          ref={notesRef}
          value={value.notes}
          onChange={(event) => onChange({ notes: event.target.value })}
          placeholder="Add Notes"
          className="min-h-[36px] w-full resize-none overflow-hidden bg-transparent text-lg text-gray-500 outline-none placeholder:text-gray-300"
        />
      </div>
    </div>
  )
}
