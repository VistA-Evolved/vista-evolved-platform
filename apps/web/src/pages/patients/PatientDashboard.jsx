import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';
import PatientBanner from '../../components/shared/PatientBanner';
import { usePatient } from '../../components/shared/PatientContext';
import { getPatient } from '../../services/patientService';

/* ═══════════════════════════════════════════════════════════════════════════
 *  CWAD (Crisis / Warnings / Allergies / Advance Directives) helpers
 * ═══════════════════════════════════════════════════════════════════════════ */

const CWAD_CONFIG = {
  crisis:    { label: 'Crisis',              icon: 'crisis_alert',     bg: 'bg-red-600',    text: 'text-white',       ring: 'ring-red-600'    },
  warnings:  { label: 'Warnings',            icon: 'warning',          bg: 'bg-orange-500',  text: 'text-white',       ring: 'ring-orange-500' },
  allergies: { label: 'Allergies',           icon: 'coronavirus',      bg: 'bg-amber-500',   text: 'text-white',       ring: 'ring-amber-500'  },
  directives:{ label: 'Advance Directives',  icon: 'assignment_late',  bg: 'bg-blue-600',    text: 'text-white',       ring: 'ring-blue-600'   },
};

function buildCwad(patient) {
  const flags = patient.flags || [];
  const allergies = patient.allergies || [];

  const crisisFlags = flags.filter(f =>
    f.category === 'Behavioral' &&
    /violen|suicid|crisis|homicid/i.test(f.name)
  );
  const warningFlags = flags.filter(f =>
    !crisisFlags.includes(f) &&
    (f.category === 'Behavioral' || f.category === 'Clinical')
  );

  const cwad = {};
  if (crisisFlags.length > 0)  cwad.crisis    = { count: crisisFlags.length,  items: crisisFlags.map(f => f.name)  };
  if (warningFlags.length > 0) cwad.warnings  = { count: warningFlags.length, items: warningFlags.map(f => f.name) };
  if (allergies.length > 0)    cwad.allergies  = { count: allergies.length,    items: allergies                     };
  if (patient.codeStatus)      cwad.directives = { count: 1,                  items: [patient.codeStatus]          };

  return cwad;
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Vitals — Placeholder fields for when VistA vitals endpoint is available
 * ═══════════════════════════════════════════════════════════════════════════ */

const VITAL_FIELDS = [
  { name: 'Temperature',    abbr: 'T',   icon: 'thermostat' },
  { name: 'Pulse',          abbr: 'P',   icon: 'cardiology' },
  { name: 'Respiration',    abbr: 'R',   icon: 'pulmonology' },
  { name: 'Blood Pressure', abbr: 'BP',  icon: 'bloodtype' },
  { name: 'Pain',           abbr: 'PN',  icon: 'sentiment_stressed' },
  { name: 'Weight',         abbr: 'WT',  icon: 'monitor_weight' },
  { name: 'Height',         abbr: 'HT',  icon: 'height' },
  { name: 'SpO2',           abbr: 'O2',  icon: 'spo2' },
];

/* ═══════════════════════════════════════════════════════════════════════════
 *  Shared sub-components
 * ═══════════════════════════════════════════════════════════════════════════ */

function SkeletonCard({ className = '', lines = 4 }) {
  return (
    <div className={`bg-white border border-[#E2E4E8] rounded-md overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E2E4E8] bg-[#FAFBFC]">
        <div className="animate-pulse bg-[#E2E4E8] rounded h-4 w-32" />
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="animate-pulse bg-[#E2E4E8] rounded h-3.5" style={{ width: `${70 + (i * 7) % 30}%` }} />
        ))}
      </div>
    </div>
  );
}

function Panel({ title, icon, action, children, className = '', priority }) {
  const ringClass = priority === 'danger'  ? 'border-red-300' :
                    priority === 'warning' ? 'border-orange-300' : 'border-[#E2E4E8]';
  return (
    <div className={`bg-white border ${ringClass} rounded-md overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E2E4E8] bg-[#FAFBFC]">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-[#2E5984]">{icon}</span>
          <h3 className="text-[13px] font-semibold text-[#1A1A2E]">{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-4 text-[13px] text-[#555]">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-[#F0F0F0] last:border-0">
      <span className="text-[#888]">{label}</span>
      <span className={`text-[#333] font-medium text-right ${mono ? 'font-mono text-[12px]' : ''}`}>
        {value || '—'}
      </span>
    </div>
  );
}

function EmptyState({ icon, text, subtext }) {
  return (
    <div className="flex flex-col items-center justify-center py-4 gap-1">
      <span className="material-symbols-outlined text-[24px] text-[#CCC]">{icon}</span>
      <p className="text-[#999] text-[13px]">{text}</p>
      {subtext && <p className="text-[#BBB] text-[11px]">{subtext}</p>}
    </div>
  );
}

function StatusChip({ label, color = 'gray' }) {
  const colors = {
    green:  'bg-green-100 text-green-800',
    red:    'bg-red-100 text-red-800',
    blue:   'bg-blue-100 text-blue-800',
    orange: 'bg-orange-100 text-orange-800',
    amber:  'bg-amber-100 text-amber-800',
    purple: 'bg-purple-100 text-purple-800',
    gray:   'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${colors[color] || colors.gray}`}>
      {label}
    </span>
  );
}

function LinkButton({ onClick, children }) {
  return (
    <button onClick={onClick} className="text-[11px] text-[#2E5984] hover:underline font-medium">
      {children}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Panel 1 — Postings / Warnings (CWAD)
 * ═══════════════════════════════════════════════════════════════════════════ */

function PostingsPanel({ cwad, onNavigateFlags }) {
  const keys = Object.keys(cwad);
  if (keys.length === 0) {
    return (
      <Panel title="Postings / Warnings (CWAD)" icon="flag_circle" className="col-span-full">
        <div className="flex items-center gap-2 text-green-700 py-1">
          <span className="material-symbols-outlined text-[18px]">verified</span>
          <span className="font-medium">No active postings or warnings</span>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Postings / Warnings (CWAD)"
      icon="flag_circle"
      className="col-span-full"
      priority={cwad.crisis ? 'danger' : 'warning'}
      action={<LinkButton onClick={onNavigateFlags}>View All Flags</LinkButton>}
    >
      <div className="flex flex-wrap gap-2">
        {keys.map(key => {
          const cfg = CWAD_CONFIG[key];
          const entry = cwad[key];
          return (
            <button
              key={key}
              onClick={onNavigateFlags}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${cfg.bg} ${cfg.text} text-[12px] font-semibold hover:opacity-90 transition-opacity cursor-pointer`}
            >
              <span className="material-symbols-outlined text-[16px]">{cfg.icon}</span>
              {cfg.label}
              <span className={`${cfg.bg} ${cfg.text} border border-white/30 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold`}>
                {entry.count}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {keys.map(key => {
          const cfg = CWAD_CONFIG[key];
          return cwad[key].items.map((item, i) => (
            <span
              key={`${key}-${i}`}
              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded ring-1 ${cfg.ring} ${cfg.bg.replace('bg-', 'bg-').replace('600', '50').replace('500', '50')} ${cfg.ring.replace('ring-', 'text-')}`}
              style={{ backgroundColor: `${key === 'crisis' ? '#FEF2F2' : key === 'warnings' ? '#FFF7ED' : key === 'allergies' ? '#FFFBEB' : '#EFF6FF'}` }}
            >
              <span className="material-symbols-outlined text-[12px]">{cfg.icon}</span>
              {item}
            </span>
          ));
        })}
      </div>
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Panel 2 — Demographics Summary
 * ═══════════════════════════════════════════════════════════════════════════ */

function DemographicsPanel({ patient, onEdit }) {
  const p = patient;
  const gender = p.sex === 'M' ? 'Male' : p.sex === 'F' ? 'Female' : (p.gender === 'M' ? 'Male' : p.gender === 'F' ? 'Female' : p.genderIdentity || p.gender || p.sex || '—');
  const address = p.fullAddress || [p.streetAddress1, p.streetAddress2, p.city, p.state, p.zip].filter(Boolean).join(', ') || p.address || '—';
  const ssnDisplay = p.ssnMasked || (p.ssn ? `***-**-${p.ssn.slice(-4)}` : (p.govId ? `••••${p.govId.slice(-4)}` : '—'));
  const ec = p.emergencyContact;
  const ecDisplay = ec?.name ? `${ec.name} (${ec.relationship})${ec.phone ? ' — ' + ec.phone : ''}` : '—';

  return (
    <Panel
      title="Demographics"
      icon="person"
      action={<LinkButton onClick={onEdit}>Edit</LinkButton>}
    >
      <InfoRow label="Full Name" value={p.name} />
      <InfoRow label="Date of Birth" value={`${p.dobFormatted || p.dob} (${p.age} years)`} />
      <InfoRow label="Sex" value={gender} />
      <InfoRow label="SSN" value={ssnDisplay} mono />
      <InfoRow label="Address" value={address} />
      <InfoRow label="Phone" value={p.phone} />
      <InfoRow label="Email" value={p.email} />
      <InfoRow label="Emergency Contact" value={ecDisplay} />
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Panel 3 — Allergies
 * ═══════════════════════════════════════════════════════════════════════════ */

function AllergiesPanel({ patient }) {
  const allergies = patient.allergies || [];
  const hasNka = patient.nka === true || allergies.some(a =>
    /^(NKA|NKDA|NO KNOWN ALLERGIES|NO KNOWN DRUG ALLERGIES)$/i.test(a)
  );
  const displayAllergies = allergies.filter(a =>
    !/^(NKA|NKDA|NO KNOWN ALLERGIES|NO KNOWN DRUG ALLERGIES)$/i.test(a)
  );

  let content;
  if (hasNka && displayAllergies.length === 0) {
    content = (
      <div className="flex items-center gap-2 py-2">
        <span className="material-symbols-outlined text-[18px] text-green-600">check_circle</span>
        <span className="bg-green-100 text-green-800 text-[12px] font-semibold px-3 py-1 rounded">
          No Known Allergies (NKA)
        </span>
      </div>
    );
  } else if (displayAllergies.length > 0) {
    content = (
      <div className="flex flex-wrap gap-2">
        {displayAllergies.map((a, i) => (
          <span key={i} className="bg-red-100 text-red-800 text-[12px] font-medium px-3 py-1 rounded flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">warning</span>
            {a}
          </span>
        ))}
      </div>
    );
  } else {
    content = (
      <div className="flex items-center gap-2 py-2 text-amber-700 bg-amber-50 px-3 rounded">
        <span className="material-symbols-outlined text-[18px]">help</span>
        <span className="text-[12px] font-medium">No allergy assessment on file</span>
      </div>
    );
  }

  return (
    <Panel title="Allergies" icon="coronavirus" priority={displayAllergies.length > 0 ? 'danger' : undefined}>
      {content}
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Panel 4 — Active Problems
 * ═══════════════════════════════════════════════════════════════════════════ */

function ProblemsPanel({ patient }) {
  const problems = (patient.problems || []).filter(p => p.status === 'active');

  if (problems.length === 0) {
    return (
      <Panel title="Active Problems" icon="vital_signs">
        <EmptyState icon="check_circle" text="No active problems" />
      </Panel>
    );
  }

  return (
    <Panel title="Active Problems" icon="vital_signs">
      <div className="space-y-0">
        {problems.map((prob, i) => (
          <div key={i} className="flex items-start justify-between py-2 border-b border-[#F0F0F0] last:border-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {prob.scCondition && (
                  <span className="flex-shrink-0 w-2 h-2 rounded-full bg-purple-500" title="Service-Connected" />
                )}
                <p className="text-[#333] font-medium truncate">{prob.name}</p>
              </div>
              <p className="text-[11px] text-[#999] mt-0.5">
                ICD: {prob.icd}
                {prob.onset && <> &middot; Onset: {new Date(prob.onset + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</>}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              {prob.scCondition && <StatusChip label="SC" color="purple" />}
              <StatusChip label="Active" color="green" />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Panel 5 — Active Medications (grouped by type)
 * ═══════════════════════════════════════════════════════════════════════════ */

function MedicationsPanel({ patient }) {
  const meds = (patient.medications || []).filter(m => m.status === 'active');

  if (meds.length === 0) {
    return (
      <Panel title="Active Medications" icon="medication">
        <EmptyState icon="medication" text="No active medications" />
      </Panel>
    );
  }

  const groups = { Outpatient: [], Inpatient: [], 'Non-VA': [] };
  meds.forEach(m => {
    const group = m.group || (m.sig?.includes('IV') || m.sig?.includes('INFUSE') ? 'Inpatient' : 'Outpatient');
    if (!groups[group]) groups[group] = [];
    groups[group].push(m);
  });

  const nonEmpty = Object.entries(groups).filter(([, list]) => list.length > 0);

  return (
    <Panel title="Active Medications" icon="medication">
      <div className="space-y-3">
        {nonEmpty.map(([groupName, list]) => (
          <div key={groupName}>
            {nonEmpty.length > 1 && (
              <p className="text-[10px] font-bold text-[#2E5984] uppercase tracking-wider mb-1.5">{groupName}</p>
            )}
            {list.map((med, i) => (
              <div key={i} className="flex items-start justify-between py-1.5 border-b border-[#F0F0F0] last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-[#333] font-medium truncate">{med.name}</p>
                  <p className="text-[11px] text-[#999] mt-0.5">{med.sig}</p>
                  {med.prescriber && <p className="text-[11px] text-[#BBB]">Rx: {med.prescriber}</p>}
                </div>
                <StatusChip label="Active" color="blue" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Panel 6 — Recent Vitals
 * ═══════════════════════════════════════════════════════════════════════════ */

function VitalsPanel({ patient }) {
  return (
    <Panel title="Recent Vitals" icon="ecg_heart">
      <div className="mb-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-md">
        <div className="flex items-center gap-2 text-amber-800">
          <span className="material-symbols-outlined text-[16px]">info</span>
          <span className="text-[12px] font-medium">
            Vitals are not yet connected to VistA. Requires GMV LATEST VM RPC endpoint.
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0">
        {VITAL_FIELDS.map((v, i) => (
          <div key={i} className="flex items-center gap-2 py-1.5 border-b border-[#F0F0F0]">
            <span className="material-symbols-outlined text-[16px] text-[#CCC]">{v.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-[#888]">{v.name}</span>
                <span className="text-[12px] text-[#CCC] italic">—</span>
              </div>
              <p className="text-[10px] text-[#DDD]">No data</p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Panel 7 — Upcoming Appointments
 * ═══════════════════════════════════════════════════════════════════════════ */

function AppointmentsPanel({ patient, onSchedule }) {
  const appts = (patient.appointments || []).slice(0, 5);

  return (
    <Panel
      title="Upcoming Appointments"
      icon="calendar_month"
      action={<LinkButton onClick={onSchedule}>Schedule</LinkButton>}
    >
      {appts.length === 0 ? (
        <EmptyState icon="event_busy" text="No upcoming appointments" />
      ) : (
        <div className="space-y-0">
          {appts.map((a, i) => (
            <div key={i} className="flex items-start gap-3 py-2 border-b border-[#F0F0F0] last:border-0">
              <div className="w-9 h-9 rounded bg-[#E8EEF5] flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-[16px] text-[#2E5984]">event</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[#333] font-medium">{a.clinic}</p>
                <p className="text-[11px] text-[#888]">
                  {new Date(a.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  {a.time && ` at ${a.time}`}
                </p>
                {a.provider && <p className="text-[11px] text-[#AAA]">{a.provider}</p>}
              </div>
              <StatusChip
                label={a.status ? a.status.charAt(0).toUpperCase() + a.status.slice(1) : 'Pending'}
                color={a.status === 'scheduled' ? 'blue' : a.status === 'checked-in' ? 'green' : 'gray'}
              />
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Panel 8 — Recent Visits
 * ═══════════════════════════════════════════════════════════════════════════ */

function VisitsPanel({ patient }) {
  const visits = (patient.recentVisits || []).slice(0, 5);

  return (
    <Panel title="Recent Visits" icon="history">
      {visits.length === 0 ? (
        <EmptyState icon="event_available" text="No recent visits" />
      ) : (
        <div className="space-y-0">
          {visits.map((v, i) => (
            <div key={i} className="flex items-start gap-3 py-2 border-b border-[#F0F0F0] last:border-0">
              <div className="w-9 h-9 rounded bg-[#F0F4F8] flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-[16px] text-[#666]">clinical_notes</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[#333] font-medium">{v.clinic}</p>
                <p className="text-[11px] text-[#888]">
                  {new Date(v.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {v.type && <> &middot; {v.type}</>}
                </p>
                {v.provider && <p className="text-[11px] text-[#AAA]">{v.provider}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Panel 9 — Quick Actions
 * ═══════════════════════════════════════════════════════════════════════════ */

function QuickActionsPanel({ patientId, isDeceased, navigate }) {
  const actions = [
    { label: 'Edit Demographics',     icon: 'edit',                path: `/patients/${patientId}/edit`,         write: true  },
    { label: 'Insurance & Coverage',  icon: 'health_and_safety',   path: `/patients/${patientId}/insurance`,    write: false },
    { label: 'Financial Assessment',  icon: 'account_balance',     path: `/patients/${patientId}/assessment`,   write: false },
    { label: 'Admission',            icon: 'login',               path: `/patients/${patientId}/admit`,        write: true  },
    { label: 'Transfer',             icon: 'swap_horiz',          path: `/patients/${patientId}/transfer`,     write: true  },
    { label: 'Discharge',            icon: 'logout',              path: `/patients/${patientId}/discharge`,    write: true  },
    { label: 'Patient Flags',        icon: 'outlined_flag',       path: `/patients/${patientId}/flags`,        write: false },
    { label: 'Record Restrictions',  icon: 'shield',              path: `/patients/${patientId}/restrictions`, write: false },
  ];

  return (
    <Panel title="Quick Actions" icon="bolt" className="col-span-full">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {actions.map(a => {
          const disabled = isDeceased && a.write;
          return (
            <button
              key={a.label}
              onClick={() => !disabled && navigate(a.path)}
              disabled={disabled}
              className={`flex items-center gap-2 px-3 py-2.5 border rounded-md text-[12px] text-left transition-colors
                ${disabled
                  ? 'border-[#E2E4E8] text-[#CCC] cursor-not-allowed bg-[#FAFAFA]'
                  : 'border-[#E2E4E8] text-[#555] hover:bg-[#F0F4F8] hover:text-[#1A1A2E] hover:border-[#2E5984]/30 cursor-pointer'
                }`}
            >
              <span className={`material-symbols-outlined text-[16px] ${disabled ? 'text-[#DDD]' : 'text-[#999]'}`}>{a.icon}</span>
              {a.label}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Loading State — Skeleton dashboard
 * ═══════════════════════════════════════════════════════════════════════════ */

function LoadingSkeleton() {
  return (
    <div className="px-6 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="animate-pulse bg-[#E2E4E8] rounded h-8 w-64" />
        <div className="flex gap-2">
          <div className="animate-pulse bg-[#E2E4E8] rounded h-10 w-40" />
          <div className="animate-pulse bg-[#E2E4E8] rounded h-10 w-36" />
        </div>
      </div>
      {/* Banner skeleton */}
      <div className="animate-pulse bg-[#E2E4E8] rounded h-20 w-full" />
      {/* CWAD skeleton */}
      <div className="animate-pulse bg-[#E2E4E8] rounded h-16 w-full" />
      {/* Grid skeleton */}
      <div className="grid grid-cols-2 gap-4">
        <SkeletonCard lines={7} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={5} />
        <SkeletonCard lines={5} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={3} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Main Component — PatientDashboard (Chart Overview / Cover Sheet)
 * ═══════════════════════════════════════════════════════════════════════════ */

export default function PatientDashboard() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { setPatient } = usePatient();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getPatient(patientId);
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error || 'Patient not found');
          return;
        }
        setData(res.data);
        setPatient(res.data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [patientId, setPatient]);

  /* ── Loading ── */
  if (loading) {
    return (
      <AppShell breadcrumb="Patients › Loading...">
        <LoadingSkeleton />
      </AppShell>
    );
  }

  /* ── Error ── */
  if (error || !data) {
    return (
      <AppShell breadcrumb="Patients › Error">
        <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
          <span className="material-symbols-outlined text-[48px] text-red-400">error</span>
          <p className="text-[15px] text-[#666]">{error || 'Patient not found'}</p>
          <button
            onClick={() => navigate('/patients')}
            className="text-sm text-[#2E5984] hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Patient Search
          </button>
        </div>
      </AppShell>
    );
  }

  const p = data;
  const isDeceased = p.status === 'deceased' || !!p.dateOfDeath;
  const cwad = buildCwad(p);
  const hasCwad = Object.keys(cwad).length > 0;

  return (
    <AppShell breadcrumb={`Patients › ${p.name}`}>
      <PatientBanner />

      {/* Deceased banner */}
      {isDeceased && (
        <div className="bg-gray-800 text-white text-center py-2 text-[13px] font-semibold flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-[18px]">skull</span>
          Patient Deceased
          {p.dateOfDeath && (
            <span className="text-gray-300 font-normal">
              — {new Date(p.dateOfDeath + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          )}
          <span className="text-gray-400 text-[11px] font-normal ml-2">Write actions disabled</span>
        </div>
      )}

      <div className="px-6 py-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-[24px] font-bold text-[#1A1A2E]">Chart Overview</h1>
            <p className="text-[13px] text-[#888]">
              Cover sheet for {p.name}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/scheduling')}
              className="flex items-center gap-2 px-4 py-2 border border-[#E2E4E8] text-sm font-medium rounded-md hover:bg-[#F0F4F8] transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">calendar_month</span>
              Schedule Appointment
            </button>
            <button
              onClick={() => navigate(`/patients/${patientId}/edit`)}
              className="flex items-center gap-2 px-4 py-2 border border-[#E2E4E8] text-sm font-medium rounded-md hover:bg-[#F0F4F8] transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
              Edit Demographics
            </button>
            <button
              onClick={() => !isDeceased && navigate(`/patients/${patientId}/admit`)}
              disabled={isDeceased}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors
                ${isDeceased
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-[#1A1A2E] text-white hover:bg-[#2E5984]'
                }`}
            >
              <span className="material-symbols-outlined text-[16px]">login</span>
              Admit Patient
            </button>
          </div>
        </div>

        {/* Flag strip for patients with flags */}
        {hasCwad && !isDeceased && (
          <div className={`mb-4 px-4 py-2 rounded-md flex items-center gap-3 ${cwad.crisis ? 'bg-red-50 border border-red-200' : 'bg-orange-50 border border-orange-200'}`}>
            <span className={`material-symbols-outlined text-[20px] ${cwad.crisis ? 'text-red-600' : 'text-orange-500'}`}>
              {cwad.crisis ? 'crisis_alert' : 'warning'}
            </span>
            <span className={`text-[13px] font-semibold ${cwad.crisis ? 'text-red-800' : 'text-orange-800'}`}>
              This patient has active postings that require attention
            </span>
            <button
              onClick={() => navigate(`/patients/${patientId}/flags`)}
              className={`ml-auto text-[12px] font-medium underline ${cwad.crisis ? 'text-red-700' : 'text-orange-700'}`}
            >
              Review Flags
            </button>
          </div>
        )}

        {/* Panel grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Panel 1 — Postings / CWAD (full width) */}
          <PostingsPanel cwad={cwad} onNavigateFlags={() => navigate(`/patients/${patientId}/flags`)} />

          {/* Panel 2 — Demographics */}
          <DemographicsPanel patient={p} onEdit={() => navigate(`/patients/${patientId}/edit`)} />

          {/* Panel 3 — Allergies */}
          <AllergiesPanel patient={p} />

          {/* Panel 4 — Active Problems */}
          <ProblemsPanel patient={p} />

          {/* Panel 5 — Active Medications */}
          <MedicationsPanel patient={p} />

          {/* Panel 6 — Recent Vitals */}
          <VitalsPanel patient={p} />

          {/* Panel 7 — Upcoming Appointments */}
          <AppointmentsPanel patient={p} onSchedule={() => navigate('/scheduling')} />

          {/* Panel 8 — Recent Visits */}
          <VisitsPanel patient={p} />

          {/* Panel 9 — Quick Actions (full width) */}
          <QuickActionsPanel
            patientId={patientId}
            isDeceased={isDeceased}
            navigate={navigate}
          />
        </div>
      </div>
    </AppShell>
  );
}
