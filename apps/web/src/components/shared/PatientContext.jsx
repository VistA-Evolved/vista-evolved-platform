import { createContext, useContext, useState, useCallback } from 'react';

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
