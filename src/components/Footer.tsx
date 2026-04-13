const quickLinks = ["About", "Services", "Certifications", "Gallery", "Executive Team", "Contact"];
const sectionIds: Record<string, string> = {
  About: "#about",
  Services: "#services",
  Certifications: "#certifications",
  Gallery: "#gallery",
  "Executive Team": "#team",
  Contact: "#contact",
};

const Footer = () => {
  const scrollTo = (href: string) => {
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <footer className="bg-navy text-white/80 pt-16 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">
          <div>
            <span className="text-2xl font-extrabold text-white">
              TP<span className="text-gold">SS</span>
            </span>
            <p className="text-sm mt-2 text-white/60">Your Safety, Our Priority</p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-3 text-sm">Quick Links</h4>
            <ul className="space-y-2">
              {quickLinks.map((l) => (
                <li key={l}>
                  <button
                    onClick={() => scrollTo(sectionIds[l])}
                    className="text-sm text-white/60 hover:text-gold transition-colors"
                  >
                    {l}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2 text-sm">
            <p>
              Phone:{" "}
              <a href="tel:+919550214234" className="hover:text-gold transition-colors">
                +91 95502 14234
              </a>
            </p>
            <p>
              Email:{" "}
              <a href="mailto:admin@tpss.com" className="hover:text-gold transition-colors">
                admin@tpss.com
              </a>
            </p>
            <p>Nellore, Andhra Pradesh – 524001</p>
          </div>
        </div>
        <div className="border-t border-white/10 pt-6 text-center text-xs text-white/40 space-y-1">
          <p>© 2025 Trinetra Professional Security Services. All Rights Reserved.</p>
          <p>Office Hours: Mon–Sat, 9:00 AM – 7:00 PM | Security Operations: 24/7</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
