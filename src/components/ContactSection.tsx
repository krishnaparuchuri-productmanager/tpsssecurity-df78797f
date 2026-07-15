import { Phone, Mail, MapPin, Clock, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { useRef, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const REQUIREMENT_OPTIONS = ["Security Guards", "ASO", "Housekeeping", "Other"];
const CONTACT_MODES = ["Call", "Email", "WhatsApp", "Visit"];

interface FormState {
  contact_person_name: string;
  company_name: string;
  phone: string;
  email: string;
  location: string;
  requirement_category: string;
  no_of_guards: string;
  requirement_notes: string;
  preferred_contact_mode: string;
  consent: boolean;
  honeypot: string;
}

const EMPTY: FormState = {
  contact_person_name: "", company_name: "", phone: "", email: "",
  location: "", requirement_category: "", no_of_guards: "",
  requirement_notes: "", preferred_contact_mode: "", consent: false, honeypot: "",
};

const GoogleMap = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (containerRef.current && !containerRef.current.querySelector("iframe")) {
      const iframe = document.createElement("iframe");
      iframe.src =
        "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3829.123456789!2d79.9876543!3d14.4567890!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3a4c8d9ec19cc9b5%3A0xabb7accfece64051!2sTrinetra%20Professional%20Security%20Services!5e0!3m2!1sen!2sin!4v1234567890";
      iframe.width = "100%";
      iframe.height = "450";
      iframe.style.border = "0";
      iframe.style.borderRadius = "12px";
      iframe.allowFullscreen = true;
      iframe.loading = "lazy";
      iframe.referrerPolicy = "no-referrer-when-downgrade";
      iframe.title = "TPSS Location";
      containerRef.current.appendChild(iframe);
    }
  }, []);
  return <div ref={containerRef} className="max-w-5xl mx-auto mt-12 rounded-lg overflow-hidden" />;
};

export default function ContactSection() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  function set(field: keyof FormState, value: string | boolean) {
    setForm((p) => ({ ...p, [field]: value }));
    setErrors((p) => ({ ...p, [field]: "" }));
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.contact_person_name.trim()) e.contact_person_name = "Name is required";
    if (!form.company_name.trim()) e.company_name = "Company name is required";
    if (!form.phone.trim()) e.phone = "Phone number is required";
    else if (!/^[0-9+\s\-()]{7,15}$/.test(form.phone.trim())) e.phone = "Enter a valid phone number";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email";
    if (!form.location.trim()) e.location = "City / location is required";
    if (!form.requirement_category) e.requirement_category = "Please select a requirement type";
    if (!form.consent) e.consent = "Please accept the consent checkbox to proceed";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Honeypot: bot filled it
    if (form.honeypot) return;
    // Rate limit: prevent re-submit within 60s
    const lastSubmit = localStorage.getItem("tpss_lead_submit");
    if (lastSubmit && Date.now() - Number(lastSubmit) < 60000) {
      setSubmitError("Please wait a moment before submitting again.");
      return;
    }
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError("");

    const payload = {
      contact_person_name: form.contact_person_name.trim(),
      company_name: form.company_name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      location: form.location.trim(),
      requirement_category: form.requirement_category,
      no_of_guards: form.no_of_guards.trim() || null,
      requirement_notes: form.requirement_notes.trim() || null,
      preferred_contact_mode: form.preferred_contact_mode || null,
      submitted_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("website_lead_submissions")
      .insert({ payload, validation_status: "received" });

    setSubmitting(false);
    if (error) {
      setSubmitError("Something went wrong. Please call us directly or try again.");
      return;
    }

    localStorage.setItem("tpss_lead_submit", String(Date.now()));
    setSubmitted(true);
    setForm(EMPTY);
  }

  return (
    <section id="contact" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-navy text-center mb-12">Get In Touch</h2>

        {/* Contact details */}
        <div className="max-w-2xl mx-auto space-y-6 mb-16">
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

        {/* Lead capture form */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-navy rounded-2xl p-8 shadow-xl">
            <h3 className="text-2xl font-bold text-white mb-2">Request a Quote</h3>
            <p className="text-white/70 text-sm mb-8">
              Tell us about your security requirement and our team will get back to you within 4 hours.
            </p>

            {submitted ? (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <CheckCircle2 className="text-gold" size={56} />
                <h4 className="text-xl font-bold text-white">Thank you for reaching out!</h4>
                <p className="text-white/70 text-sm max-w-sm">
                  We've received your enquiry and our team will contact you within 4 hours.
                  You can also call us directly at <a href="tel:+919550214234" className="text-gold underline">+91 95502 14234</a>.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                {/* Honeypot — hidden from humans, bots fill it */}
                <input
                  type="text"
                  name="website_url"
                  value={form.honeypot}
                  onChange={(e) => set("honeypot", e.target.value)}
                  tabIndex={-1}
                  aria-hidden="true"
                  style={{ position: "absolute", left: "-9999px", opacity: 0, pointerEvents: "none" }}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Contact person */}
                  <div>
                    <label className="text-white/80 text-sm block mb-1">Contact Person *</label>
                    <input
                      type="text"
                      value={form.contact_person_name}
                      onChange={(e) => set("contact_person_name", e.target.value)}
                      placeholder="Your full name"
                      className="w-full rounded-lg px-3 py-2 text-sm bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-gold"
                    />
                    {errors.contact_person_name && <p className="text-red-400 text-xs mt-1">{errors.contact_person_name}</p>}
                  </div>

                  {/* Company */}
                  <div>
                    <label className="text-white/80 text-sm block mb-1">Company Name *</label>
                    <input
                      type="text"
                      value={form.company_name}
                      onChange={(e) => set("company_name", e.target.value)}
                      placeholder="Your organisation"
                      className="w-full rounded-lg px-3 py-2 text-sm bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-gold"
                    />
                    {errors.company_name && <p className="text-red-400 text-xs mt-1">{errors.company_name}</p>}
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="text-white/80 text-sm block mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full rounded-lg px-3 py-2 text-sm bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-gold"
                    />
                    {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="text-white/80 text-sm block mb-1">Email Address</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      placeholder="you@company.com"
                      className="w-full rounded-lg px-3 py-2 text-sm bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-gold"
                    />
                    {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                  </div>

                  {/* Location */}
                  <div>
                    <label className="text-white/80 text-sm block mb-1">City / Location *</label>
                    <input
                      type="text"
                      value={form.location}
                      onChange={(e) => set("location", e.target.value)}
                      placeholder="Nellore, Hyderabad..."
                      className="w-full rounded-lg px-3 py-2 text-sm bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-gold"
                    />
                    {errors.location && <p className="text-red-400 text-xs mt-1">{errors.location}</p>}
                  </div>

                  {/* Requirement type */}
                  <div>
                    <label className="text-white/80 text-sm block mb-1">Requirement Type *</label>
                    <select
                      value={form.requirement_category}
                      onChange={(e) => set("requirement_category", e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-gold"
                    >
                      <option value="" className="bg-navy">Select type…</option>
                      {REQUIREMENT_OPTIONS.map((o) => (
                        <option key={o} value={o} className="bg-navy">{o}</option>
                      ))}
                    </select>
                    {errors.requirement_category && <p className="text-red-400 text-xs mt-1">{errors.requirement_category}</p>}
                  </div>

                  {/* Guards count */}
                  {form.requirement_category === "Security Guards" && (
                    <div>
                      <label className="text-white/80 text-sm block mb-1">Number of Guards Required</label>
                      <input
                        type="number"
                        min="1"
                        value={form.no_of_guards}
                        onChange={(e) => set("no_of_guards", e.target.value)}
                        placeholder="e.g. 10"
                        className="w-full rounded-lg px-3 py-2 text-sm bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-gold"
                      />
                    </div>
                  )}

                  {/* Preferred contact mode */}
                  <div>
                    <label className="text-white/80 text-sm block mb-1">Preferred Contact Mode</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {CONTACT_MODES.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => set("preferred_contact_mode", form.preferred_contact_mode === m ? "" : m)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                            form.preferred_contact_mode === m
                              ? "bg-gold border-gold text-navy"
                              : "border-white/30 text-white/70 hover:border-gold/60"
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="mt-4">
                  <label className="text-white/80 text-sm block mb-1">Requirement Details</label>
                  <textarea
                    value={form.requirement_notes}
                    onChange={(e) => set("requirement_notes", e.target.value)}
                    placeholder="Briefly describe your security requirement, site details, or any specific needs…"
                    rows={3}
                    className="w-full rounded-lg px-3 py-2 text-sm bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-gold resize-none"
                  />
                </div>

                {/* Consent */}
                <div className="mt-4 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="consent"
                    checked={form.consent}
                    onChange={(e) => set("consent", e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-gold"
                  />
                  <label htmlFor="consent" className="text-white/70 text-xs leading-relaxed">
                    I consent to Trinetra Professional Security Services contacting me regarding my enquiry.
                    My information will be used solely for this purpose and not shared with third parties.
                  </label>
                </div>
                {errors.consent && <p className="text-red-400 text-xs mt-1">{errors.consent}</p>}

                {submitError && (
                  <div className="mt-4 flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle size={16} /> {submitError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-6 w-full flex items-center justify-center gap-2 bg-gold hover:bg-gold/90 disabled:opacity-60 text-navy font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  {submitting ? (
                    <span className="animate-spin h-4 w-4 border-2 border-navy border-t-transparent rounded-full" />
                  ) : (
                    <Send size={16} />
                  )}
                  {submitting ? "Sending…" : "Send Enquiry"}
                </button>
              </form>
            )}
          </div>
        </div>

        <GoogleMap />
      </div>
    </section>
  );
}
