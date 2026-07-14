"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { inputClassName } from "@/app/components/ui/Field"

export type SearchableSelectOption = {
  value: string
  label: string
}

type FilterMode = "auto" | "prefix" | "contains" | "tokens"

type Props = {
  id: string
  options: SearchableSelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  noResultsLabel?: string
  disabled?: boolean
  required?: boolean
  allowEmpty?: boolean
  emptyLabel?: string
  filterMode?: FilterMode
  className?: string
  "aria-label"?: string
  onQueryChange?: (query: string) => void
}

type DropdownPosition = {
  top: number
  left: number
  width: number
}

const foldSearch = (input: string) =>
  input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()

const queryTokens = (query: string) =>
  foldSearch(query)
    .split(/\s+/)
    .filter(Boolean)

export const matchesSearchQuery = (label: string, query: string, mode: FilterMode) => {
  const q = foldSearch(query)
  if (!q) return true
  const folded = foldSearch(label)
  if (mode === "prefix") return folded.startsWith(q)
  if (mode === "contains") return folded.includes(q)
  if (mode === "tokens") {
    return queryTokens(query).every((token) => folded.includes(token))
  }
  if (q.length === 1) return folded.includes(q)
  return folded.startsWith(q)
}

const matchesQuery = matchesSearchQuery

export default function SearchableSelect({
  id,
  options,
  value,
  onChange,
  placeholder,
  noResultsLabel = "No matches",
  disabled = false,
  required = false,
  allowEmpty = false,
  emptyLabel = "—",
  filterMode = "auto",
  className = "",
  "aria-label": ariaLabel,
  onQueryChange,
}: Props) {
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const [dropdownPos, setDropdownPos] = useState<DropdownPosition | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const selectedLabel = useMemo(() => {
    if (!value) return ""
    return options.find((o) => o.value === value)?.label ?? value
  }, [options, value])

  const filteredOptions = useMemo(() => {
    const base = options.filter((o) => matchesQuery(o.label, query, filterMode))
    if (!allowEmpty) return base
    return [{ value: "", label: emptyLabel }, ...base]
  }, [allowEmpty, emptyLabel, filterMode, options, query])

  const updateDropdownPosition = useCallback(() => {
    const input = inputRef.current
    if (!input) return
    const rect = input.getBoundingClientRect()
    setDropdownPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    })
  }, [])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, open])

  useEffect(() => {
    onQueryChange?.(open ? query : "")
  }, [open, query, onQueryChange])

  useEffect(() => {
    if (!open) return
    updateDropdownPosition()
    const handleReposition = () => updateDropdownPosition()
    window.addEventListener("resize", handleReposition)
    window.addEventListener("scroll", handleReposition, true)
    return () => {
      window.removeEventListener("resize", handleReposition)
      window.removeEventListener("scroll", handleReposition, true)
    }
  }, [open, updateDropdownPosition, filteredOptions.length])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      const listbox = document.getElementById(listboxId)
      if (listbox?.contains(target)) return
      setOpen(false)
      setQuery("")
    }
    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [listboxId, open])

  const handleSelect = (nextValue: string) => {
    onChange(nextValue)
    setOpen(false)
    setQuery("")
    inputRef.current?.blur()
  }

  const openList = () => {
    if (disabled) return
    setOpen(true)
    setQuery("")
    updateDropdownPosition()
  }

  const handleInputFocus = () => {
    openList()
  }

  const handleInputChange = (next: string) => {
    setQuery(next)
    if (!open) {
      setOpen(true)
      updateDropdownPosition()
    }
  }

  const resolveTypedValue = () => {
    const q = foldSearch(query)
    if (!q) return
    const exact = options.find((o) => foldSearch(o.label) === q)
    if (exact) {
      onChange(exact.value)
      return
    }
    const matches = options.filter((o) => matchesQuery(o.label, query, filterMode))
    if (matches.length === 1) {
      onChange(matches[0].value)
    }
  }

  const handleBlur = () => {
    window.setTimeout(() => {
      const active = document.activeElement
      const listbox = document.getElementById(listboxId)
      if (rootRef.current?.contains(active) || listbox?.contains(active)) return
      resolveTypedValue()
      setOpen(false)
      setQuery("")
    }, 120)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false)
      setQuery("")
      return
    }
    if (event.key === "ArrowDown") {
      event.preventDefault()
      if (!open) openList()
      setActiveIndex((i) => Math.min(i + 1, Math.max(filteredOptions.length - 1, 0)))
      return
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
      return
    }
    if (event.key === "Enter" && open) {
      event.preventDefault()
      const pick = filteredOptions[activeIndex]
      if (pick) handleSelect(pick.value)
    }
  }

  const handleToggleList = () => {
    if (open) {
      setOpen(false)
      setQuery("")
      return
    }
    openList()
    inputRef.current?.focus()
  }

  const displayValue = open ? query : selectedLabel
  const inputPlaceholder =
    placeholder ?? (allowEmpty ? emptyLabel : selectedLabel || "—")

  const dropdown =
    open && !disabled && dropdownPos && mounted
      ? createPortal(
          <ul
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel}
            className="max-h-60 overflow-y-auto rounded-lg border border-border-subtle bg-elevated py-1 shadow-xl"
            style={{
              position: "fixed",
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              zIndex: 9999,
            }}
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted">{noResultsLabel}</li>
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = option.value === value
                const isActive = index === activeIndex
                return (
                  <li key={option.value || "__empty__"} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                        isActive
                          ? "bg-accent/10 text-foreground"
                          : isSelected
                            ? "bg-surface font-medium text-foreground"
                            : "text-foreground hover:bg-surface/80"
                      }`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelect(option.value)}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      {option.label}
                    </button>
                  </li>
                )
              })
            )}
          </ul>,
          document.body,
        )
      : null

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-label={ariaLabel}
          autoComplete="off"
          required={required && !value}
          disabled={disabled}
          className={`${inputClassName} pr-10`}
          value={displayValue}
          placeholder={inputPlaceholder}
          onFocus={handleInputFocus}
          onClick={openList}
          onChange={(e) => handleInputChange(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? "Close list" : "Open list"}
          disabled={disabled}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted hover:text-foreground disabled:opacity-50"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleToggleList}
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
      {dropdown}
    </div>
  )
}
