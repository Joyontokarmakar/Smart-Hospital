import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { NotificationProvider } from '../components/NotificationProvider';

export function DashboardLayout() {
  return (
    <div className="h-screen lg:h-screen w-full bg-slate-50 flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50/50 p-4 md:p-6 lg:p-8 relative">
          {/* subtle pattern background */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiNFMkU4RjAiLz48L3N2Zz4=')] [mask-image:linear-gradient(to_bottom,white,transparent)] pointer-events-none opacity-50" />
          
          <div className="max-w-7xl mx-auto w-full relative z-10 animate-fade-in-up transition-all duration-300">
            <NotificationProvider>
              <Outlet />
            </NotificationProvider>
          </div>
        </main>
      </div>
    </div>
  );
}
