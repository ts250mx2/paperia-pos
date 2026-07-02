'use client';

import { useRouter } from 'next/navigation';
import { Sun, Moon, LogOut, User } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import styles from './Header.module.css';
import { useEffect, useState } from 'react';

const PUESTOS: Record<number, string> = {
  1: 'Administrador',
  2: 'Cajero',
  3: 'Mesero',
};

export default function Header() {
  const { theme, toggle: toggleTheme } = useTheme();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('user');
    router.push('/login');
  };

  const isAdmin = user?.IdPuesto === 1;
  const roleName = user?.IdPuesto ? PUESTOS[user.IdPuesto] || 'Usuario' : 'Usuario';

  return (
    <header className={`${styles.header} glass`}>
      <div className={styles.left}>
        <img
          src="/logo.png"
          alt="La Paperia"
          className={styles.logo}
        />
      </div>

      <div className={styles.right}>
        <button className={styles.themeBtn} onClick={toggleTheme} title="Cambiar tema">
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <div className={styles.userSection}>
          <div className={styles.userInfo}>
            <span className={`${styles.userName} ${isAdmin ? styles.adminHighlight : ''}`}>
              {user?.Usuario || 'Usuario'} <span className={styles.userRole}>({roleName})</span>
            </span>
            <button onClick={handleLogout} className={styles.logoutBtn}>
              <LogOut size={14} />
              <span>Cerrar Sesión</span>
            </button>
          </div>
          <div className={styles.avatar}>
            <User size={20} />
          </div>
        </div>
      </div>
    </header>
  );
}
