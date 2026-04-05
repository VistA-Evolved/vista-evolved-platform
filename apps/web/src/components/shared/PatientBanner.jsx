import { useState, useEffect } from 'react';
import { usePatient } from './PatientContext';
import { getSession } from '../../services/adminService';

function formatDob(dob) {
  if (!dob) return '';
  const d = new Date(dob);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PatientBanner() {
  const { patient, hasPatient } = usePatient();
  const [collapsed, setCollapsed] = useState(false);
  const [isVA, setIsVA] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      setCollapsed(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const sess = await getSession();
        if (sess?.facilityType && sess.facilityType !== 'va') setIsVA(false);
      } catch { /* non-fatal */ }
    })();
  }, []);

  if (!hasPatient) return null;

  const allergyChips = patient.allergies || [];
  const hasAllergyAssessment = patient.allergyAssessment !== false;
  const behavioralFlags = (patient.flags || []).filter(f => f.category === 'Behavioral');
  const safetyFlags = (patient.flags || []).filter(f => f.category === 'Safety');
  const allWarningFlags = [...behavioralFlags, ...safetyFlags];
  const sexDisplay = patient.sex === 'M' ? 'Male' : patient.sex === 'F' ? 'Female' : (patient.gender === 'M' ? 'Male' : patient.gender === 'F' ? 'Female' : (patient.sex || patient.gender || ''));

  if (collapsed) {
    return (
      <div className="sticky top-0 z-20 bg-white border-b border-[#E2E4E8] h-12 flex items-center px-4 gap-4 shadow-sm">
        {patient.isRestricted && (
          <div className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">RESTRICTED</div>
        )}
        <span className="text-[14px] font-bold text-[#1A1A2E]">{patient.name}</span>
        <span className="text-[12px] text-[#666]">
          {formatDob(patient.dob)} ({patient.age}y) &middot; {sexDisplay}
        </span>
        <span className="text-[11px] font-mono text-[#666]">
          ***{(patient.ssn || patient.govId || '').slice(-4)}
        </span>
        {isVA && patient.serviceConnected && (
          <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
            SC {patient.scPercent || 0}%
          </span>
        )}
        {allergyChips.length > 0 && (
          <div className="flex gap-1">
            {allergyChips.slice(0, 3).map((a, i) => (
              <span key={i} className="bg-red-100 text-red-800 text-[10px] font-medium px-1.5 py-0.5 rounded">
                {a}
              </span>
            ))}
            {allergyChips.length > 3 && (
              <span className="text-red-600 text-[10px] font-medium">+{allergyChips.length - 3}</span>
            )}
          </div>
        )}
        {allergyChips.length === 0 && hasAllergyAssessment && (
          <span className="bg-green-50 text-green-700 text-[10px] font-medium px-1.5 py-0.5 rounded">NKA</span>
        )}
        {patient.codeStatus && (
          <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded">{patient.codeStatus}</span>
        )}
        {allWarningFlags.length > 0 && (
          <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
            <span className="material-symbols-outlined text-[12px]">warning</span>
            {allWarningFlags.length}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-20">
      {patient.isRestricted && (
        <div className="bg-red-600 text-white text-center text-[11px] font-bold py-1">
          <span className="material-symbols-outlined text-[14px] align-middle mr-1">lock</span>
          Record Restriction Active — Access is logged and monitored
        </div>
      )}
      <div className="bg-white border-b border-[#E2E4E8] px-5 py-3 flex items-start justify-between shadow-sm" style={{ minHeight: '80px' }}>
        <div className="flex items-start gap-5">
          <div className="w-14 h-14 rounded-full bg-[#2E5984] flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
            {patient.name?.charAt(0) || '?'}
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h2 className="text-[20px] font-bold text-[#1A1A2E] leading-tight">{patient.name}</h2>
              {patient.status === 'deceased' && (
                <span className="bg-gray-700 text-white text-[10px] font-bold px-2 py-0.5 rounded">DECEASED</span>
              )}
              {patient.status === 'inactive' && (
                <span className="bg-gray-400 text-white text-[10px] font-bold px-2 py-0.5 rounded">INACTIVE</span>
              )}
              {isVA && patient.serviceConnected && (
                <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">
                  SC {patient.scPercent || 0}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[13px] text-[#555] flex-wrap">
              <span>{formatDob(patient.dob)} ({patient.age} years)</span>
              <span className="text-[#ccc]">|</span>
              <span>{sexDisplay}</span>
              <span className="text-[#ccc]">|</span>
              <span className="font-mono text-[12px]">***{(patient.ssn || patient.govId || '').slice(-4)}</span>
              {isVA && patient.veteranStatus && (
                <>
                  <span className="text-[#ccc]">|</span>
                  <span className="text-[#2E5984] font-medium">Veteran</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              {allergyChips.length === 0 && hasAllergyAssessment && (
                <span className="bg-green-50 text-green-700 text-[11px] font-medium px-2 py-0.5 rounded">No Known Allergies</span>
              )}
              {allergyChips.length === 0 && !hasAllergyAssessment && (
                <span className="bg-amber-50 text-amber-700 text-[11px] font-medium px-2 py-0.5 rounded flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">warning</span>
                  No allergy assessment on file
                </span>
              )}
              {allergyChips.map((a, i) => (
                <span key={i} className="bg-red-100 text-red-800 text-[11px] font-medium px-2 py-0.5 rounded">
                  {a}
                </span>
              ))}
              {allWarningFlags.map((f, i) => (
                <span key={`f-${i}`} className="bg-orange-100 text-orange-800 text-[11px] font-medium px-2 py-0.5 rounded flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">warning</span>
                  {f.name}
                </span>
              ))}
              {patient.codeStatus && (
                <span className="bg-purple-100 text-purple-800 text-[11px] font-bold px-2 py-0.5 rounded">{patient.codeStatus}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 text-[12px] text-[#666] flex-shrink-0">
          {patient.location && (
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">location_on</span>
              {patient.location}
            </span>
          )}
          {patient.primaryCareProvider && (
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">stethoscope</span>
              {patient.primaryCareProvider}
            </span>
          )}
          {patient.phone && (
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">phone</span>
              {patient.phone}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
