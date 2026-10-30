import { Card, Skeleton } from '@heroui/react';

export function MeetingsSkeleton() {
  return (
    <div role="status">
      <span className="sr-only">Загружаем встречи…</span>
      <div
        aria-hidden="true"
        className="motion-reduce:[&_.skeleton::after]:animate-none"
      >
        <Skeleton className="mt-10 h-7 w-52 rounded-md" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Card key={index}>
              <Skeleton className="h-6 w-3/4 rounded-md" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-5 w-4/5 rounded-md" />
                <Skeleton className="h-5 w-2/5 rounded-md" />
              </div>
            </Card>
          ))}
        </div>
        <Skeleton className="mt-10 h-7 w-40 rounded-md" />
        <Card className="mt-4 gap-0 p-0">
          <div className="divide-y divide-separator">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="flex flex-col gap-2 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8"
              >
                <Skeleton className="h-6 w-2/3 rounded-md lg:w-1/3" />
                <Skeleton className="h-5 w-1/2 rounded-md lg:w-96" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
