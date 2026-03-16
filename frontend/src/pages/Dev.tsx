import React from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import SignUp from '../dev/SignUp';
import Login from '../dev/Login';
import WatchlistTest from '../dev/WatchlistTest';
import MovieDisplay from '../dev/MovieDisplay';
import WatchlistDisplay from '../dev/WatchlistDisplay';

const Dev: React.FC = () => {
  usePageTitle('Dev Tools • Uira.Live');
  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-3xl font-bold text-center mb-8">Dev Tools</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
        <div className="bg-gray-800 p-6 rounded shadow border border-gray-600">
          <SignUp />
        </div>
        <div className="bg-gray-800 p-6 rounded shadow border border-gray-600">
          <Login />
        </div>
        <div className="bg-gray-800 p-6 rounded shadow border border-gray-600">
          <WatchlistTest />
        </div>
        <div className="bg-gray-800 p-6 rounded shadow border border-gray-600">
          <MovieDisplay tmdbId={22} />
        </div>
        <div className="bg-gray-800 p-6 rounded shadow border border-gray-600">
          <MovieDisplay tmdbId={808} />
        </div>
      </div>
      <div className="mt-8">
        <div className="bg-gray-800 p-6 rounded shadow border border-gray-600">
          <WatchlistDisplay />
        </div>
      </div>
    </div>
  );
};

export default Dev;