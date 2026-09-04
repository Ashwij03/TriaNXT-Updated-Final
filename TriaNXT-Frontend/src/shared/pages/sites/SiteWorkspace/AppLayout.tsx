import React from "react";
import { Outlet } from "react-router-dom";

import "./AppLayout.css";

export default function AppLayout({ children }: any) {
  return (
    <div className="site-app-layout">
      <main className="site-app-content">
        {children ? children : <Outlet />}
      </main>
    </div>
  );
}