import { ShieldCheck, Building2, UserCheck, Camera } from "lucide-react";

const services = [
  { icon: ShieldCheck, title: "Guard & Housekeeping Services", desc: "Schools, colleges, housing societies" },
  { icon: Building2, title: "Facility & Office Security", desc: "Armed security for offices, high-rises, and facilities" },
  { icon: UserCheck, title: "Personal Security (PSO / Bouncers)", desc: "Bodyguards, PSOs, bank and retail surveillance" },
  { icon: Camera, title: "Electronic Surveillance", desc: "CCTV, fire alarms, access control, security audits" },
];

const ServicesSection = () => (
  <section id="services" className="py-20 bg-secondary/30">
    <div className="container mx-auto px-4">
      <h2 className="text-3xl md:text-4xl font-bold text-navy text-center mb-12">Our Services</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {services.map((s) => (
          <div key={s.title} className="bg-background rounded-lg border border-border p-6 hover:shadow-lg transition-shadow">
            <s.icon className="text-gold mb-4" size={28} strokeWidth={1.5} />
            <h3 className="text-lg font-semibold text-navy mb-2">{s.title}</h3>
            <p className="text-muted-foreground text-sm">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default ServicesSection;
