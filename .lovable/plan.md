

## Plan: Update Certifications Display and Add Client Logos

### What changes will be made

**1. Copy uploaded assets into the project**
- Copy 3 certificate images (ISO MQA, ISO UK Cert, PSARA License) to `public/images/certifications/`
- Copy 6 new client logos (Indian Bank, Canara Bank, Transworld, ASC Chemicals, Gateway, Coastal Gold) to `public/images/clients/`

**2. Redesign the Certifications Section (`CertificationsSection.tsx`)**
- Replace the current small ISO logo thumbnail with the two full ISO certificate images displayed side by side
- Replace the PSARA "View Certificate" download button with the PSARA license image displayed inline
- Add a lightbox/modal so users can click any certificate to view it full-size
- Layout: 3-column grid on desktop (ISO MQA | ISO UK Cert | PSARA License), stacking on mobile
- Each card shows the certificate image with a label underneath

**3. Update Clients Section (`ClientsSection.tsx`)**
- Increase the client count from 11 to 17 (adding 6 new logos)
- New clients: Indian Bank, Canara Bank, Transworld Furtichem, Allegro Specialty Chemicals, Gateway Distriparks, Coastal Gold

### Technical details

- Certificate images will use `object-contain` for proper aspect ratio display
- Lightbox will reuse the same pattern already established in `GallerySection.tsx`
- Client image array will be updated to include mixed extensions (`.jpeg`, `.png`, `.jpg`) mapped explicitly instead of generated from a template
- No new dependencies required

