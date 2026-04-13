const team = [
  {
    name: "P. Ramsundar",
    designation: "Managing Director",
    photo: "/images/team/ramsundar.png",
  },
  {
    name: "B. Bharath Sai",
    designation: "CEO",
    photo: "/images/team/bharath-sai.jpeg",
  },
];

const TeamSection = () => (
  <section id="team" className="py-20 bg-background">
    <div className="container mx-auto px-4">
      <h2 className="text-3xl md:text-4xl font-bold text-navy text-center mb-12">Our Leadership</h2>
      <div className="flex flex-wrap justify-center gap-16">
        {team.map((m) => (
          <div key={m.name} className="flex flex-col items-center w-72">
            <div className="w-56 h-56 rounded-full border-4 border-navy overflow-hidden mb-6">
              <img src={m.photo} alt={m.name} className="w-full h-full object-cover" />
            </div>
            <h3 className="text-xl font-bold text-navy">{m.name}</h3>
            <span className="text-base font-medium text-gold">{m.designation}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default TeamSection;
