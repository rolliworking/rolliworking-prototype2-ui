import { Routes, Route } from 'react-router-dom';

function App() {
  return (
    <div className="min-h-screen bg-background">
      <Routes>
        <Route path="/" element={<HomePage />} />
        {/* TODO: Add all 112 routes */}
      </Routes>
    </div>
  );
}

function HomePage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">
          🔧 RolliSuite ERP
        </h1>
        <p className="text-muted-foreground">
          Watch Repair Shop Management System
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Frontend scaffold ready. Start building! 🚀
        </p>
      </div>
    </div>
  );
}

export default App;
