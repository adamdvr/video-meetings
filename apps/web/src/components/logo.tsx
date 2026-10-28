import Video from '@gravity-ui/icons/Video';
import Link from 'next/link';

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-3 rounded-lg font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current ${className}`}
    >
      <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground shadow-lg shadow-accent/30">
        <Video aria-hidden="true" className="size-5" />
      </span>
      <span className="text-lg tracking-tight">Video meetings</span>
    </Link>
  );
}
