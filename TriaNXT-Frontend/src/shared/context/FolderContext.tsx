import { createContext, useContext, useMemo, useState } from "react";

const FolderContext = createContext(null);

export function FolderProvider({ children }: any) {
  const [revision, setRevision] = useState(0);

  const value = useMemo(
    () => ({
      revision,
      notifyFolderChange: () => setRevision((current) => current + 1)
    }),
    [revision]
  );

  return (
    <FolderContext.Provider value={value}>{children}</FolderContext.Provider>
  );
}

export function useFolderContext() {
  return useContext(FolderContext);
}

export default FolderContext;
