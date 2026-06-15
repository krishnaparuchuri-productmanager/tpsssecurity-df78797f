import { useState, useEffect, useCallback, useMemo } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

const images = Array.from({ length: 58 }, (_, i) => `/images/gallery/slide-${i + 1}.jpg`);
const PRELOAD_WINDOW = 3;

const GallerySection = () => {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const next = useCallback(() => setCurrent((c) => (c + 1) % images.length), []);
  const prev = useCallback(() => setCurrent((c) => (c - 1 + images.length) % images.length), []);

  useEffect(() => {
    if (paused || lightbox) return;
    const id = setInterval(next, 1000);
    return () => clearInterval(id);
  }, [paused, lightbox, next]);

  // Only render images near the current slide — avoids loading all 58 at once
  const visibleIndices = useMemo(() => {
    const set = new Set<number>();
    for (let d = -PRELOAD_WINDOW; d <= PRELOAD_WINDOW; d++) {
      set.add((current + d + images.length) % images.length);
    }
    return set;
  }, [current]);

  return (
    <section id="gallery" className="py-20 bg-secondary/30">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-navy text-center mb-12">Our Team in Action</h2>

        <div
          className="relative max-w-4xl mx-auto overflow-hidden rounded-xl"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Slides */}
          <div className="relative aspect-[16/10] bg-navy">
            {images.map((src, i) =>
              visibleIndices.has(i) ? (
                <img
                  key={i}
                  src={src}
                  alt={`TPSS gallery ${i + 1}`}
                  className={`absolute inset-0 w-full h-full object-contain cursor-pointer transition-opacity duration-700 ${
                    i === current ? "opacity-100" : "opacity-0 pointer-events-none"
                  }`}
                  onClick={() => setLightbox(src)}
                />
              ) : null
            )}
          </div>

          {/* Arrows */}
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-navy/60 text-white flex items-center justify-center hover:bg-navy/90 transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-navy/60 text-white flex items-center justify-center hover:bg-navy/90 transition-colors"
            aria-label="Next"
          >
            <ChevronRight size={22} />
          </button>

          {/* Dots */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  i === current ? "bg-gold" : "bg-white/50"
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Lightbox */}
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
