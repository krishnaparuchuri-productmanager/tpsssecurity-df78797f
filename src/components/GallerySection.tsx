import { useState } from "react";
import { X } from "lucide-react";

const images = [
  "https://raw.githubusercontent.com/krishnaparuchuri-productmanager/TPSS-Images/main/Security%20Guards/Security%20guard%20image.jpeg",
  "https://raw.githubusercontent.com/krishnaparuchuri-productmanager/TPSS-Images/main/Security%20Guards/Security%20Animated%20Image.jpeg",
  "https://raw.githubusercontent.com/krishnaparuchuri-productmanager/TPSS-Images/main/Security%20Guards/Security%20Gunman%20image.jpg",
  "https://raw.githubusercontent.com/krishnaparuchuri-productmanager/TPSS-Images/main/Security%20Guards/House%20Keeping%20Image.png",
  "https://raw.githubusercontent.com/krishnaparuchuri-productmanager/TPSS-Images/main/Security%20Guards/Event%20Security/Event%20Security%20SS-1.jpg",
  "https://raw.githubusercontent.com/krishnaparuchuri-productmanager/TPSS-Images/main/Security%20Guards/Event%20Security/Event%20Security%20-%20Bouncers.jpg",
  "https://raw.githubusercontent.com/krishnaparuchuri-productmanager/TPSS-Images/main/Security%20Guards/Event%20Security/Event%20Security.jpg",
  "https://raw.githubusercontent.com/krishnaparuchuri-productmanager/TPSS-Images/main/Security%20Guards/Event%20Security/OPENING%20CERMONY.jpg",
  "https://raw.githubusercontent.com/krishnaparuchuri-productmanager/TPSS-Images/main/Security%20Guards/Drill/SMOF%202.jpg",
  "https://raw.githubusercontent.com/krishnaparuchuri-productmanager/TPSS-Images/main/Security%20Guards/Drill/NATCO%20FACE%20SHIELDS.jpg",
  "https://raw.githubusercontent.com/krishnaparuchuri-productmanager/TPSS-Images/main/Security%20Guards/Drill/nat%201.jpg",
  "https://raw.githubusercontent.com/krishnaparuchuri-productmanager/TPSS-Images/main/Security%20Guards/Appreciation/Appreciation%20Received%201.jpg",
  "https://raw.githubusercontent.com/krishnaparuchuri-productmanager/TPSS-Images/main/Security%20Guards/Appreciation/Appreciation%20received%202.jpg",
  "https://raw.githubusercontent.com/krishnaparuchuri-productmanager/TPSS-Images/main/Security%20Guards/Appreciation/Appreciation%20received%203.jpg",
  "https://raw.githubusercontent.com/krishnaparuchuri-productmanager/TPSS-Images/main/Security%20Guards/Appreciation/Appreciation%20received%204.jpg",
];

const GallerySection = () => {
  const [lightbox, setLightbox] = useState<string | null>(null);

  return (
    <section id="gallery" className="py-20 bg-secondary/30">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-navy text-center mb-12">Our Team in Action</h2>
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 max-w-5xl mx-auto">
          {images.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`TPSS gallery ${i + 1}`}
              className="w-full mb-4 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
              loading="lazy"
              onClick={() => setLightbox(src)}
            />
          ))}
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-6 right-6 text-white"
            onClick={() => setLightbox(null)}
            aria-label="Close"
          >
            <X size={32} />
          </button>
          <img
            src={lightbox}
            alt="Gallery preview"
            className="max-w-full max-h-[90vh] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
};

export default GallerySection;
