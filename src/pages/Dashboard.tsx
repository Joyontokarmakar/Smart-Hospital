
import { useAuth } from '../hooks/useAuth';

export default function Dashboard() {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Welcome, {profile?.full_name}</h1>
        <p className="text-slate-500 mb-6 capitalize text-sm font-medium tracking-wide">
          Role: {profile?.role.replace('_', ' ')}
        </p>
        
        <button 
          onClick={signOut}
          className="px-6 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition shadow-sm font-medium w-full"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
