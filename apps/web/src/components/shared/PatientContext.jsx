import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getPatient } from '../../services/patientService';

const PatientContext = createContext(null);

const EMPTY_PATIENT = {
  dfn: null,
  name: '',
  dob: '',
  age: null,
  gender: '',
  govId: '',
  allergies: [],
  flags: [],
  codeStatus: '',
  location: '',
  status: '',
  isRestricted: false,
};

export function PatientProvider({ children }) {
  const [patient, setPatientState] = useState(EMPTY_PATIENT);
  const location = useLocation();
  const loadingRef = useRef(null); // track in-flight DFN to avoid duplicates

  const setPatient = useCallback((data) => {
    if (!data) {
      setPatientState(EMPTY_PATIENT);
      return;
    }
    const dob = data.dob ? new Date(data.dob) : null;
    const age = dob ? Math.floor((Date.now() - dob.getTime()) / 31557600000) : null;
    setPatientState({
      dfn: data.dfn || data.id || null,
      name: (data.name || '').toUpperCase(),
      dob: data.dob || '',
      age,
      gender: data.gender || data.sex || '',
      govId: data.govId || data.ssn || '',
      allergies: data.allergies || [],
      flags: data.flags || [],
      codeStatus: data.codeStatus || '',
      location: data.location || '',
      status: data.status || 'outpatient',
      isRestricted: data.isRestricted || false,
      phone: data.phone || '',
      address: data.address || '',
      emergencyContact: data.emergencyContact || '',
      raw: data,
    });
  }, []);

  const clearPatient = useCallback(() => {
    setPatientState(EMPTY_PATIENT);
  }, []);

  // URL-driven auto-fetch: if the URL contains /patients/:dfn/*, auto-load
  // that patient so pages don't need to manually call getPatient() on mount.
  useEffect(() => {
    const match = location.pathname.match(/^\/patients\/(\d+)/);
    const urlDfn = match ? match[1] : null;

    // If we've left the patient context, clear it
    if (!urlDfn) {
      if (patient.dfn) clearPatient();
      loadingRef.current = null;
      return;
    }

    // Already loaded or loading this patient
    if (urlDfn === String(patient.dfn) || urlDfn === loadingRef.current) return;

    loadingRef.current = urlDfn;
    (async () => {
      try {
        const res = await getPatient(urlDfn);
        if (loadingRef.current !== urlDfn) return; // stale
        if (res?.ok && res.data) {
          setPatient(res.data);
        }
      } catch {
        // Non-fatal — individual pages also fetch if needed
      }
    })();
  }, [location.pathname, patient.dfn, clearPatient, setPatient]);

  return (
    <PatientContext.Provider value={{ patient, setPatient, clearPatient, hasPatient: !!patient.dfn }}>
      {children}
    </PatientContext.Provider>
  );
}

export function usePatient() {
  const ctx = useContext(PatientContext);
  if (!ctx) throw new Error('usePatient must be used within PatientProvider');
  return ctx;
}

export default PatientContext;
