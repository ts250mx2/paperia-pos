'use client';

import { createContext, useContext, useState, useEffect } from 'react';

interface SidebarCtx {
  collapsed: boolean;
  isAdmin: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarCtx>({ collapsed: false, isAdmin: false, toggle: () => {} });

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(true); // Default to true to prevent flash
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const admin = user.IdPuesto === 1;
    setIsAdmin(admin);

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

    if (!admin || isMobile) {
      setCollapsed(true);
    } else {
      const saved = localStorage.getItem('sidebarCollapsed');
      setCollapsed(saved === 'true');
    }

    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev;
      if (isAdmin) {
        localStorage.setItem('sidebarCollapsed', String(next));
      }
      return next;
    });
  };

  return (
    <SidebarContext.Provider value={{ collapsed, isAdmin, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => useContext(SidebarContext);
