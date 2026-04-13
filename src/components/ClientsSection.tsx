const ClientsSection = () => (
  <section id="clients" className="py-20 bg-secondary/30">
    <div className="container mx-auto px-4 text-center">
      <h2 className="text-3xl md:text-4xl font-bold text-navy mb-6">Trusted By</h2>
      <p className="text-muted-foreground max-w-2xl mx-auto mb-10">
        Trusted by leading enterprises, institutions, and government bodies across Andhra Pradesh &amp; Telangana.
      </p>
      <div className="flex flex-wrap justify-center gap-8 opacity-50">
        {/* Placeholder for client logos — will populate when logos are uploaded */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="w-28 h-16 rounded border border-border bg-muted/50 flex items-center justify-center text-xs text-muted-foreground"
          >
            Client {i + 1}
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default ClientsSection;
