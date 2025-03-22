
import React, { useState } from 'react';
import GlassCard from './GlassCard';

const Achievements = () => {
  const [visibleItems, setVisibleItems] = useState(6);
  
  const achievements = [
    "Achieved Regional First 2 times in AWS Deepracer using \"Deep Reinforcement Learning Technology\" competition for the Udacity Nanodegree scholarship.",
    "Selected for the Leadership Program from Harvard Business School's Aspire Institute.",
    "Young Engineer and Scientist's Award- HONDA",
    "Chosen for ASEF Young Leaders Summit (ASEFYLS) program, 80 out of 4300+, focusing on 'Leadership in Society 5.0'.",
    "1st Award National Hackathon, OpenAI, Semantic Search, Codex Hackathons and Myanmar National Hackathon",
    "Finalist in 2023 & 2024 Global Climate Science Olympiad, Ranked Globally top (0.1%) out of over 50,000 participants.",
    "Silver Maker Award from K-Lab IoT (Internet of Things) project competition in collaboration with Korea.",
    "Invited to fully-funded NEW Youth Forum and Nuclear Reactor Technology Fellowship at Obninsk",
    "Invited to the funded Japan International Youth Innovation Summit 2024 by UN Global Goals to be awarded Asia Innovator Awards.",
    "Invited to ASEAN Youth Economic Forum 2024: \"Fostering Food Security and Economic Development Through the ASEAN-Japan Collaboration\".",
    "Invited to Asia World MUN, South Korea Summer Exchange, Asia Pacific Leader Summit, World Science Forum.",
    "Selected for the 2024 Womanium Quantum Computing and AI Scholarship Program."
  ];

  const showMoreItems = () => {
    setVisibleItems(achievements.length);
  };

  return (
    <section id="achievements" className="section-container">
      <h2 className="section-title">Achievements & Awards</h2>
      
      <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {achievements.slice(0, visibleItems).map((achievement, index) => (
          <GlassCard
            key={index}
            className="min-h-[200px] group relative overflow-hidden"
            hoverEffect
          >
            <div className="absolute -top-2 -left-2 w-12 h-12 flex items-center justify-center bg-primary rounded-br-2xl text-primary-foreground font-bold">
              {index + 1}
            </div>
            <div className="pt-8 pl-4">
              <p className="text-muted-foreground leading-relaxed">{achievement}</p>
            </div>
            <div className="absolute top-2 right-2 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v1.5M12 20v1.5M4.93 4.93l1.06 1.06M18.01 18.01l1.06 1.06M2 12h1.5M20.5 12H22M4.93 19.07l1.06-1.06M18.01 5.99l1.06-1.06M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z"></path>
              </svg>
            </div>
          </GlassCard>
        ))}
      </div>
      
      {visibleItems < achievements.length && (
        <div className="mt-10 text-center">
          <button
            onClick={showMoreItems}
            className="px-8 py-3 glass rounded-full font-medium hover:bg-white/20 transition-all"
          >
            Show More
          </button>
        </div>
      )}
    </section>
  );
};

export default Achievements;
