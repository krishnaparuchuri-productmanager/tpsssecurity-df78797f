import { useState } from "react";
import { Phone, Mail, MapPin, Clock } from "lucide-react";

const ContactSection = () => {
  const [form, setForm] = useState({ name: "", phone: "", email: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Thank you for reaching out! We will contact you shortly.");
    setForm({ name: "", phone: "", email: "", message: "" });
  };

  return (
    <section id="contact" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-navy text-center mb-12">Get In Touch</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-5xl mx-auto">
          {/* Contact Details */}
          <div className="space-y-6">
            <div className="flex items-start gap-3">
              <MapPin className="text-gold mt-1 shrink-0" size={20} />
              <p className="text-sm text-foreground">
                16-6-240, 2nd Cross Road, S.V Agraharam, Mini Bypass Road, Opp. PTG Petrol Bunk, Nellore, Andhra Pradesh – 524001
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="text-gold shrink-0" size={20} />
              <a href="tel:+919550214234" className="text-sm text-foreground hover:text-gold transition-colors">
                +91 95502 14234
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

          {/* Contact Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 rounded border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-gold"
            />
            <input
              type="tel"
              placeholder="Phone"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-4 py-3 rounded border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-gold"
            />
            <input
              type="email"
              placeholder="Email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-3 rounded border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-gold"
            />
            <textarea
              placeholder="Message"
              required
              rows={4}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full px-4 py-3 rounded border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-gold resize-none"
            />
            <button
              type="submit"
              className="w-full px-6 py-3 bg-navy text-gold font-semibold rounded hover:opacity-90 transition-opacity"
            >
              Submit
            </button>
          </form>
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
