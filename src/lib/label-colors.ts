// Label colors, shared by server and client code. Class names are written out
// in full so Tailwind generates them.
export const LABEL_COLORS = {
  gray: { name: "Gray", chip: "bg-zinc-100 text-zinc-800 dark:bg-zinc-500/15 dark:text-zinc-300", dot: "bg-zinc-400" },
  red: { name: "Red", chip: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300", dot: "bg-red-500" },
  orange: { name: "Orange", chip: "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300", dot: "bg-orange-500" },
  amber: { name: "Amber", chip: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300", dot: "bg-amber-500" },
  green: { name: "Green", chip: "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300", dot: "bg-green-500" },
  teal: { name: "Teal", chip: "bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300", dot: "bg-teal-500" },
  blue: { name: "Blue", chip: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300", dot: "bg-blue-500" },
  indigo: { name: "Indigo", chip: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300", dot: "bg-indigo-500" },
  purple: { name: "Purple", chip: "bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300", dot: "bg-purple-500" },
  pink: { name: "Pink", chip: "bg-pink-100 text-pink-800 dark:bg-pink-500/15 dark:text-pink-300", dot: "bg-pink-500" },
} as const;

export type LabelColor = keyof typeof LABEL_COLORS;
export const LABEL_COLOR_KEYS = Object.keys(LABEL_COLORS) as LabelColor[];
