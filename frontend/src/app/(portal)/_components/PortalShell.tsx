"use client";

import { useState } from "react";
import { ProtectedRoute } from "@/modules/auth";
import { UserRole } from "@/core/auth";
import { Sidebar } from "@/modules/common";
import { TopBar } from "@/shared/layout";

const PORTAL_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.ORGANIZATION,
  UserRole.FEDERATION,
];

export default function PortalShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <ProtectedRoute requiredRoles={PORTAL_ROLES}>
      <div className="flex min-h-screen bg-background">
        <Sidebar
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onMenuClick={() => setMobileNavOpen(true)} />
          <main className="min-w-0 flex-1">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
