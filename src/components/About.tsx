
import React from 'react';
import GlassCard from './GlassCard';

const About = () => {
  const skills = [
    { name: 'Machine Learning', level: 95 },
    { name: 'Deep Learning', level: 90 },
    { name: 'MLOps', level: 88 },
    { name: 'Data Science', level: 92 },
    { name: 'AI Solutions', level: 94 },
    { name: 'Python', level: 96 },
    { name: 'LLM Integration', level: 85 },
    { name: 'Software Engineering', level: 88 },
    { name: 'AIoT', level: 80 },
  ];

  return (
    <section id="about" className="section-container relative">
      <h2 className="section-title">About Me</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mt-16">
        <div className="space-y-6">
          <GlassCard className="h-full">
            <h3 className="text-2xl font-bold mb-4">Professional Profile</h3>
            <p className="text-muted-foreground leading-relaxed">
              I'm a Machine Learning Engineer with a passion for developing AI-driven solutions 
              to complex problems. My expertise spans across various domains of artificial 
              intelligence including deep learning, MLOps, and AI integration into existing systems.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              With a strong background in both theoretical machine learning concepts and 
              practical implementation, I've contributed to diverse projects ranging from 
              AIoT solutions to deepfake technology and medical image analysis.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              My goal is to leverage cutting-edge AI technologies to create solutions that 
              make meaningful impacts in the real world while maintaining ethical standards 
              and pushing the boundaries of what's possible with artificial intelligence.
            </p>
          </GlassCard>
        </div>
        
        <div>
          <GlassCard className="h-full">
            <h3 className="text-2xl font-bold mb-6">Skills & Expertise</h3>
            <div className="space-y-4">
              {skills.map((skill) => (
                <div key={skill.name} className="space-y-2">
                  <div className="flex justify-between">
                    <span>{skill.name}</span>
                    <span>{skill.level}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${skill.level}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </section>
  );
};

export default About;
