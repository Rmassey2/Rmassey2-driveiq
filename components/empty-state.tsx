export default function EmptyState({
  message,
  action,
  onAction,
}: {
  message: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg bg-[#111d33] p-12">
      <svg
        className="mb-4 h-12 w-12 text-gray-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
        />
      </svg>
      <p className="text-gray-400">{message}</p>
      {action && onAction && (
        <button
          onClick={onAction}
          className="mt-4 rounded-lg bg-[#c8a951] px-4 py-2 text-sm font-semibold text-[#0a1628] hover:bg-[#b8993e]"
        >
          {action}
        </button>
      )}
    </div>
  );
}
