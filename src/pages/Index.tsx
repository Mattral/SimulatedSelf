import React, { useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import About from '@/components/About';
import Experience from '@/components/Experience';
import Education from '@/components/Education';
import Achievements from '@/components/Achievements';
import Contact from '@/components/Contact';
import StarBackground from '@/components/StarBackground';

const Index = () => {
  useEffect(() => {
    // Reveal animations for sections when they come into view
    const sections = document.querySelectorAll('section');
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-fade-in');
          (entry.target as HTMLElement).style.opacity = '1';
        }
      });
    }, { threshold: 0.1 });
    
    sections.forEach(section => {
      if (section.id !== 'home') {
        (section as HTMLElement).style.opacity = '0';
        observer.observe(section);
      }
    });
    
    return () => {
      sections.forEach(section => {
        observer.unobserve(section);
      });
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <StarBackground density={150} />
      
      <Navbar />
      
      <main>
        <Hero />
        <About />
        <Experience />
        <Education />
        <Achievements />
        <Contact />
      </main>
      
      <footer className="py-8 text-center text-muted-foreground border-t border-border/20 mt-12">
        <div className="container mx-auto px-4">
          <p>© {new Date().getFullYear()} Min Htet Myet. All Rights Reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
