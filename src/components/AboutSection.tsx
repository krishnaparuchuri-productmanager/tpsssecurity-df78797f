import { Users, Award, Calendar } from "lucide-react";

const stats = [
  { icon: Users, label: "200+ Team Members" },
...
        ISO 9001:2015 certified security organization with 200+ trained professionals. Led by retired Defense and
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
