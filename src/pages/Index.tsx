import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import AboutSection from "@/components/AboutSection";
import ServicesSection from "@/components/ServicesSection";
import WhyChooseSection from "@/components/WhyChooseSection";
import CertificationsSection from "@/components/CertificationsSection";
import GallerySection from "@/components/GallerySection";
import TeamSection from "@/components/TeamSection";
import ClientsSection from "@/components/ClientsSection";
import ContactSection from "@/components/ContactSection";
import Footer from "@/components/Footer";

const Index = () => (
  <div className="min-h-screen">
    <Header />
    <HeroSection />
    <AboutSection />
    <ServicesSection />
    <WhyChooseSection />
    <CertificationsSection />
    <GallerySection />
    <TeamSection />
    <ClientsSection />
    <ContactSection />
    <Footer />
  </div>
);

export default Index;
