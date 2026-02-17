import React, { createContext, ReactNode, useCallback, useContext, useState } from 'react';

type DefaultColumnsContextType = {
  dsUID: string;
  setDsUID: (dsUID: string) => void;
};

const Context = createContext<DefaultColumnsContextType>({
  dsUID: '',
  setDsUID: () => {},
});

interface Props {
  children: ReactNode;
  initialDSUID: string;
}

export const DefaultColumnsContextProvider = ({ children, initialDSUID }: Props) => {
  const [dsUID, setDsUID] = useState(initialDSUID);

  /**
   * Sets the datasource UID and clears the existing state
   */
  const handleSetDsUID = useCallback((dsUID: string) => {
    setDsUID(dsUID);
  }, []);

  return (
    <Context.Provider
      value={{
        dsUID,
        setDsUID: handleSetDsUID,
      }}
    >
      {children}
    </Context.Provider>
  );
};

export const useDefaultColumnsContext = () => {
  return useContext(Context);
};
