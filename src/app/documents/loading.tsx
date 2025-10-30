export default function LoadingDocuments() {
  return (
    <div className="container py-4">
      <div className="mb-3">
        <div style={{ height: 28, width: 260 }} className="skeleton" />
      </div>
      <div className="row g-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div className="col-md-6" key={i}>
            <div className="card p-3 d-flex flex-row align-items-center gap-3">
              <div className="skeleton" style={{ height: 40, width: 40, borderRadius: 8 }} />
              <div className="flex-grow-1">
                <div className="skeleton" style={{ height: 16, width: '80%', marginBottom: 6 }} />
                <div className="skeleton" style={{ height: 14, width: '60%', marginBottom: 4 }} />
                <div className="skeleton" style={{ height: 12, width: '40%' }} />
              </div>
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