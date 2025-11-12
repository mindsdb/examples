'use client';

import { AppProvider } from '@/lib/hooks';
import LegalContractChat from '@/components/LegalContractChat';

export default function HomePage() {
  return (
    <AppProvider>
      <LegalContractChat />
    </AppProvider>
  );
}
