const team = [
  {
    name: "P. Ramsundar",
    designation: "Managing Director",
    photo: "https://raw.githubusercontent.com/krishnaparuchuri-productmanager/TPSS-Images/main/P.%20Ramsundar%20(1).png",
  },
  {
    name: "B. Bharath Sai",
    designation: "CEO",
    photo: "https://raw.githubusercontent.com/krishnaparuchuri-productmanager/TPSS-Images/main/B.%20Bharath%20Sai.jpg.jpeg",
  },
];

const TeamSection = () => (
  <section id="team" className="py-20 bg-background">
    <div className="container mx-auto px-4">
      <h2 className="text-3xl md:text-4xl font-bold text-navy text-center mb-12">Our Leadership</h2>
      <div className="flex flex-wrap justify-center gap-12">
        {team.map((m) => (
          <div key={m.name} className="flex flex-col items-center w-56">
            <div className="w-36 h-36 rounded-full border-4 border-navy overflow-hidden mb-4">
              <img src={m.photo} alt={m.name} className="w-full h-full object-cover" />
            </div>
            <h3 className="text-lg font-bold text-navy">{m.name}</h3>
            <span className="text-sm font-medium text-gold">{m.designation}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default TeamSection;
