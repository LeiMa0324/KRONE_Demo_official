// Kept deliberately short: on the tree pages this bar is fixed to the bottom of the
// viewport, and every pixel it takes is a pixel removed from the visualization.
// --footer-h in index.css is what those pages reserve, so change both together.
export const Footer = () => {
    return (
        <footer className="w-full bg-WPIRed">
            <div className="flex h-[var(--footer-h)] items-center justify-center px-4">
                <p className="font-WPIfont text-xs tracking-wide text-white/85">
                    © 2025 Worcester Polytechnic Institute
                </p>
            </div>
        </footer>
    );
};
