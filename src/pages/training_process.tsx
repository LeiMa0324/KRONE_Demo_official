import { VisualizeTable } from "./visualize_table";

export const TrainingProcess = () => {
  return (
    <VisualizeTable
      decomposeDataPath="krone_train_decompose.csv"
      sequenceTreeProps={{
        selectStepLabel: "1 Select a training log sequence",
        selectControlLabel: "Select a training sequence:",
        decomposeStepLabel: "2 Decompose",
        hideDetectAndExplainSteps: true,
        singleSequenceSectionTitle: "Single Sequence",
        batchProcessingSectionTitle: "Batch Processing",
        batchProcessingButtonLabel: "Process all training sequences",
        knowledgeBaseActionButtons: [
          {
            id: "status-seq",
            label: "3 Save status-seq into Knowledge Base",
            toastMessage: "status-seq has been added to knowledge base!",
          },
          {
            id: "action-seq",
            label: "4 Save action-seq into Knowledge Base",
            toastMessage: "action-seq has been added to knowledge base!",
          },
          {
            id: "entity-seq",
            label: "5 Save entity-seq into Knowledge Base",
            toastMessage: "entity-seq has been added to knowledge base!",
          },
        ],
      }}
    />
  );
};
