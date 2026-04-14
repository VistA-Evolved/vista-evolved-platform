export default function LoginIntroPreview({
  heading = 'Login screen preview',
  helperText = 'Preview of the message shown above the sign-in form.',
  siteName = '',
  domain = '',
  production = '',
  message = '',
}) {
  const environmentLabel = String(production || '').toUpperCase() === 'YES' ? 'Production' : 'Test / Sandbox';
  const hasMessage = Boolean(String(message || '').trim());

  return (
    <div className="rounded-lg border border-[#D6E4F0] bg-[#F7FAFC] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#2E5984]">{heading}</div>
          <div className="text-[11px] text-[#64748B] mt-1">{helperText}</div>
        </div>
        <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-[#355070] border border-[#D6E4F0]">
          {environmentLabel}
        </span>
      </div>

      <div className="rounded-lg border border-[#E2E8F0] bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-[#1E293B]">{siteName || 'VistA Evolved'}</div>
        {domain && <div className="text-[11px] text-[#64748B] mt-1">{domain}</div>}
        <div className="mt-3 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-2 text-sm text-[#334155] whitespace-pre-wrap">
          {hasMessage ? message : 'No welcome message is configured. Users will only see the standard sign-in form.'}
        </div>
      </div>
    </div>
  );
}