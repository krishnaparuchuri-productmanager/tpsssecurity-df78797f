import { Phone, Mail, MapPin, Clock } from "lucide-react";

const ContactSection = () => {
  return (
    <section id="contact" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-navy text-center mb-12">Get In Touch</h2>
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-start gap-3">
            <MapPin className="text-gold mt-1 shrink-0" size={20} />
            <p className="text-sm text-foreground">
              16-6-240, 2nd Cross Road, S.V Agraharam, Mini Bypass Road, Opp. PTG Petrol Bunk, Nellore, Andhra Pradesh – 524001
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="text-gold shrink-0" size={20} />
            <a href="tel:+919347903636" className="text-sm text-foreground hover:text-gold transition-colors">
              +91 93479 03636
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="text-gold shrink-0" size={20} />
            <a href="mailto:admin@tpss.com" className="text-sm text-foreground hover:text-gold transition-colors">
              admin@tpss.com
            </a>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="text-gold mt-1 shrink-0" size={20} />
            <div className="text-sm text-foreground">
              <p>Office Hours: Monday – Saturday, 9:00 AM to 7:00 PM</p>
              <p className="font-semibold">Security Operations: 24/7</p>
            </div>
          </div>
        </div>

        {/* Google Maps */}
        <div className="max-w-5xl mx-auto mt-12 rounded-lg overflow-hidden">
          <iframe
            src="https://www.google.com/maps?q=16-6-240,+2nd+Cross+Road,+S.V+Agraharam,+Nellore,+Andhra+Pradesh+524001&output=embed"
            width="100%"
            height="350"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="TPSS Location"
          />
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
