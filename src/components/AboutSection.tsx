import { Users, Award, Calendar } from "lucide-react";

const stats = [
  { icon: Users, label: "150+ Team Members" },
  { icon: Award, label: "ISO 9001:2015 Certified" },
  { icon: Calendar, label: "Since 2019" },
];

const AboutSection = () => (
  <section id="about" className="py-20 bg-background">
    <div className="container mx-auto px-4 max-w-4xl">
      <h2 className="text-3xl md:text-4xl font-bold text-navy text-center mb-8">About TPSS</h2>
      <p className="text-muted-foreground text-center leading-relaxed mb-12">
        Founded in 2019 in Nellore, Andhra Pradesh, Trinetra Professional Security & Services is a PSARA-compliant,
        ISO 9001:2015 certified security organization with 150+ trained professionals. Led by retired Defense and
        Police officers, TPSS delivers round-the-clock security, housekeeping, and surveillance services across
        Nellore, Tirupati, and expanding throughout AP &amp; Telangana.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col items-center p-6 rounded-lg border border-border bg-secondary/40">
            <s.icon className="text-gold mb-3" size={32} />
            <span className="font-semibold text-navy text-sm text-center">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default AboutSection;
