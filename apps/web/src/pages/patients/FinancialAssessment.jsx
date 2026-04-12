import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';
import PatientBanner from '../../components/shared/PatientBanner';
import { usePatient } from '../../components/shared/PatientContext';
import { getPatient, getFinancialAssessment, submitFinancialAssessment } from '../../services/patientService';

const inputCls = 'h-10 px-3 border border-[#E2E4E8] rounded-md text-sm text-[#333] focus:outline-none focus:border-[#2E5984] focus:ring-1 focus:ring-[#2E5984]';
const labelCls = 'block text-[12px] font-medium text-[#555] mb-1';
const sectionCls = 'border border-[#E2E4E8] rounded-md p-4 mb-4';

const GMT_THRESHOLD = 36_612;
const VA_NATIONAL_THRESHOLD = 37_261;

function parseCurrency(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  return Number(String(val).replace(/[^0-9.-]/g, '')) || 0;
}

function formatCurrency(n) {
  if (n == null || n === '') return '';
  const num = typeof n === 'number' ? n : parseCurrency(n);
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function displayCurrency(n) {
  if (n == null) return '—';
  const num = typeof n === 'number' ? n : parseCurrency(n);
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function categoryColor(cat) {
  if (!cat) return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' };
  const c = cat.toLowerCase();
  if (c.includes('exempt') || c.includes('cat a') || c === 'a' || c.includes('category a'))
    return { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-300', badge: 'bg-green-100 text-green-800' };
  if (c.includes('cat b') || c === 'b' || c.includes('category b'))
    return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300', badge: 'bg-amber-100 text-amber-800' };
  if (c.includes('cat c') || c === 'c' || c.includes('category c'))
    return { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-300', badge: 'bg-red-100 text-red-800' };
  return { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-300', badge: 'bg-blue-100 text-blue-800' };
}

function copayBadge(cat, exempt) {
  if (exempt) return { label: 'Exempt', cls: 'bg-green-100 text-green-800 border border-green-300' };
  const c = (cat || '').toLowerCase();
  if (c.includes('a')) return { label: 'Cat A — No Copay', cls: 'bg-blue-100 text-blue-800 border border-blue-300' };
  if (c.includes('b')) return { label: 'Cat B — Reduced Copay', cls: 'bg-amber-100 text-amber-800 border border-amber-300' };
  if (c.includes('c')) return { label: 'Cat C — Full Copay', cls: 'bg-red-100 text-red-800 border border-red-300' };
  return { label: cat || '—', cls: 'bg-gray-100 text-gray-700 border border-gray-300' };
}

function calculateCategory(totalIncome, threshold) {
  if (totalIncome < threshold) return { category: 'Category A', exempt: true, label: 'Cat A — No Copay' };
  if (totalIncome < threshold * 2) return { category: 'Category B', exempt: false, label: 'Cat B — Reduced Copay' };
  return { category: 'Category C', exempt: false, label: 'Cat C — Full Copay' };
}

const INITIAL_FORM = {
  vetGrossWages: '',
  vetFarmIncome: '',
  vetOtherIncome: '',
  spouseGrossWages: '',
  spouseFarmIncome: '',
  spouseOtherIncome: '',
  numDependents: '',
  dependentIncome: '',
  assets: '',
  medicalExpenses: '',
};

function CurrencyInput({ value, onChange, placeholder, disabled, id }) {
  const [focused, setFocused] = useState(false);

  const handleChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    onChange(raw);
  };

  const display = focused ? value : (value ? formatCurrency(value) : '');

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888] text-sm select-none">$</span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        disabled={disabled}
        className={`${inputCls} w-full pl-7 ${disabled ? 'bg-[#F5F5F5] text-[#888]' : ''}`}
      />
    </div>
  );
}

export default function FinancialAssessment() {
  const { patientId } = useParams();
  const { patient, setPatient, hasPatient } = usePatient();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (!hasPatient) {
          const pRes = await getPatient(patientId);
          if (pRes.ok && !cancelled) setPatient(pRes.data);
        }
        const res = await getFinancialAssessment(patientId);
        if (!cancelled) setData(res.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [patientId, hasPatient, setPatient]);

  const isMarried = useMemo(() => {
    const ms = (patient?.raw?.maritalStatus || '').toLowerCase();
    return ms === 'married';
  }, [patient]);

  const updateField = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const vetTotal = useMemo(() =>
    parseCurrency(form.vetGrossWages) + parseCurrency(form.vetFarmIncome) + parseCurrency(form.vetOtherIncome),
    [form.vetGrossWages, form.vetFarmIncome, form.vetOtherIncome]
  );

  const spouseTotal = useMemo(() =>
    isMarried
      ? parseCurrency(form.spouseGrossWages) + parseCurrency(form.spouseFarmIncome) + parseCurrency(form.spouseOtherIncome)
      : 0,
    [isMarried, form.spouseGrossWages, form.spouseFarmIncome, form.spouseOtherIncome]
  );

  const depIncome = parseCurrency(form.dependentIncome);
  const totalAssets = parseCurrency(form.assets);
  const totalMedExpenses = parseCurrency(form.medicalExpenses);
  const grossIncome = vetTotal + spouseTotal + depIncome;
  const adjustedIncome = Math.max(0, grossIncome - totalMedExpenses);

  const calcResult = useMemo(() => calculateCategory(adjustedIncome, GMT_THRESHOLD), [adjustedIncome]);

  const incomeBarPct = useMemo(() => {
    const max = GMT_THRESHOLD * 2.5;
    return Math.min(100, Math.round((adjustedIncome / max) * 100));
  }, [adjustedIncome]);

  const hasFormData = vetTotal > 0 || spouseTotal > 0 || depIncome > 0;

  const handleSubmit = async () => {
    if (!hasFormData) return;
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      const payload = {
        annualIncome: adjustedIncome,
        grossIncome,
        veteranIncome: vetTotal,
        spouseIncome: spouseTotal,
        dependentIncome: depIncome,
        numDependents: parseInt(form.numDependents, 10) || 0,
        netWorth: totalAssets,
        medicalExpenses: totalMedExpenses,
        category: calcResult.category,
        copayExempt: calcResult.exempt,
      };
      const res = await submitFinancialAssessment(patientId, payload);
      if (res.ok) {
        setSubmitMsg({ type: 'success', text: `Assessment submitted — ${calcResult.category}` });
        const refresh = await getFinancialAssessment(patientId);
        if (refresh.data) setData(refresh.data);
        setTimeout(() => {
          setShowForm(false);
          setForm(INITIAL_FORM);
          setSubmitMsg(null);
        }, 2000);
      } else {
        setSubmitMsg({ type: 'error', text: 'Submission failed. Please try again.' });
      }
    } catch (err) {
      setSubmitMsg({ type: 'error', text: 'Submission failed. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setForm(INITIAL_FORM);
    setSubmitMsg(null);
  };

  const current = data?.currentAssessment;
  const history = data?.history || [];
  const badge = current ? copayBadge(current.category, current.copayExempt) : null;

  return (
    <AppShell breadcrumb="Patients › Financial Assessment">
      <PatientBanner />
      <div className="px-6 py-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-[28px] font-bold text-[#1A1A2E]">Financial Screening / Copay Assessment</h1>
            <p className="text-[13px] text-[#666] mt-0.5">Annual Financial Screening &amp; Copay Assessment</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-[#E2E4E8] rounded-md hover:bg-[#F0F4F8] transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              Print Assessment
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-4 py-2 bg-[#1A1A2E] text-white text-sm font-medium rounded-md hover:bg-[#2E5984] transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">{showForm ? 'close' : 'add'}</span>
              {showForm ? 'Close Form' : 'Start New Assessment'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="material-symbols-outlined animate-spin text-[28px] text-[#999]">progress_activity</span>
          </div>
        ) : (
          <div className="space-y-5">
            {/* ── Current Assessment KPI Cards ── */}
            {current && (
              <div className="border border-[#2E5984] rounded-md overflow-hidden">
                <div className="px-4 py-3 bg-[#E8EEF5] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-[#2E5984]">account_balance</span>
                    <h3 className="text-[14px] font-semibold text-[#1A1A2E]">Current Assessment</h3>
                  </div>
                  {badge && (
                    <span className={`text-[12px] font-semibold px-3 py-1 rounded-full ${badge.cls}`}>
                      {badge.label}
                    </span>
                  )}
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-4 gap-4">
                    {/* Copay Category */}
                    <div className={`rounded-md p-4 text-center border ${categoryColor(current.category).border} ${categoryColor(current.category).bg}`}>
                      <p className="text-[11px] text-[#888] uppercase tracking-wide mb-1">Copay Category</p>
                      <p className={`text-[20px] font-bold ${categoryColor(current.category).text}`}>{current.category}</p>
                      <p className={`text-[11px] mt-1 ${current.copayExempt ? 'text-green-600' : 'text-[#888]'}`}>
                        {current.copayExempt ? 'Copay Exempt' : 'Copay Required'}
                      </p>
                    </div>
                    {/* Assessment Date */}
                    <div className="bg-[#FAFBFC] border border-[#E2E4E8] rounded-md p-4 text-center">
                      <p className="text-[11px] text-[#888] uppercase tracking-wide mb-1">Assessment Date</p>
                      <p className="text-[16px] font-bold text-[#1A1A2E]">{formatDate(current.date)}</p>
                      <p className="text-[11px] text-[#888] mt-1">by {current.assessor || '—'}</p>
                      {(() => {
                        const assessDate = new Date(current.date);
                        const oneYearAgo = new Date();
                        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                        if (assessDate < oneYearAgo) {
                          return <p className="text-[11px] font-semibold text-[#CC3333] mt-2 flex items-center justify-center gap-1"><span className="material-symbols-outlined text-[14px]">warning</span>Annual update overdue</p>;
                        }
                        return null;
                      })()}
                    </div>
                    {/* Annual Income */}
                    <div className="bg-[#FAFBFC] border border-[#E2E4E8] rounded-md p-4 text-center">
                      <p className="text-[11px] text-[#888] uppercase tracking-wide mb-1">Annual Income</p>
                      <p className="text-[20px] font-bold text-[#1A1A2E]">{displayCurrency(current.annualIncome)}</p>
                      <p className="text-[11px] text-[#888] mt-1">Adjusted gross</p>
                    </div>
                    {/* Net Worth */}
                    <div className="bg-[#FAFBFC] border border-[#E2E4E8] rounded-md p-4 text-center">
                      <p className="text-[11px] text-[#888] uppercase tracking-wide mb-1">Net Worth</p>
                      <p className="text-[20px] font-bold text-[#1A1A2E]">{displayCurrency(current.netWorth)}</p>
                      <p className="text-[11px] text-[#888] mt-1">{current.dependents ?? 0} dependent(s)</p>
                    </div>
                  </div>
                  {/* Detail rows */}
                  <div className="grid grid-cols-3 gap-4 mt-4 text-[13px]">
                    <div className="flex justify-between py-2 border-b border-[#F0F0F0]">
                      <span className="text-[#888]">Deductible Expenses</span>
                      <span className="text-[#333] font-medium">{displayCurrency(current.deductibleExpenses)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#F0F0F0]">
                      <span className="text-[#888]">Dependents</span>
                      <span className="text-[#333] font-medium">{current.dependents ?? '—'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#F0F0F0]">
                      <span className="text-[#888]">GMT Threshold</span>
                      <span className="text-[#333] font-medium">{displayCurrency(GMT_THRESHOLD)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Assessment History Table ── */}
            <div className="border border-[#E2E4E8] rounded-md overflow-hidden">
              <div className="px-4 py-3 bg-[#FAFBFC] border-b border-[#E2E4E8] flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-[#1A1A2E]">Assessment History</h3>
                <span className="text-[12px] text-[#888]">{history.length} record(s)</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1A1A2E] text-white text-left text-[12px] uppercase tracking-wide">
                    <th className="px-4 py-3 font-semibold">Assessment Date</th>
                    <th className="px-4 py-3 font-semibold">Income</th>
                    <th className="px-4 py-3 font-semibold">Net Worth</th>
                    <th className="px-4 py-3 font-semibold">Copay Category</th>
                    <th className="px-4 py-3 font-semibold">Assessed By</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-[#999]">No assessment history available</td></tr>
                  ) : history.map((h, i) => {
                    const colors = categoryColor(h.category);
                    return (
                      <tr key={i} className={`border-t border-[#E2E4E8] ${i % 2 === 0 ? 'bg-white' : 'bg-[#FAFBFC]'}`}>
                        <td className="px-4 py-3 font-medium">{formatDate(h.date)}</td>
                        <td className="px-4 py-3">{displayCurrency(h.income ?? h.annualIncome)}</td>
                        <td className="px-4 py-3">{displayCurrency(h.netWorth)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${colors.badge || 'bg-gray-100 text-gray-700'}`}>
                            {h.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#555]">{h.assessor || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                            (h.result || '').includes('Exempt')
                              ? 'bg-green-100 text-green-800'
                              : (h.result || '').includes('Reduced')
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                          }`}>
                            {h.result || (h.copayExempt ? 'Copay Exempt' : 'Copay Required')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── New Assessment Form (Expandable) ── */}
            {showForm && (
              <div className="border-2 border-[#2E5984] rounded-md overflow-hidden">
                <div className="px-5 py-3 bg-[#2E5984] flex items-center gap-2">
                  <span className="material-symbols-outlined text-white text-[18px]">assignment</span>
                  <h3 className="text-[15px] font-semibold text-white">New Financial Assessment — Financial Screening</h3>
                </div>

                <div className="flex">
                  {/* ── Left: Form Sections ── */}
                  <div className="flex-1 p-5 space-y-1 border-r border-[#E2E4E8]">

                    {/* Section 1: Veteran Income */}
                    <div className={sectionCls}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#1A1A2E] text-white text-[11px] font-bold">1</span>
                        <h4 className="text-[13px] font-semibold text-[#1A1A2E]">Veteran Income</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        <div>
                          <label htmlFor="vetGrossWages" className={labelCls}>Gross Wages <span className="text-red-500">*</span></label>
                          <CurrencyInput id="vetGrossWages" value={form.vetGrossWages} onChange={v => updateField('vetGrossWages', v)} placeholder="0" />
                        </div>
                        <div>
                          <label htmlFor="vetFarmIncome" className={labelCls}>Net Income from Farm/Business</label>
                          <CurrencyInput id="vetFarmIncome" value={form.vetFarmIncome} onChange={v => updateField('vetFarmIncome', v)} placeholder="0" />
                        </div>
                        <div>
                          <label htmlFor="vetOtherIncome" className={labelCls}>Other Income</label>
                          <CurrencyInput id="vetOtherIncome" value={form.vetOtherIncome} onChange={v => updateField('vetOtherIncome', v)} placeholder="0" />
                        </div>
                        <div>
                          <label className={labelCls}>Veteran Total</label>
                          <CurrencyInput value={String(vetTotal)} onChange={() => {}} disabled />
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Spouse Income (conditional) */}
                    <div className={`${sectionCls} ${!isMarried ? 'opacity-50' : ''}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#1A1A2E] text-white text-[11px] font-bold">2</span>
                        <h4 className="text-[13px] font-semibold text-[#1A1A2E]">Spouse Income</h4>
                        {!isMarried && (
                          <span className="text-[11px] text-[#888] italic ml-2">Not applicable — patient is not married</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        <div>
                          <label htmlFor="spouseGrossWages" className={labelCls}>Gross Wages</label>
                          <CurrencyInput id="spouseGrossWages" value={form.spouseGrossWages} onChange={v => updateField('spouseGrossWages', v)} placeholder="0" disabled={!isMarried} />
                        </div>
                        <div>
                          <label htmlFor="spouseFarmIncome" className={labelCls}>Net Income from Farm/Business</label>
                          <CurrencyInput id="spouseFarmIncome" value={form.spouseFarmIncome} onChange={v => updateField('spouseFarmIncome', v)} placeholder="0" disabled={!isMarried} />
                        </div>
                        <div>
                          <label htmlFor="spouseOtherIncome" className={labelCls}>Other Income</label>
                          <CurrencyInput id="spouseOtherIncome" value={form.spouseOtherIncome} onChange={v => updateField('spouseOtherIncome', v)} placeholder="0" disabled={!isMarried} />
                        </div>
                        <div>
                          <label className={labelCls}>Spouse Total</label>
                          <CurrencyInput value={String(spouseTotal)} onChange={() => {}} disabled />
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Dependent Information */}
                    <div className={sectionCls}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#1A1A2E] text-white text-[11px] font-bold">3</span>
                        <h4 className="text-[13px] font-semibold text-[#1A1A2E]">Dependent Information</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        <div>
                          <label htmlFor="numDependents" className={labelCls}>Number of Dependents</label>
                          <input
                            id="numDependents"
                            type="number"
                            min="0"
                            value={form.numDependents}
                            onChange={e => updateField('numDependents', e.target.value)}
                            className={`${inputCls} w-full`}
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label htmlFor="dependentIncome" className={labelCls}>Dependent Income</label>
                          <CurrencyInput id="dependentIncome" value={form.dependentIncome} onChange={v => updateField('dependentIncome', v)} placeholder="0" />
                        </div>
                      </div>
                    </div>

                    {/* Section 4: Net Worth */}
                    <div className={sectionCls}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#1A1A2E] text-white text-[11px] font-bold">4</span>
                        <h4 className="text-[13px] font-semibold text-[#1A1A2E]">Net Worth</h4>
                      </div>
                      <div className="max-w-xs">
                        <label htmlFor="assets" className={labelCls}>Assets (Total Value)</label>
                        <CurrencyInput id="assets" value={form.assets} onChange={v => updateField('assets', v)} placeholder="0" />
                      </div>
                    </div>

                    {/* Section 5: Medical Expenses */}
                    <div className={sectionCls}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#1A1A2E] text-white text-[11px] font-bold">5</span>
                        <h4 className="text-[13px] font-semibold text-[#1A1A2E]">Medical Expenses</h4>
                      </div>
                      <div className="max-w-xs">
                        <label htmlFor="medicalExpenses" className={labelCls}>Unreimbursed Medical Expenses</label>
                        <CurrencyInput id="medicalExpenses" value={form.medicalExpenses} onChange={v => updateField('medicalExpenses', v)} placeholder="0" />
                      </div>
                    </div>

                    {/* Submit / Cancel buttons */}
                    {submitMsg && (
                      <div className={`px-4 py-2.5 rounded-md text-[13px] font-medium ${
                        submitMsg.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
                      }`}>
                        {submitMsg.text}
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleCancel}
                        className="px-4 py-2.5 text-sm border border-[#E2E4E8] rounded-md hover:bg-[#F0F4F8] transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={!hasFormData || submitting}
                        className="flex items-center gap-2 px-5 py-2.5 text-sm bg-[#1A1A2E] text-white font-medium rounded-md hover:bg-[#2E5984] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {submitting ? (
                          <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                        ) : (
                          <span className="material-symbols-outlined text-[16px]">calculate</span>
                        )}
                        {submitting ? 'Submitting…' : 'Calculate & Submit'}
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="flex items-center gap-1.5 px-3 py-2.5 text-sm border border-[#E2E4E8] rounded-md hover:bg-[#F0F4F8] transition-colors ml-auto"
                      >
                        <span className="material-symbols-outlined text-[16px]">print</span>
                        Print Assessment
                      </button>
                    </div>
                  </div>

                  {/* ── Right: Auto-Calculated Results Sidebar ── */}
                  <div className="w-[320px] p-5 bg-[#FAFBFC]">
                    <h4 className="text-[13px] font-semibold text-[#1A1A2E] mb-4 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-[#2E5984]">analytics</span>
                      Auto-Calculated Results
                    </h4>

                    {/* Thresholds */}
                    <div className="space-y-3 mb-5">
                      <div className="bg-white border border-[#E2E4E8] rounded-md p-3">
                        <p className="text-[11px] text-[#888] uppercase tracking-wide">GMT Threshold (ZIP-based)</p>
                        <p className="text-[16px] font-bold text-[#1A1A2E] mt-0.5">{displayCurrency(GMT_THRESHOLD)}</p>
                        <p className="text-[10px] text-[#AAA] mt-0.5">Based on patient ZIP: {patient?.raw?.zip || '97209'}</p>
                      </div>
                      <div className="bg-white border border-[#E2E4E8] rounded-md p-3">
                        <p className="text-[11px] text-[#888] uppercase tracking-wide">VA National Income Threshold</p>
                        <p className="text-[16px] font-bold text-[#1A1A2E] mt-0.5">{displayCurrency(VA_NATIONAL_THRESHOLD)}</p>
                      </div>
                    </div>

                    {/* Income Summary */}
                    <div className="bg-white border border-[#E2E4E8] rounded-md p-3 mb-4">
                      <p className="text-[11px] text-[#888] uppercase tracking-wide mb-2">Income Breakdown</p>
                      <div className="space-y-1.5 text-[12px]">
                        <div className="flex justify-between">
                          <span className="text-[#666]">Veteran Income</span>
                          <span className="font-medium text-[#333]">{displayCurrency(vetTotal)}</span>
                        </div>
                        {isMarried && (
                          <div className="flex justify-between">
                            <span className="text-[#666]">Spouse Income</span>
                            <span className="font-medium text-[#333]">{displayCurrency(spouseTotal)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-[#666]">Dependent Income</span>
                          <span className="font-medium text-[#333]">{displayCurrency(depIncome)}</span>
                        </div>
                        <div className="flex justify-between border-t border-[#E2E4E8] pt-1.5">
                          <span className="text-[#666] font-medium">Gross Income</span>
                          <span className="font-bold text-[#333]">{displayCurrency(grossIncome)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#666]">− Medical Expenses</span>
                          <span className="font-medium text-red-600">({displayCurrency(totalMedExpenses)})</span>
                        </div>
                        <div className="flex justify-between border-t border-[#1A1A2E] pt-1.5">
                          <span className="text-[#1A1A2E] font-semibold">Adjusted Income</span>
                          <span className="font-bold text-[#1A1A2E] text-[13px]">{displayCurrency(adjustedIncome)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Income vs Threshold Bar */}
                    <div className="bg-white border border-[#E2E4E8] rounded-md p-3 mb-4">
                      <p className="text-[11px] text-[#888] uppercase tracking-wide mb-2">Income vs. GMT Threshold</p>
                      <div className="relative h-5 bg-[#E2E4E8] rounded-full overflow-hidden">
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                            adjustedIncome < GMT_THRESHOLD
                              ? 'bg-green-500'
                              : adjustedIncome < GMT_THRESHOLD * 2
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                          }`}
                          style={{ width: `${incomeBarPct}%` }}
                        />
                        {/* Threshold marker */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-[#1A1A2E]"
                          style={{ left: `${Math.round((GMT_THRESHOLD / (GMT_THRESHOLD * 2.5)) * 100)}%` }}
                          title={`GMT Threshold: ${displayCurrency(GMT_THRESHOLD)}`}
                        />
                        {/* 2x marker */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-[#1A1A2E] opacity-40"
                          style={{ left: `${Math.round((GMT_THRESHOLD * 2 / (GMT_THRESHOLD * 2.5)) * 100)}%` }}
                          title={`2× GMT: ${displayCurrency(GMT_THRESHOLD * 2)}`}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-[#888] mt-1">
                        <span>$0</span>
                        <span>GMT</span>
                        <span>2× GMT</span>
                      </div>
                    </div>

                    {/* Net Worth */}
                    <div className="bg-white border border-[#E2E4E8] rounded-md p-3 mb-4">
                      <p className="text-[11px] text-[#888] uppercase tracking-wide">Total Assets / Net Worth</p>
                      <p className="text-[16px] font-bold text-[#1A1A2E] mt-0.5">{displayCurrency(totalAssets)}</p>
                    </div>

                    {/* Calculated Category */}
                    <div className={`rounded-md p-4 text-center border-2 ${
                      calcResult.exempt
                        ? 'border-green-400 bg-green-50'
                        : calcResult.category === 'Category B'
                          ? 'border-amber-400 bg-amber-50'
                          : 'border-red-400 bg-red-50'
                    }`}>
                      <p className="text-[11px] text-[#888] uppercase tracking-wide mb-1">Calculated Copay Category</p>
                      <p className={`text-[22px] font-bold ${
                        calcResult.exempt
                          ? 'text-green-800'
                          : calcResult.category === 'Category B'
                            ? 'text-amber-800'
                            : 'text-red-800'
                      }`}>
                        {hasFormData ? calcResult.category : '—'}
                      </p>
                      <p className={`text-[12px] font-medium mt-1 ${
                        calcResult.exempt
                          ? 'text-green-700'
                          : calcResult.category === 'Category B'
                            ? 'text-amber-700'
                            : 'text-red-700'
                      }`}>
                        {hasFormData ? calcResult.label : 'Enter income to calculate'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
