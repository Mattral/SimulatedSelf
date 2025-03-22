
import React from 'react';
import GlassCard from './GlassCard';

const Education = () => {
  const educations = [
    {
      degree: "MSc in Data Science",
      institution: "Imperial College London"
    },
    {
      degree: "BSc in Computer Science",
      institution: "University of the People"
    },
    {
      degree: "BSc in Data Science and Applied AI",
      institution: "Berlin IU"
    },
    {
      degree: "BSc in Business Statistics",
      institution: "School of Business and Trade Switzerland"
    },
    {
      degree: "Bachelor of Engineering in Mechatronic Engineering",
      institution: "Thanlyin Technological University"
    },
    {
      degree: "Oracle and AWS Certified Professional Data Scientist + Machine Learning Associate",
      institution: ""
    }
  ];

  return (
    <section id="education" className="section-container">
      <h2 className="section-title">Education & Training</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-16">
        {educations.map((edu, index) => (
          <GlassCard
            key={index}
            className="relative overflow-hidden group"
            hoverEffect
          >
            <div className="absolute top-0 left-0 w-2 h-full bg-primary"></div>
            <div className="pl-2">
              <h3 className="text-xl font-bold">{edu.degree}</h3>
              {edu.institution && (
                <p className="text-muted-foreground mt-2">{edu.institution}</p>
              )}
            </div>
            <div className="absolute top-2 right-2 w-12 h-12 rounded-full flex items-center justify-center opacity-10 group-hover:opacity-20 transition-opacity">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path>
              </svg>
            </div>
          </GlassCard>
        ))}
      </div>
    </section>
  );
};

export default Education;
