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
            <div className="flex flex-col text-sm text-foreground">
              <a href="tel:+919550214234" className="hover:text-gold transition-colors">+91 95502 14234</a>
              <a href="tel:+919347903636" className="hover:text-gold transition-colors">+91 93479 03636</a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="text-gold shrink-0" size={20} />
            <a href="mailto:admin@tpsssecurity.com" className="text-sm text-foreground hover:text-gold transition-colors">
              admin@tpsssecurity.com
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
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3829.123456789!2d79.9876543!3d14.4567890!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3a4c8d9ec19cc9b5%3A0xabb7accfece64051!2sTrinetra%20Professional%20Security%20Services!5e0!3m2!1sen!2sin!4v1234567890"
            width="100%"
            height="450"
            style={{ border: 0, borderRadius: "12px" }}
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
