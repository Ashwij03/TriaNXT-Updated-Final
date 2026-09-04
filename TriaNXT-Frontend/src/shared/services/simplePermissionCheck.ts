export const hasPermission = (
  permission
) => {

  const user =
    JSON.parse(
      localStorage.getItem(
        "currentUser"
      )
    );

  if (
    user?.role ===
    "Admin"
  ) {

    return true;
  }

  return (
    user
      ?.permissions?.includes(
        permission
      ) || false
  );
};