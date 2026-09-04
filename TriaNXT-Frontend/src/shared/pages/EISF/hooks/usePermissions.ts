import { useMemo } from "react";

export default function usePermissions(userPermissions: any = {}) {
  return useMemo(() => {
    const permissions = {
      upload: !!userPermissions.upload,
      edit: !!userPermissions.edit,
      delete: !!userPermissions.delete,
      download: !!userPermissions.download,
      approve: !!userPermissions.approve,
      replace: !!userPermissions.replace,
      view: userPermissions.view !== false,
    };

    const isReadOnly =
      !permissions.upload &&
      !permissions.edit &&
      !permissions.delete;

    const hasFullAccess =
      permissions.upload &&
      permissions.edit &&
      permissions.delete &&
      permissions.download;

    return {
      canView: permissions.view,
      canUpload: permissions.upload,
      canEdit: permissions.edit,
      canDelete: permissions.delete,
      canDownload: permissions.download,
      canApprove: permissions.approve,
      canReplace: permissions.replace,

      hasFullAccess,
      isReadOnly,

      permissions,
    };
  }, [userPermissions]);
}