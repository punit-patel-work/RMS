import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Toaster } from '@/components/ui/sonner';
import { Providers } from '@/components/providers';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <Providers>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="flex">
          <Sidebar user={session.user} />
          <main className="flex-1 min-h-screen lg:pl-0">
            <div className="p-4 lg:p-8">{children}</div>
          </main>
        </div>
        <Toaster richColors position="top-right" />
      </div>
    </Providers>
  );
}

