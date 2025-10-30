export default function LoadingCases() {
  return (
    <div className="container py-4">
      <div className="mb-3">
        <div style={{ height: 28, width: 220 }} className="skeleton" />
      </div>
      <div className="row g-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div className="col-md-3" key={i}>
            <div className="card p-3">
              <div className="skeleton" style={{ height: 18, width: '70%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 14, width: '90%', marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 14, width: '60%' }} />
            </div>
          </div>
        ))}
      </div>
      <style>{`
        .skeleton { 
          background: linear-gradient(90deg, #eee 25%, #f5f5f5 37%, #eee 63%);
          background-size: 400% 100%;
          animation: shimmer 1.2s ease-in-out infinite;
          border-radius: 6px;
        }
        @keyframes shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
      `}</style>
    </div>
  );
}