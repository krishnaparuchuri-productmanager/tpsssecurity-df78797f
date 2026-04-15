import { useState } from "react";
import { Shield, X } from "lucide-react";

const CertificationsSection = () => {
  const [lightbox, setLightbox] = useState<string | null>(null);

  return (
    <section id="certifications" className="py-20 bg-navy">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
          Certified &amp; Compliant
        </h2>

        {/* Description Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto mb-14">
          <div className="bg-white/10 backdrop-blur rounded-lg p-8 text-center flex flex-col items-center">
            <img
              src="/images/certifications/iso-logo.jpg"
              alt="ISO 9001:2015 Logo"
              className="w-24 h-24 object-contain mb-4 rounded"
            />
            <h3 className="text-lg font-bold text-white mb-2">ISO 9001:2015 Certified</h3>
            <p className="text-white/70 text-sm leading-relaxed">
              Our quality management systems meet international ISO 9001:2015 standards, ensuring consistent,
              high-quality service delivery across all operations.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur rounded-lg p-8 text-center flex flex-col items-center">
            <div className="w-24 h-24 flex items-center justify-center mb-4">
              <Shield className="text-gold" size={56} strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">PSARA Licensed</h3>
            <p className="text-white/70 text-sm leading-relaxed">
              Fully licensed under the Private Security Agencies Regulation Act (PSARA), Andhra Pradesh — ensuring
              legally compliant, professionally trained security personnel.
            </p>
          </div>
        </div>

        {/* Certificate Images */}
        <h3 className="text-lg font-semibold text-gold text-center mb-6">
          View Our Certificates
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            { title: "ISO 9001:2015 – MQA Certification", image: "/images/certifications/iso-cert-mqa.jpg" },
            { title: "ISO 9001:2015 – UK Cert Limited", image: "/images/certifications/iso-cert-ukcert.jpg" },
            { title: "PSARA License – Govt. of AP", image: "/images/certifications/psara-license.jpg" },
          ].map((cert) => (
            <div
              key={cert.title}
              className="bg-white rounded-lg overflow-hidden cursor-pointer group hover:shadow-lg hover:shadow-gold/20 transition-all duration-300"
              onClick={() => setLightbox(cert.image)}
            >
              <div className="aspect-[3/4] p-2">
                <img
                  src={cert.image}
                  alt={cert.title}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="bg-navy/90 px-3 py-2.5 text-center">
                <p className="text-xs font-medium text-white/80">{cert.title}</p>
              </div>
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
