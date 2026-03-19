import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { withBase } from "@/lib/base-url"

// CONSTANTS
const KRONE_desc =
    "KRONE is a hierarchical log analysis framework that reconstructs execution structures from flat logs and enables modular, multi-level anomaly detection. By combining symbolic decomposition with selective LLM reasoning, KRONE achieves scalable and interpretable detection while drastically reducing LLM usage through caching and hybrid inference. Extensive experiments demonstrate significant improvements in accuracy, efficiency, and explainability over existing methods."

const PAPER_URL = import.meta.env.VITE_PAPER_URL || "https://arxiv.org/pdf/2602.07303"
const KRONE_CODE_URL = import.meta.env.VITE_KRONE_CODE_URL || "https://github.com/LeiMa0324/Krone_official"
const DEMO_GITHUB_URL = import.meta.env.VITE_DEMO_GITHUB_URL || "https://github.com/LeiMa0324/KRONE_Demo_official"
const BIBTEX = `@misc{ma2026kronehierarchicalmodularlog,
      title={KRONE: Hierarchical and Modular Log Anomaly Detection}, 
      author={Lei Ma and Jinyang Liu and Tieying Zhang and Peter M. VanNostrand and Dennis M. Hofmann and Lei Cao and Elke A. Rundensteiner and Jianjun Chen},
      year={2026},
      eprint={2602.07303},
      archivePrefix={arXiv},
      primaryClass={cs.DB},
      url={https://arxiv.org/abs/2602.07303}, 
}`

const teamMembers = [
    {
        name: "Lei Ma",
        affiliation: "Worcester Polytechnic Institute",
        role: "PhD Student (Main Author)",
        image_path: "team_members/lei_m.png",
        linkedin_url: "https://leima0324.github.io/",
    },
    {
        name: "Elke Rundensteiner",
        affiliation: "Worcester Polytechnic Institute",
        role: "Head of Data Science and AI",
        image_path: "team_members/elke_r.jpg",
        linkedin_url: "https://daisy.wpi.edu/",
    },
    {
        name: "Peter VanNostrand",
        affiliation: "Worcester Polytechnic Institute",
        role: "PhD Student",
        image_path: "team_members/peter_v.png",
        linkedin_url: "https://petervannostrand.github.io/",
    },
    {
        name: "Dennis Hofmann",
        affiliation: "Worcester Polytechnic Institute",
        role: "PhD Student",
        image_path: "team_members/dennis.jpeg",
        linkedin_url: "https://www.planethofmann.com/dennis/index.html#main",
    },
    {
        name: "Suhani Chaudhary",
        affiliation: "UC Riverside",
        role: "Visiting Undergraduate Summer Researcher",
        image_path: "team_members/suhani_c.jpeg",
        linkedin_url: "https://www.linkedin.com/in/suhani-chaudhary-25a476244/",
    },
    {
        name: "Ethan Shanbaum",
        affiliation: "Worcester Polytechnic Institute",
        role: "Summer Undergraduate Researcher",
        image_path: "team_members/ethan.jpg",
        linkedin_url: "https://www.linkedin.com/in/ethan-shanbaum/",
    },
    {
        name: "Athanasios Tassiadamis",
        affiliation: "University of Nevada, Las Vegas",
        role: "Visiting Undergraduate Summer Researcher",
        image_path: "team_members/thanos_park.jpg",
        linkedin_url: "https://www.linkedin.com/in/athanasios-t-8a17b4294/",
    },
]

// GRID COMPONENT
function TeamGrid() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full px-4 sm:px-8 md:px-16 lg:px-24">
            {teamMembers.map((member, index) => (
                <a
                    key={index}
                    href={member.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block transform transition-transform duration-300 hover:scale-105"
                >
                    <Card className="h-full cursor-pointer shadow-md hover:shadow-xl">
                        <CardContent className="flex flex-col h-full items-center justify-between p-4">
                            <div className="flex-grow flex items-center justify-center w-full">
                                <img
                                    className="object-contain h-48 w-full rounded-xl"
                                    src={withBase(member.image_path)}
                                    alt={member.name}
                                />
                            </div>
                            <span className="text-lg font-WPIfont font-semibold text-center mt-4">
                                {member.name}
                            </span>
                            <div className="mt-2 space-y-1 px-2 text-center font-WPIfont text-sm text-gray-700">
                                <p className="font-semibold">{member.affiliation}</p>
                                <p>{member.role}</p>
                            </div>
                        </CardContent>
                    </Card>
                </a>
            ))}
        </div>
    )
}


// ABOUT SECTION
export const About = () => {
    const [isCiteDialogOpen, setIsCiteDialogOpen] = useState(false)

    return (
        <div className="bg-white overflow-x-hidden">
            <div className="pt-[4.5rem]" />
            <div className="flex flex-col w-full min-h-screen bg-white py-6 px-4 sm:px-8 md:px-16 lg:px-24">
                <div className="flex flex-col bg-WPIRed h-fit rounded-4xl items-center py-12 animate-fade-in-fast w-full space-y-6">
                    <div className="font-WPIfont font-bold text-3xl text-gray-100 text-center">
                        How KRONE Works
                    </div>

                    <p className="w-full font-WPIfont text-white px-4 sm:px-8 md:px-16 lg:px-32 text-left">
                        {KRONE_desc}
                    </p>

                    <div className="w-full px-4 sm:px-8 md:px-16 lg:px-32 flex flex-wrap justify-start gap-3">
                        <div className="w-full space-y-5">
                            <div>
                                <div className="mb-3 text-left font-WPIfont text-lg font-semibold text-white">
                                    KRONE Full Paper (ICDE 26)
                                </div>
                                <div className="flex flex-wrap justify-start gap-3">
                                    <Button variant="outline" className="font-WPIfont" asChild>
                                        <a href={PAPER_URL} target="_blank" rel="noopener noreferrer">
                                            Read the Paper
                                        </a>
                                    </Button>
                                    <Button variant="outline" className="font-WPIfont" onClick={() => setIsCiteDialogOpen(true)}>
                                        Cite the Paper
                                    </Button>
                                    <Button variant="outline" className="font-WPIfont" asChild>
                                        <a href={KRONE_CODE_URL} target="_blank" rel="noopener noreferrer">
                                            GitHub
                                        </a>
                                    </Button>
                                </div>
                            </div>
                            <div>
                                <div className="mb-3 text-left font-WPIfont text-lg font-semibold text-white">
                                    KRONE Demo Paper
                                </div>
                                <div className="flex flex-wrap justify-start gap-3">
                                    <Button variant="outline" className="font-WPIfont" disabled>
                                        Read the Paper
                                    </Button>
                                    <Button variant="outline" className="font-WPIfont" disabled>
                                        Cite the Paper
                                    </Button>
                                    <Button variant="outline" className="font-WPIfont" asChild>
                                        <a href={DEMO_GITHUB_URL} target="_blank" rel="noopener noreferrer">
                                            GitHub
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="font-WPIfont font-bold text-3xl text-gray-100 text-center pt-6">
                        Meet The Team
                    </div>

                    {/* Team Grid */}
                    <TeamGrid />
                </div>
            </div>
            <Dialog open={isCiteDialogOpen} onOpenChange={setIsCiteDialogOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="font-WPIfont">BibTeX</DialogTitle>
                    </DialogHeader>
                    <pre className="overflow-x-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
                        {BIBTEX}
                    </pre>
                </DialogContent>
            </Dialog>
            <Footer />
        </div>
    )
}
