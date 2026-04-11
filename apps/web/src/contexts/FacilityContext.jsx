import { createContext, useContext, useState } from 'react';

const FacilityContext = createContext({ activeSite: null, setActiveSite: () => {} });

export const useFacility = () => useContext(FacilityContext);

export function FacilityProvider({ children }) {
  const [activeSite, setActiveSite] = useState(null); // null = all facilities
  return (
    <FacilityContext.Provider value={{ activeSite, setActiveSite }}>
      {children}
    </FacilityContext.Provider>
  );
}
