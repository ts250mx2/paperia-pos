'use client';

import { useRouter } from 'next/navigation';
import LapicitoChatPanel from '@/components/Assistant/LapicitoChatPanel';
import styles from './agente.module.css';

export default function AgenteInteligentePage() {
  const router = useRouter();

  return (
    <div className={styles.page}>
      <div className={`${styles.card} glass`}>
        <LapicitoChatPanel variant="page" onMinimize={() => router.push('/dashboard')} />
      </div>
    </div>
  );
}
