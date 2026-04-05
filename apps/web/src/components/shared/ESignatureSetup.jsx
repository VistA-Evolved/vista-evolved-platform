import { useState } from 'react';
import { setESignatureCode } from '../../services/adminService';

export default function ESignatureSetup({ duz, userName, onComplete, onSkip }) {
  const [code, setCode] = useState('');
  const [confirm, setConfirm] = useState('');
  const [sigBlockName, setSigBlockName] = useState(userName || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const valid = code.length >= 6 && code === confirm;

  const handleSubmit = async () => {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      const res = await setESignatureCode(duz, { code, sigBlockName });
      if (res?.ok || res?.integrationPending) {
        onComplete();
      } else {
        setError(res?.error || 'Failed to set e-signature');
      }
    } catch (e) {
      setError(e?.message || 'Failed to set e-signature');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[460px] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px] text-blue-700">draw</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1A1A2E]">Set Up Electronic Signature</h2>
            <p className="text-xs text-[#888]">Required for signing orders and clinical documents</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-[#555] block mb-1">Signature Block Name</label>
            <input type="text" value={sigBlockName} onChange={e => setSigBlockName(e.target.value)}
              className="w-full h-9 px-3 border border-[#E2E4E8] rounded-md text-sm"
              placeholder="Your printed name as it appears on documents" />
          </div>
          <div>
            <label className="text-xs font-medium text-[#555] block mb-1">Electronic Signature Code</label>
            <input type="password" value={code} onChange={e => setCode(e.target.value)}
              className="w-full h-9 px-3 border border-[#E2E4E8] rounded-md text-sm"
              placeholder="Minimum 6 characters" autoComplete="new-password" />
            {code.length > 0 && code.length < 6 && (
              <p className="text-[11px] text-red-500 mt-1">Must be at least 6 characters</p>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-[#555] block mb-1">Confirm Signature Code</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              className="w-full h-9 px-3 border border-[#E2E4E8] rounded-md text-sm"
              placeholder="Re-enter code" autoComplete="new-password" />
            {confirm.length > 0 && code !== confirm && (
              <p className="text-[11px] text-red-500 mt-1">Codes do not match</p>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-md text-[12px] text-red-700">{error}</div>
        )}

        <div className="flex justify-between mt-5">
          <button onClick={onSkip} className="px-4 py-2 text-xs text-[#888] hover:text-[#555]">
            Remind Me Later
          </button>
          <button onClick={handleSubmit} disabled={!valid || saving}
            className="px-5 py-2 text-xs font-medium bg-[#1A1A2E] text-white rounded-md hover:bg-[#2E5984] disabled:opacity-40">
            {saving ? 'Setting…' : 'Set Signature'}
          </button>
        </div>
      </div>
    </div>
  );
}
