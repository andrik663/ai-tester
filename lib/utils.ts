/**
 * lib/utils.ts — Shared UI utility helpers.
 *
 * Keep this file small. Only add generic, stateless utilities here.
 * Business-logic helpers belong in their own dedicated lib modules.
 */

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind CSS class names with conflict resolution.
 *
 * Combines `clsx` (conditional / array / object class composition) with
 * `tailwind-merge` (removes conflicting Tailwind utility classes so the
 * last value always wins). Use this everywhere instead of plain template
 * literals when class names may overlap.
 *
 * @param inputs - Any number of class values: strings, arrays, or objects.
 *   Falsy values (`false`, `null`, `undefined`) are safely ignored.
 * @returns A single, deduplicated Tailwind class string.
 *
 * @example
 * cn("px-4 py-2", isActive && "bg-primary", "px-6")
 * // → "py-2 bg-primary px-6"  (px-4 is overridden by px-6)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
