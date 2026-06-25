import { Skeleton } from "@/components/ui/skeleton";

export function ReportRowSkeleton() {
  return (
    <li className="flex items-stretch">
      <div className="flex-1 p-3">
        <div className="flex items-start gap-2.5">
          <Skeleton className="w-9 h-9 rounded-full shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-3/4 rounded" />
            <Skeleton className="h-3 w-1/2 rounded" />
            <div className="flex gap-1.5">
              <Skeleton className="h-3 w-12 rounded-full" />
              <Skeleton className="h-3 w-20 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

export function ReportListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: count }).map((_, i) => (
        <ReportRowSkeleton key={i} />
      ))}
    </ul>
  );
}

export function MissingCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <Skeleton className="h-40 w-full" />
      <div className="p-4 space-y-2.5">
        <Skeleton className="h-3.5 w-3/4 rounded" />
        <Skeleton className="h-3 w-1/2 rounded" />
        <Skeleton className="h-3 w-5/6 rounded" />
      </div>
      <div className="px-4 pb-4 flex gap-2">
        <Skeleton className="h-8 flex-1 rounded-lg" />
        <Skeleton className="h-8 w-10 rounded-lg" />
      </div>
    </div>
  );
}

export function MissingGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <MissingCardSkeleton key={i} />
      ))}
    </div>
  );
}
