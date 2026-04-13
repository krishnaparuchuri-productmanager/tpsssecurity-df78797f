import { ShieldCheck, Star, RefreshCw } from "lucide-react";

const points = [
  { icon: ShieldCheck, label: "PSARA-Compliant Operations" },
  { icon: Star, label: "Led by Retired Defense & Police Officers" },
  { icon: RefreshCw, label: "Immediate Guard Replacement" },
];

const WhyChooseSection = () => (
  <section className="py-16 bg-background">
    <div className="container mx-auto px-4">
      <h2 className="text-3xl md:text-4xl font-bold text-navy text-center mb-12">Why Choose Us</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
        {points.map((p) => (
          <div key={p.label} className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full border-2 border-gold flex items-center justify-center mb-4">
              <p.icon className="text-gold" size={24} />
            </div>
            <span className="text-sm font-medium text-navy">{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default WhyChooseSection;
