import { createContext, useContext } from "react";

import rolePermissions from "../utils/rolePermissions";

const PermissionContext =
  createContext(null);

export const PermissionProvider = ({
  children,
}: any) => {

  const user =
    JSON.parse(
      localStorage.getItem(
        "currentUser"
      )
    ) || {};

  const permissions =
    rolePermissions[
      user.role
    ] || [];

  const hasPermission = (
    permission
  ) => {

    return permissions.includes(
      permission
    );
  };

  return (
    <PermissionContext.Provider
      value={{
        permissions,
        hasPermission,
      }}>

      {children}
    </PermissionContext.Provider>
  );
};

export const usePermission =
  () => useContext(
    PermissionContext
  );