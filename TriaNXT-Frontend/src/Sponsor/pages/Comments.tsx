import React from "react";
import AppLayout from "./AppLayout";
import "../../shared/pages/operations/Comments.css";
import "../../pages/shared/operations/Comments.js";
import RoleCommentsView from "../../shared/components/RoleCommentsView";

export default function CommentsPage() {
  return (
    <AppLayout>
      <RoleCommentsView embedded />
    </AppLayout>
  );
}
