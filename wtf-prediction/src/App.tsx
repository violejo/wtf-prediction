import React, { useState, useEffect } from 'react';

// ==========================================
// 1. BracketView Component (Inline Fix for TS2307)
// ==========================================
interface BracketViewProps {
  title?: string;
}

const BracketView: React.FC<BracketViewProps> = ({ title = "Predictions Bracket" }) => {
  return (
    <div className="p-4 my-4 bg-gray-800 text-white rounded-lg border border-gray-700">
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      <p className="text-sm text-gray-400">Farcaster Frame / Mini-App Bracket View</p>
      <div className="mt-2 p-2 bg-gray-900 rounded text-center text-xs text-gray-500">
        [Predictions bracket tree layout renders here]
      </div>
    </div>
  );
};

// ==========================================
// 2. Main App Component (MetaMask Removed & Cleaned)
// ==========================================
function App() {
  const [userContext, setUserContext] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const initFarcaster = async () => {
      try {
        if (typeof window !== 'undefined') {
          // Farcaster SDK integration point
          // const sdk = await import('@farcaster/frame-sdk');
          // const context = await sdk.actions.ready();
          // setUserContext(context);
        }
      } catch (error) {
        console.error("Failed to initialize Farcaster SDK:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initFarcaster();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <p>Loading Farcaster Context...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 flex flex-col items-center">
      <header className="w-full max-w-2xl mb-6 text-center">
        <h1 className="text-3xl font-extrabold text-purple-500">WTF Prediction</h1>
        <p className="text-gray-400 mt-2">Powered by Farcaster SDK</p>
      </header>

      <main className="w-full max-w-2xl bg-gray-800 rounded-xl shadow-md p-6">
        {userContext?.user ? (
          <div className="mb-4 p-3 bg-purple-900/30 rounded border border-purple-500/30">
            <p className="text-sm">
              Welcome, <span className="font-bold text-purple-400">@{userContext.user.username}</span> (FID: {userContext.user.fid})
            </p>
          </div>
        ) : (
          <div className="mb-4 p-3 bg-yellow-900/20 rounded border border-yellow-600/30">
            <p className="text-sm text-yellow-500 text-center">
              Running outside Farcaster client or context not found.
            </p>
          </div>
        )}

        <BracketView title="WTF Tournament Bracket" />

        <div className="mt-6 text-center">
          <button 
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition"
            onClick={() => alert('Prediction submitted via Farcaster context!')}
          >
            Submit Prediction
          </button>
        </div>
      </main>
    </div>
  );
}

export default App;
