import { cn } from "@/lib/utils";

export function KilnMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("h-5 w-5", className)}
    >
      <path
        d="M4 20V9.2c0-1 .6-1.9 1.5-2.3L12 4l6.5 2.9c.9.4 1.5 1.3 1.5 2.3V20"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M2 20h20" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M12 9.2c1.6 1.4 2.4 2.6 2.4 3.7 0 1.4-1.1 2.4-2.4 2.4s-2.4-1-2.4-2.4c0-1.1.8-2.3 2.4-3.7Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <KilnMark />
      <span className="text-[15px] font-medium tracking-tight">Kiln</span>
    </span>
  );
}
