import { withBase } from "@/lib/base-url";

export const WPIBackground = () => {
    return (
        <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
            <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${withBase("WPI_FALL_CAMPUS_BACKGROUND.webp")})` }}
            />
            {/* The photo is high-chroma autumn foliage in the same hue family as WPI red,
                so the brand block and the body copy both sink into it. This scrim pushes
                the photo back far enough for white text to hold contrast on its own. */}
            <div
                className="absolute inset-0"
                style={{
                    background:
                        "linear-gradient(180deg, rgba(24,14,16,0.62) 0%, rgba(24,14,16,0.44) 38%, rgba(24,14,16,0.72) 100%)",
                }}
            />
        </div>
    );
}
