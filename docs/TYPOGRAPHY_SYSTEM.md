# Global Typography System

Dokumentasi lengkap untuk konsistensi typography di seluruh aplikasi AI Tester.

## Overview

Sistem typography global memastikan semua dashboard (Test, Batch, Saved, Identify, Pricing) memiliki:
- **Text sizes yang konsisten** (xs, sm, base, lg, xl)
- **Number formatting yang standar** (font-mono, font-bold, tabular-nums)
- **Color contrast yang baik** untuk readability
- **Spacing yang proporsional** antar elemen

## Core Principles

1. **Hierarchy adalah kunci** — Judul > subtitle > body > helper
2. **Monospace untuk numbers** — Agar alignment lebih rapi
3. **Bold untuk data penting** — Harga, metrics, counts
4. **Muted untuk secondary info** — Dates, descriptions, helpers

## Typography Constants

Semua konstant tersedia di `lib/typography-system.ts`:

### Page Titles & Headers
```tsx
import { TYPOGRAPHY } from "@/lib/typography-system"

// Page/Tab titles (e.g., "Provider Catalog", "API Key Tester")
<h1 className={TYPOGRAPHY.pageTitle}>Provider Catalog</h1>

// Section headers (e.g., "Model Pricing", "Featured Models")
<h2 className={TYPOGRAPHY.sectionTitle}>Model Pricing</h2>

// Subsection headers (e.g., column headers, form labels)
<h3 className={TYPOGRAPHY.subsectionTitle}>All Models</h3>
```

### Body Text
```tsx
// Main content, descriptions
<p className={TYPOGRAPHY.bodyLarge}>Description here</p>

// Default body text
<p className={TYPOGRAPHY.bodyNormal}>Secondary text</p>

// Helper text
<p className={TYPOGRAPHY.bodySmall}>Helper information</p>
```

### Numbers & Data
```tsx
// Large metrics (token counts, total requests)
<span className={TYPOGRAPHY.numberLarge}>1,234,567</span>

// Standard numbers (prices, model counts)
<span className={TYPOGRAPHY.numberNormal}>$0.01/MT</span>

// Small numbers (percentages, ratios)
<span className={TYPOGRAPHY.numberSmall}>98%</span>
```

### Labels & Badges
```tsx
// Status badges, tags
<span className={TYPOGRAPHY.badge}>Active</span>

// Compact badges
<span className={TYPOGRAPHY.badgeSmall}>Pro</span>
```

## Tab-Specific Standards

### Test Tab (Manual Chat)
| Element | Class | Example |
|---------|-------|---------|
| Tab title | `text-xl font-bold` | "Test" |
| Provider name in header | `text-base font-bold` | "Gemini (Google)" |
| Model selector label | `text-xs font-semibold` | "Model:" |
| Model name | `text-sm font-semibold` | "Gemini 2.0 Flash" |
| Chat message (user) | `text-sm leading-relaxed` | User input |
| Chat reply (assistant) | `text-sm leading-relaxed` | AI response |
| Token count | `text-sm font-mono font-bold` | "1,234 tokens" |
| Latency | `text-sm font-mono` | "234ms" |

### Batch Tab
| Element | Class | Example |
|---------|-------|---------|
| Tab title | `text-xl font-bold` | "Batch" |
| Status badge | `text-xs font-bold` | "Passed", "Failed" |
| Percentage | `text-xs font-mono font-bold` | "95%" |
| Token usage | `text-sm font-mono font-bold` | "2,048 tokens" |
| Model name | `text-xs font-mono` | "gpt-4o" |
| Error message | `text-xs text-red-400` | Error details |

### Saved Keys Tab
| Element | Class | Example |
|---------|-------|---------|
| Key name | `text-base font-bold` | "OpenAI Key #1" |
| Provider name | `text-sm font-semibold` | "OpenAI" |
| Last used | `text-xs text-muted-foreground` | "2 hours ago" |
| Empty state | `text-base font-semibold` | "No saved keys yet" |

### Identify Tab
| Element | Class | Example |
|---------|-------|---------|
| Detected provider | `text-lg font-bold text-green-400` | "OpenAI" |
| Confidence | `text-sm font-mono font-bold` | "99%" |
| Key format | `text-xs font-mono` | "sk-proj-..." |

### Pricing Tab (Provider Catalog)
| Element | Class | Example |
|---------|-------|---------|
| Page title | `text-lg font-bold` | "Provider Catalog" |
| Stats | `text-sm` | "40 providers · 20 free tiers" |
| Provider name | `text-base font-bold` | "OpenAI" |
| Model count | `text-sm font-semibold` | "11 models" |
| Date | `text-xs text-muted-foreground` | "2026-06-23" |
| Model table header | `text-xs font-bold uppercase` | "Model", "In /1M", "Out /1M" |
| Model ID | `text-xs font-mono font-semibold` | "gpt-4o" |
| Price | `text-sm font-mono font-semibold` | "$0.003/MT" |
| Context size | `text-xs text-muted-foreground` | "128K ctx" |
| Description | `text-sm text-muted-foreground` | Provider description |

## Color Standards

### Text Colors
```tsx
import { TEXT_COLORS } from "@/lib/typography-system"

// Primary text (foreground)
<span className={TEXT_COLORS.primary}>Main text</span>

// Secondary text (80% opacity)
<span className={TEXT_COLORS.secondary}>Secondary text</span>

// Semantic colors
<span className={TEXT_COLORS.success}>Success</span>
<span className={TEXT_COLORS.error}>Error</span>
<span className={TEXT_COLORS.warning}>Warning</span>
```

## Spacing Standards

### Section Spacing
```tsx
import { SPACING } from "@/lib/typography-system"

// Between major sections
<div className={`flex flex-col ${SPACING.sectionGap}`}>

// Between cards in grid
<div className={`grid grid-cols-2 ${SPACING.cardGap}`}>

// Section padding
<div className={SPACING.sectionPadding}>
  Content
</div>
```

## Implementation Checklist

Ketika membuat komponen baru atau update existing:

- [ ] Use `TYPOGRAPHY` constants untuk text sizing
- [ ] Use `TEXT_COLORS` untuk konsistensi warna
- [ ] Use `SPACING` untuk padding/gap yang proporsional
- [ ] Numbers selalu pakai `font-mono font-bold`
- [ ] Prices selalu pakai `font-mono font-semibold` dengan `tabular-nums`
- [ ] Percentages pakai `font-mono font-bold`
- [ ] Column headers pakai `text-xs font-bold uppercase tracking-wider`
- [ ] Helper text selalu `text-xs text-muted-foreground`
- [ ] Ensure contrast ratio ≥ 4.5:1 untuk accessibility

## Example: Complete Card Component

```tsx
import { TYPOGRAPHY, SPACING, TEXT_COLORS } from "@/lib/typography-system"

export function ProviderCard({ name, description, modelCount, date }) {
  return (
    <div className={`border rounded-lg ${SPACING.cardPadding} bg-secondary/20`}>
      {/* Title */}
      <h3 className={TYPOGRAPHY.cardTitle}>{name}</h3>
      
      {/* Description */}
      <p className={`${TYPOGRAPHY.bodySmall} ${TEXT_COLORS.secondary} mt-2`}>
        {description}
      </p>
      
      {/* Footer */}
      <div className="flex justify-between items-end mt-3">
        <span className={TYPOGRAPHY.numberNormal}>{modelCount} models</span>
        <span className={`${TYPOGRAPHY.bodySmall} ${TEXT_COLORS.muted}`}>
          {date}
        </span>
      </div>
    </div>
  )
}
```

## Common Mistakes to Avoid

❌ **Jangan:** `text-[11px]`, `text-[13px]`, arbitrary sizes  
✅ **Pakai:** `text-xs`, `text-sm`, `text-base` dari Tailwind

❌ **Jangan:** Numbers tanpa `font-mono`  
✅ **Pakai:** `text-sm font-mono font-bold` untuk semua numbers

❌ **Jangan:** Mix muted colors untuk terlalu banyak elemen  
✅ **Pakai:** Hierarchy yang jelas: primary > secondary > muted

❌ **Jangan:** Inconsistent spacing (gap-1, gap-2, gap-4 random)  
✅ **Pakai:** `SPACING` constants untuk konsistensi

## Maintenance

Ketika perlu update typography global:

1. Edit `lib/typography-system.ts`
2. Update dokumentasi ini
3. Create PR dengan daftar perubahan
4. Test di semua 5 tabs (Test, Batch, Saved, Identify, Pricing)

---

**Last Updated:** 2026-06-23  
**Maintained by:** v0 Typography System  
**Version:** 1.0
