import { useEffect, useRef } from "react";
import { WPIBackground } from "@/components/WPIbackground";
import { HeroSection } from "@/components/hero";

export const Home = () => {
    const clustrmapsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!clustrmapsRef.current) return;
        if (document.getElementById("clustrmaps")) return;
        const script = document.createElement("script");
        script.type = "text/javascript";
        script.id = "clustrmaps";
        script.src =
            "//clustrmaps.com/map_v2.js?d=rWAXjEEyNeDpJ4UwsJmEKYmnriBfG3JeWunmxKLkUrI&cl=ffffff&w=a";
        clustrmapsRef.current.appendChild(script);
    }, []);

    return (
        <div className="min-h-screen text-foreground overflow-x-hidden relative">
            <WPIBackground />
            <main>
                <HeroSection />
                <div className="flex justify-center mt-8">
                    <div ref={clustrmapsRef} style={{ width: 300 }} />
                </div>
            </main>
        </div>
    );
};
