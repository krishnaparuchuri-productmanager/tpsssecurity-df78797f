import { Shield } from "lucide-react";

const CertificationsSection = () => (
  <section id="certifications" className="py-20 bg-navy">
    <div className="container mx-auto px-4">
      <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">Certified &amp; Compliant</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
        {/* ISO Card */}
        <div className="bg-white/10 backdrop-blur rounded-lg p-8 text-center flex flex-col items-center">
          <img
            src="https://raw.githubusercontent.com/krishnaparuchuri-productmanager/TPSS-Images/main/ISO%20%26%20PSARA/ISO%20Certificate%20and%20PSARA/9001-2015%20LOGO.jpg"
            alt="ISO 9001:2015 Logo"
            className="w-24 h-24 object-contain mb-4 rounded"
          />
          <h3 className="text-lg font-bold text-white mb-2">ISO 9001:2015 Certified</h3>
          <p className="text-white/70 text-sm leading-relaxed">
            Our quality management systems meet international ISO 9001:2015 standards, ensuring consistent,
            high-quality service delivery across all operations.
          </p>
        </div>

        {/* PSARA Card */}
        <div className="bg-white/10 backdrop-blur rounded-lg p-8 text-center flex flex-col items-center">
          <div className="w-24 h-24 flex items-center justify-center mb-4">
            <Shield className="text-gold" size={56} strokeWidth={1.5} />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">PSARA Licensed</h3>
          <p className="text-white/70 text-sm leading-relaxed mb-4">
            Fully licensed under the Private Security Agencies Regulation Act (PSARA), Andhra Pradesh — ensuring
            legally compliant, professionally trained security personnel.
          </p>
          <a
            href="https://raw.githubusercontent.com/krishnaparuchuri-productmanager/TPSS-Images/main/ISO%20%26%20PSARA/ISO%20Certificate%20and%20PSARA/TPSS%20-%20PSARA%20Certificate.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-2 bg-gold text-navy font-semibold text-sm rounded hover:opacity-90 transition-opacity"
          >
            View Certificate
          </a>
        </div>
      </div>
    </div>
  </section>
);

export default CertificationsSection;
