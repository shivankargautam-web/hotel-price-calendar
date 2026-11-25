"use client";

import { useId, useMemo, useRef, useState } from "react";
import { resolveTarget, searchTargets, type SearchTarget } from "@/lib/catalogue";

const KIND_LABEL: Record<SearchTarget["kind"], string> = {
  brand: "Brands",
  all: "Brands",
  city: "Cities",
  hotel: "Hotels",
};

export function SearchBox({ value, onChange }: { value: string; onChange: (target: string) => void }) {
  const selected = resolveTarget(value);
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const options = useMemo(() => searchTargets(term), [term]);

  const choose = (target: SearchTarget) => {
    onChange(target.value);
    setTerm("");
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="searchbox">
      <label htmlFor={`${listId}-input`} className="field-label">
        Hotel, brand or city
      </label>
      <input
        id={`${listId}-input`}
        ref={inputRef}
        className="searchbox-input"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
        placeholder={selected?.label ?? "Search Taj, Udaipur, Rambagh…"}
        value={open ? term : (selected?.label ?? "")}
        onFocus={() => {
          setOpen(true);
          setActive(0);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          setTerm(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, options.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && options[active]) {
            e.preventDefault();
            choose(options[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
      />
      {selected && !open && <span className="searchbox-detail">{selected.detail}</span>}
      {open && (
        <ul id={listId} role="listbox" className="searchbox-list">
          {options.length === 0 && <li className="searchbox-empty">No tracked hotel matches “{term}”</li>}
          {options.map((option, i) => {
            const heading = i === 0 || KIND_LABEL[options[i - 1].kind] !== KIND_LABEL[option.kind];
            return (
              <li key={option.value} role="presentation">
                {heading && <div className="searchbox-group">{KIND_LABEL[option.kind]}</div>}
                <div
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={option.value === value}
                  className={`searchbox-option${i === active ? " is-active" : ""}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(option);
                  }}
                  onMouseEnter={() => setActive(i)}
                >
                  <span>{option.label}</span>
                  <span className="searchbox-option-detail">{option.detail}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
