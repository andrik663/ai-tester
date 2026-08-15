/**
 * Global Typography System
 * Standardized text sizing, weights, and spacing across all dashboards
 * Use these constants to ensure consistency in the entire application
 */

// ── Page Titles & Headers ───────────────────────────────────────────────
export const TYPOGRAPHY = {
  // Page/Tab titles
  pageTitle: "text-2xl font-bold",           // "Provider Catalog", "API Key Tester"
  
  // Section headers (within tabs)
  sectionTitle: "text-lg font-bold",         // "Model Pricing", "Featured Models"
  sectionSubtitle: "text-sm font-semibold",  // Stats, descriptions
  
  // Subsection headers
  subsectionTitle: "text-sm font-bold",      // Column headers, form labels
  subsectionLabel: "text-xs font-semibold uppercase tracking-wide", // "Pricing", "Status"
  
  // Card/item titles
  cardTitle: "text-base font-bold",          // Provider names, key names
  cardSubtitle: "text-sm font-semibold",     // Secondary info in cards
  
  // Body text & descriptions
  bodyLarge: "text-base leading-relaxed",    // Main content, descriptions
  bodyNormal: "text-sm leading-relaxed",     // Default body text
  bodySmall: "text-xs leading-relaxed",      // Secondary descriptions
  
  // Numbers & data
  numberLarge: "text-lg font-mono font-bold tabular-nums",   // Large metrics (e.g., "1,234")
  numberNormal: "text-sm font-mono font-bold tabular-nums",  // Standard numbers (prices, counts)
  numberSmall: "text-xs font-mono font-bold tabular-nums",   // Small numbers (percentages)
  
  // Labels & badges
  badge: "text-xs font-semibold",            // Status badges, tags
  badgeSmall: "text-[10px] font-semibold",   // Compact badges
  
  // Code/monospace
  codeLarge: "text-sm font-mono",            // Code blocks, full model names
  codeNormal: "text-xs font-mono",           // Inline code, abbreviated names
  codeSmall: "text-[10px] font-mono",        // Compact code display
  
  // Form inputs & buttons
  buttonText: "text-sm font-semibold",       // Button labels
  inputText: "text-sm",                      // Input field text
  placeholder: "text-sm text-muted-foreground/50", // Placeholder text
  
  // Helper text
  helperText: "text-xs text-muted-foreground",  // Form helper text
  errorText: "text-xs text-destructive",        // Error messages
  successText: "text-xs text-success",          // Success messages
  
  // UI elements
  iconLabel: "text-xs",                      // Labels next to icons
  separator: "text-xs text-muted-foreground/40", // Dividers, separators
} as const

// ── Spacing System ──────────────────────────────────────────────────────
export const SPACING = {
  // Section spacing
  sectionGap: "gap-4",           // Between major sections
  cardGap: "gap-3",              // Between cards in a grid
  itemGap: "gap-2",              // Between items in a list
  
  // Padding
  sectionPadding: "px-4 sm:px-6 py-4",     // Section container padding
  cardPadding: "px-4 py-3",                // Card internal padding
  itemPadding: "px-3 py-2",                // List item padding
  
  // Gaps within cards
  cardContentGap: "gap-2",       // Between title/content in card
  
  // Table spacing
  tableHeaderPadding: "px-3 py-2.5",
  tableRowPadding: "px-3 py-2",
  tableGap: "gap-1",
} as const

// ── Color combinations for text (with accessibility in mind) ────────────
export const TEXT_COLORS = {
  primary: "text-foreground",              // Main text
  secondary: "text-foreground/80",         // Secondary text
  tertiary: "text-muted-foreground",       // Tertiary text
  muted: "text-muted-foreground/60",       // Very muted text
  disabled: "text-muted-foreground/40",    // Disabled text
  
  // Semantic colors
  success: "text-success",
  warning: "text-yellow-400",
  error: "text-destructive",
  info: "text-info",
} as const

// ── Utility function to combine typography + color ─────────────────────
export function typographyClass(
  typography: keyof typeof TYPOGRAPHY,
  color?: keyof typeof TEXT_COLORS
): string {
  const typo = TYPOGRAPHY[typography]
  const col = color ? TEXT_COLORS[color] : TEXT_COLORS.primary
  return `${typo} ${col}`
}

// ── Dashboard text standards ─────────────────────────────────────────────
export const DASHBOARD_TYPOGRAPHY = {
  // Header area
  headerTitle: "text-xl font-bold",          // Tab title
  headerStats: "text-sm text-muted-foreground", // Subtitle/stats
  
  // List/table headers
  columnHeader: "text-xs font-bold uppercase tracking-wider",
  
  // Data cells
  dataNumber: "text-sm font-mono font-semibold",
  dataText: "text-sm",
  
  // Empty states
  emptyTitle: "text-base font-semibold",
  emptyDescription: "text-sm text-muted-foreground",
  
  // Modals/cards
  modalTitle: "text-lg font-bold",
  modalDescription: "text-sm text-muted-foreground",
} as const

export type TypographyKey = keyof typeof TYPOGRAPHY
export type TextColorKey = keyof typeof TEXT_COLORS
export type DashboardTypographyKey = keyof typeof DASHBOARD_TYPOGRAPHY
