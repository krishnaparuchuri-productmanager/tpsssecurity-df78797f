export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold text-app-navy">{title}</h1>
      <div className="bg-white border border-app-border rounded-lg p-12 text-center">
        <div className="text-app-saffron font-semibold mb-1">Coming in Phase 2</div>
        <p className="text-sm text-app-muted">This module will be available in the next phase of development.</p>
      </div>
    </div>
  );
}
