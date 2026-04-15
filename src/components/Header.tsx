import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import tpssLogo from "@/assets/tpss-logo.jpg";

const navLinks = [
  { label: "About", href: "#about" },
  { label: "Services", href: "#services" },
  { label: "Certifications", href: "#certifications" },
  { label: "Gallery", href: "#gallery" },
  { label: "Leadership", href: "#team" },
  { label: "Clients & Partners", href: "#clients" },
  { label: "Contact", href: "#contact" },
];

const Header = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
      const sections = navLinks.map((l) => l.href.slice(1));
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i]);
        if (el && el.getBoundingClientRect().top <= 100) {
          setActiveSection(sections[i]);
          return;
        }
      }
      setActiveSection("");
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleClick = (href: string) => {
    setMobileOpen(false);
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-shadow duration-300 bg-background ${
        scrolled ? "shadow-md" : ""
      }`}
    >
      <div className="container mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={tpssLogo} alt="TPSS Logo" className="h-12 w-12 rounded-full object-cover" />
          <div className="flex flex-col">
            <span className="text-xl font-extrabold tracking-tight text-navy font-mono">
              TPSS
            </span>
            <span className="text-[9px] tracking-widest uppercase text-muted-foreground leading-tight">
              TRINETRA PROFESSIONAL SECURITY & SERVICES
            </span>
          </div>
        </div>

        <nav className="hidden lg:flex gap-6">
          {navLinks.map((link) => (
            <button
              key={link.href}
              onClick={() => handleClick(link.href)}
              className={`text-sm font-medium transition-colors hover:text-gold ${
                activeSection === link.href.slice(1)
                  ? "text-gold"
                  : "text-navy"
              }`}
            >
              {link.label}
            </button>
          ))}
        </nav>

        <button
          className="lg:hidden text-navy"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {mobileOpen && (
        <nav className="lg:hidden bg-background border-t border-border px-4 py-4 flex flex-col gap-3">
          {navLinks.map((link) => (
            <button
              key={link.href}
              onClick={() => handleClick(link.href)}
              className={`text-left text-sm font-medium transition-colors hover:text-gold ${
                activeSection === link.href.slice(1)
                  ? "text-gold"
                  : "text-navy"
              }`}
            >
              {link.label}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
};

export default Header;
