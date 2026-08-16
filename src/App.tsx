import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { NavBar } from "./components/navbar";
import { Home } from "./pages/home";
import { About } from "./pages/about"; // Create this page
import { FileUpload } from "./pages/file_upload"; // Create this page
import { VisualizeTree } from "./pages/visualize_tree"; // Create this page
import { VisualizeTable } from "./pages/visualize_table"; // Create this page
import { TrainingProcess } from "./pages/training_process";
import { ErrorPage } from "./pages/error_page"
import { FileProvider } from './FileContext';
import { DatasetProvider, useDataset } from './DatasetContext';
import { KnowledgeBaseViz } from './pages/knowledge_base_viz';
import { CostAnalysis } from './pages/cost_analysis';
import { PipelineProgress } from './components/next_stage';
import { KnowledgeBaseAdditionsProvider } from './KnowledgeBaseAdditions';

// The data pages each carry a good deal of view state -- which sequence is
// selected, which steps have been run, which node the side panel is showing --
// and none of it survives a change of dataset. Keying the routes on the active
// dataset remounts them instead of leaving stale selections pointing at
// sequences the new dataset does not have.
function AppRoutes() {
  const { dataset } = useDataset();

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/file-upload" element={<FileUpload />} />
      <Route path="/visualize-tree" element={<VisualizeTree key={dataset} />} />
      <Route path="/training-process" element={<TrainingProcess key={dataset} />} />
      <Route path="/knowledge-base" element={<KnowledgeBaseViz key={dataset} />} />
      <Route path="/cost-analysis" element={<CostAnalysis key={dataset} />} />
      <Route path="/sequence-tree" element={<VisualizeTable key={dataset} />} />
      <Route path="*" element={<ErrorPage />} />
    </Routes>
  );
}

function App() {
  return (
    <DatasetProvider>
      <KnowledgeBaseAdditionsProvider>
      <FileProvider>
        <Router basename={import.meta.env.BASE_URL}>
          <NavBar />
          {/* Renders the hand-off to the next pipeline stage, only on the
              pipeline pages and only where there is a stage after this one. */}
          <PipelineProgress>
            <AppRoutes />
          </PipelineProgress>
        </Router>
      </FileProvider>
      </KnowledgeBaseAdditionsProvider>
    </DatasetProvider>
  );
}

export default App;
