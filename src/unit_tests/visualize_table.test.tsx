import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VisualizeTable } from "@/pages/visualize_table";
import { BrowserRouter } from "react-router-dom";
import { DatasetProvider } from "@/DatasetContext";
import csvText from "@/assets/demo_data.csv?raw";
import {vi} from 'vitest';

// Mock fetch with correct typing. ok is needed as well as text: the page checks
// response.ok before parsing, and DatasetProvider fetches manifest.json.
beforeAll(() => {
    global.fetch = vi.fn(() =>
        Promise.resolve({
            ok: true,
            text: () => Promise.resolve(csvText),
            json: () => Promise.resolve({ datasets: [] }),
        })
    ) as unknown as typeof fetch;
});

describe("VisualizeTable Component", () => {
    it("Correctly updates display on Run Option button press", async () => {
        const user = userEvent.setup();

        render(
            <DatasetProvider>
                <BrowserRouter>
                    <VisualizeTable />
                </BrowserRouter>
            </DatasetProvider>
        );

        const button = await screen.findByRole("button", { name: "run button" });

        await user.click(button);

        const prediction = await screen.findByLabelText("prediction");
        expect(["Abnormal", "Normal"]).toContain(prediction.textContent);
    });
});
