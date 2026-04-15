import tpssLogo from "@/assets/tpss-logo.jpg";

const quickLinks = ["About", "Leadership", "Services", "Certifications", "Gallery", "Contact"];
const sectionIds: Record<string, string> = {
  About: "#about",
  Leadership: "#team",
  Services: "#services",
  Certifications: "#certifications",
  Gallery: "#gallery",
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
          <div className="flex items-center gap-3">
            <img src={tpssLogo} alt="TPSS Logo" className="h-10 w-10 rounded-full object-cover" />
            <div>
              <span className="text-xl font-extrabold text-white font-mono">
                TPSS
              </span>
              <p className="text-xs text-white/60">Your Safety, Our Priority</p>
            </div>
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
            <p className="flex flex-wrap gap-x-1">
              Phone:{" "}
              <a href="tel:+919550214234" className="hover:text-gold transition-colors">+91 95502 14234</a>,
              <a href="tel:+919347903636" className="hover:text-gold transition-colors">+91 93479 03636</a>
            </p>
            <p>
              Email:{" "}
              <a href="mailto:admin@tpsssecurity.com" className="hover:text-gold transition-colors">
                admin@tpsssecurity.com
              </a>
            </p>
            <p>Nellore, Andhra Pradesh – 524001</p>
          </div>
        </div>
        <div className="border-t border-white/10 pt-6 text-center text-xs text-white/40 space-y-1">
          <p>© 2020 TRINETRA PROFESSIONAL SECURITY & SERVICES. All Rights Reserved.</p>
          <p>Office Hours: Mon–Sat, 9:00 AM – 7:00 PM | Security Operations: 24/7</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
