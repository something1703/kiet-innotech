"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

/**
 * Search input that reports its value after the user pauses typing.
 * Give it a new `key` to reset it from outside (e.g. "Clear filters").
 */
export function SearchBox({
  id,
  label,
  placeholder,
  value,
  onSearch,
}: {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onSearch: (value: string) => void;
}) {
  const [text, setText] = useState(value);

  useEffect(() => {
    if (text.trim() === value) return;
    const timer = setTimeout(() => onSearch(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text, value, onSearch]);

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-navy-800">
        {label}
      </label>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          id={id}
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearch(text.trim());
          }}
          placeholder={placeholder}
          className="block h-10 w-full rounded-xl border-0 bg-white pl-9 pr-3 text-sm text-ink ring-1 ring-inset ring-line placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
    </div>
  );
}
