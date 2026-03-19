import { VisualizeTable } from "./visualize_table";

export const TrainingProcess = () => {
  return (
    <VisualizeTable
      decomposeDataPath="krone_train_decompose.csv"
      sequenceTreeProps={{
        selectStepLabel: "1 Select a training log sequence",
        selectControlLabel: "Select a training sequence:",
        decomposeStepLabel: "2 Decompose",
        topDescriptionText: "Explore how krone hierarchically process the training set of normal log sequences",
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
        dynamicStepDescriptions: {
          initial: "Select one of our provided training log sequence (Normal GT)",
          afterSelect: "Decompose it using the extracted Krone-tree",
          afterDecompose: "Save the status-seqs, i.e., sequence of status nodes and its corresponding log key segment into the training knowledge base, as normal ground-truth for the parent action node.",
          afterStatusSave: "Save the action-seqs, i.e., sequence of action nodes and its corresponding log key segment into the training knowledge base, as normal ground-truth for the parent entity node.",
          afterActionSave: "Save the entity-seqs, i.e., sequence of entity nodes and its corresponding log key segment into the training knowledge base, as normal ground-truth for the root node.",
          afterEntitySave: "Save the entity-seqs, i.e., sequence of entity nodes and its corresponding log key segment into the training knowledge base, as normal ground-truth for the root node.",
        },
      }}
    />
  );
};
