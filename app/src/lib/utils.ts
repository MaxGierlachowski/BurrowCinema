import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Same helper as in the web app, so className strings can be shared 1:1. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
