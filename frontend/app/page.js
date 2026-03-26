'use client';

import dynamic from 'next/dynamic';

const PromptInterface = dynamic(
  () => import('../components/ui/PromptInterface'),
  { ssr: false }
);

export default function HomePage() {
  return <PromptInterface />;
}
