const clientImages = [
  ...Array.from({ length: 11 }, (_, i) => `/images/clients/client-${i + 1}.jpeg`),
  "/images/clients/client-12.png",
  "/images/clients/client-13.jpg",
  "/images/clients/client-14.png",
  "/images/clients/client-15.jpg",
  "/images/clients/client-16.png",
  "/images/clients/client-17.png",
];

const ClientsSection = () => (
  <section id="clients" className="py-20 bg-secondary/30">
    <div className="container mx-auto px-4 text-center">
      <h2 className="text-3xl md:text-4xl font-bold text-navy mb-6">Trusted By</h2>
      <p className="text-muted-foreground max-w-2xl mx-auto mb-10">
        Trusted by leading enterprises, institutions, and government bodies across Andhra Pradesh &amp; Telangana.
      </p>
      <div className="flex flex-wrap justify-center gap-8">
        {clientImages.map((src, i) => (
          <div
            key={i}
            className="w-32 h-20 rounded-lg border border-border bg-white flex items-center justify-center p-2 hover:shadow-md transition-all duration-300"
          >
            <img
              src={src}
              alt={`Client ${i + 1}`}
              className="max-w-full max-h-full object-contain"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default ClientsSection;
