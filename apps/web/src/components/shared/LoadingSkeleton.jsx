import React from 'react';

function Bone({ className = '' }) {
  return <div className={`animate-pulse bg-[#E2E4E8] rounded ${className}`} />;
}

export function TableSkeleton({ rows = 8, cols = 6 }) {
  return (
    <div className="space-y-0">
      <div className="bg-[#1A1A2E] h-10 rounded-t flex items-center gap-4 px-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Bone key={i} className="h-3 bg-white/20 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className={`flex items-center gap-4 px-4 py-3 ${r % 2 ? 'bg-[#F5F8FB]' : 'bg-white'}`}>
          {Array.from({ length: cols }).map((_, c) => (
            <Bone key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function KpiCardSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-[#E2E4E8] rounded-lg p-4 space-y-2">
          <Bone className="h-3 w-24" />
          <Bone className="h-8 w-16" />
          <Bone className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Bone className="h-8 w-56" />
        <Bone className="h-10 w-40" />
      </div>
      <Bone className="h-10 w-full" />
      <div className="flex gap-2">
        <Bone className="h-8 w-20" />
        <Bone className="h-8 w-20" />
        <Bone className="h-8 w-20" />
      </div>
      <KpiCardSkeleton />
      <TableSkeleton />
    </div>
  );
}

export default PageSkeleton;
