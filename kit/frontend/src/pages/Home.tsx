import { CTA, Features, Footer, Hero, HowItWorks, Impact, Navbar } from "@/sections/Landing";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Impact />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
