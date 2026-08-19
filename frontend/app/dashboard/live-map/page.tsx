import { redirect } from 'next/navigation';

export const dynamic = 'error';

export default function LegacyLiveMapPage() {
  redirect('/dashboard/map');
}
