interface ParLevelBadgeProps {
  currentQty: number;
  parQty: number;
  reorderPoint: number;
}

export function ParLevelBadge({ currentQty, parQty, reorderPoint }: ParLevelBadgeProps) {
  if (currentQty <= reorderPoint) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        Low Stock
      </span>
    );
  }

  if (currentQty <= parQty) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold text-yellow-700">
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
        Order Soon
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      In Stock
    </span>
  );
}
