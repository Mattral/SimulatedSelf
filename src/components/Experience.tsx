
import React, { useState } from 'react';
import GlassCard from './GlassCard';

const Experience = () => {
  const [activeTab, setActiveTab] = useState(0);
  
  const experiences = [
    {
      role: "AI Engineer",
      company: "Total",
      period: "JUN 2024 – CURRENT",
      description: "A dynamic role blending Software Development and Machine Learning Operations Engineering, focusing on Generative AI and ML-Model Serving.",
      achievements: [
        "Successfully reduced API costs by thousands per month through optimization of the LLM pipeline, driving significant cost savings.",
        "Designed and developed a white-labeling service from scratch, shifting market competition towards collaboration and creating new business prospects."
      ]
    },
    {
      role: "Programme Support Coordinator",
      company: "BeyondQuantum | Beyond Thinking",
      period: "FEB 2025 – CURRENT",
      description: "",
      achievements: [
        "Provided essential coordination and support for various quantum-focused initiatives, ensuring smooth execution of programs and events.",
        "Assisted in the development of educational content and strategic planning for quantum-related programs."
      ]
    },
    {
      role: "Fellowship Engineer",
      company: "PTTEP",
      period: "APR 2024 – JUL 2024",
      description: "Focused on Instrumentation and Sensors data collection for AIoT solutions, along with compliance in Safety Systems and Ex Zones.",
      achievements: [
        "Collected and processed data from instrumentation and sensors to develop AIoT-based solutions, optimizing system performance and data-driven decision-making.",
        "Contributed to the integration and optimization of control and safety systems for improved operational efficiency and safety.",
        "Ensured adherence to safety systems and Ex Zone compliance, maintaining regulatory standards and mitigating operational risks."
      ]
    },
    {
      role: "Machine Learning Engineer",
      company: "Omdena",
      period: "SEP 2023 – FEB 2024",
      description: "Collaborated on both open-source and private AI projects, contributing to the development and optimization of cutting-edge machine learning solutions.",
      achievements: [
        "Worked on the ML-Ops of a project utilizing deepfake technology to create AI-generated likenesses in films, optimizing model deployment and integration.",
        "Led data preprocessing and feature engineering for a disease detection project utilizing diverse medical images, enhancing model accuracy and data quality from brain scans and X-ray imagery.",
        "Led and collaborated on five high-impact open-source machine learning projects, developing innovative solutions to real-world challenges.",
        "Played a key role in the Omdena Business Hubs Department, streamlining and improving business processes through AI-driven solutions."
      ]
    },
    {
      role: "Open Source Contributor",
      company: "Google Summer of Code",
      period: "2023",
      description: "",
      achievements: [
        "Extension Development using LLM.",
        "Easily accessible AI integration for the Organizational Knowledge base."
      ]
    },
    {
      role: "Developer Intern",
      company: "Accenture",
      period: "DEC 2022 – JAN 2023",
      description: "",
      achievements: [
        "Contributed to an early-stage AI project, recommended by a mentor from Cisco, gaining hands-on experience with cutting-edge technologies.",
        "Enhanced code quality by cleaning, documenting, and implementing unit tests to ensure maintainability and reliability.",
        "Developed a strong understanding of the onboarding process into large-scale codebases, adapting quickly to complex systems and workflows."
      ]
    },
    {
      role: "System Admin & Analyst",
      company: "Snowy",
      period: "DEC 2021 – NOV 2022",
      description: "",
      achievements: [
        "Administered systems and conducted data analysis for Snowy, driving key business insights.",
        "Analyzed trends and customer data to produce actionable reports and predictions, supporting strategic decision-making."
      ]
    },
    {
      role: "Apprentice Electronics Technician",
      company: "Digital Star Electronics",
      period: "2017 – 2018",
      description: "Job Training on Electronics and embedded system programming, Part Time.",
      achievements: []
    }
  ];

  return (
    <section id="experience" className="section-container">
      <h2 className="section-title">Work Experience</h2>
      
      <div className="mt-16 max-w-4xl mx-auto">
        <div className="flex overflow-x-auto space-x-4 mb-8 pb-4 glass-card p-4">
          {experiences.map((exp, index) => (
            <button
              key={index}
              className={`px-4 py-2 whitespace-nowrap rounded-full transition-all ${
                activeTab === index 
                  ? 'bg-primary text-primary-foreground' 
                  : 'hover:bg-white/10'
              }`}
              onClick={() => setActiveTab(index)}
            >
              {exp.company}
            </button>
          ))}
        </div>
        
        <GlassCard className="mt-8 transform transition-all duration-500 animate-fade-in">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="md:w-1/3">
              <div className="badge">{experiences[activeTab].period}</div>
              <h3 className="text-2xl font-bold">{experiences[activeTab].role}</h3>
              <p className="text-lg text-primary">{experiences[activeTab].company}</p>
            </div>
            
            <div className="md:w-2/3">
              {experiences[activeTab].description && (
                <p className="text-muted-foreground mb-4">{experiences[activeTab].description}</p>
              )}
              
              {experiences[activeTab].achievements.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold mb-2">Key Achievements:</h4>
                  <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                    {experiences[activeTab].achievements.map((achievement, index) => (
                      <li key={index}>{achievement}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      </div>
    </section>
  );
};

export default Experience;
