import { useState } from "react";
import { X } from "lucide-react";

const certificates = [
  {
    title: "ISO 9001:2015 (MQA Certification)",
    image: "/images/certifications/iso-cert-mqa.jpg",
  },
  {
    title: "ISO 9001:2015 (UK Cert Limited)",
    image: "/images/certifications/iso-cert-ukcert.jpg",
  },
  {
    title: "PSARA License – Govt. of Andhra Pradesh",
    image: "/images/certifications/psara-license.jpg",
  },
];

const CertificationsSection = () => {
  const [lightbox, setLightbox] = useState<string | null>(null);

  return (
    <section id="certifications" className="py-20 bg-navy">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
          Certified &amp; Compliant
        </h2>
        <p className="text-white/60 text-center text-sm mb-12 max-w-xl mx-auto">
          Click any certificate to view in full size
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {certificates.map((cert) => (
            <div
              key={cert.title}
              className="bg-white/10 backdrop-blur rounded-lg p-4 flex flex-col items-center cursor-pointer group hover:bg-white/15 transition-colors"
              onClick={() => setLightbox(cert.image)}
            >
              <div className="w-full aspect-[3/4] rounded overflow-hidden mb-4 bg-white">
                <img
                  src={cert.image}
                  alt={cert.title}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <h3 className="text-sm font-semibold text-white text-center leading-snug">
                {cert.title}
              </h3>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-6 right-6 text-white hover:text-gold transition-colors"
            onClick={() => setLightbox(null)}
            aria-label="Close"
          >
            <X size={32} />
          </button>
          <img
            src={lightbox}
            alt="Certificate preview"
            className="max-w-full max-h-[90vh] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
};

export default CertificationsSection;
