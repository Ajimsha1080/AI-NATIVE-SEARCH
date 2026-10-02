'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AIModeLivePreviewRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/ai-mode/search');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh] text-xs text-zinc-500 font-medium">
      Redirecting to AI Search &amp; Assistant...
    </div>
  );
}
