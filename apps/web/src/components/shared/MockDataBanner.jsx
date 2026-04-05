/**
 * MockDataBanner — Shown when a page is displaying mock/fallback data
 * instead of real VistA data.
 *
 * Usage: {data?.source === 'mock' && <MockDataBanner />}
 */
export default function MockDataBanner({ endpoint }) {
  return (
    <div className="mx-6 mt-4 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-3">
      <span className="material-symbols-outlined text-[20px] text-amber-500 mt-0.5">cloud_off</span>
      <div>
        <p className="text-[13px] font-semibold text-amber-800">Using Demo Data</p>
        <p className="text-[11px] text-amber-700 mt-0.5">
          The VistA backend did not respond. The data shown is generated locally for demonstration purposes
          and does not reflect real patient or system records.
          {endpoint && (
            <span className="block mt-1 font-mono text-[10px] text-amber-600">
              Endpoint: {endpoint}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
