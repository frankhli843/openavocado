/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { FormulaBlock } from "../components/lesson/FormulaBlock";

describe("FormulaBlock", () => {
  it("renders structured lesson formulas with KaTeX instead of plaintext only", () => {
    const { container } = render(
      <FormulaBlock
        block={{
          type: "formula",
          latex:
            "H_{\\text{after-attn}} = H_{\\text{input}} + \\operatorname{Attention}(\\operatorname{LayerNorm}(H_{\\text{input}}))",
          plain_english:
            "The attention sublayer adds an attention update to the hidden-state matrix that entered the block.",
          variables: [
            {
              symbol: "H_{\\text{input}}",
              meaning: "hidden-state matrix entering the block",
              shape: "L x d_model",
            },
            {
              symbol: "H_{\\text{after-attn}}",
              meaning: "hidden-state matrix after the attention residual add",
              shape: "L x d_model",
            },
          ],
        }}
      />
    );

    expect(container.querySelector(".katex-display")).toBeInTheDocument();
    expect(container.querySelector(".katex-html")).toBeInTheDocument();
    expect(container).not.toHaveTextContent("H_{\\text{after-attn}} =");
    expect(screen.getByText(/attention sublayer adds/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Variable: H_{\\text{input}}")).toBeInTheDocument();
    expect(screen.getByLabelText("Variable: H_{\\text{after-attn}}")).toBeInTheDocument();
    expect(container).not.toHaveTextContent("H_{\\text{input}}");
    expect(screen.getAllByText(/L x d_model/)).toHaveLength(2);
  });

  it("normalizes unsupported highlight wrappers before rendering KaTeX", () => {
    const { container } = render(
      <FormulaBlock
        block={{
          type: "formula",
          latex:
            String.raw`H_{\text{after-attn}} = \colorbox{#dbeafe}{H_{\text{input}}} + \colorbox{#dbeafe}{\operatorname{Attention}}(\colorbox{#dbeafe}{\operatorname{LayerNorm}}(\colorbox{#dbeafe}{H_{\text{input}}}))`,
          plain_english:
            "The attention sublayer normalizes the input hidden state, computes an attention update, and adds that update back to the input.",
          variables: [
            {
              symbol: "H_{\\text{input}}",
              meaning: "hidden-state matrix entering the block",
              shape: "L x d_model",
            },
          ],
        }}
      />
    );

    expect(container.querySelector(".katex-display")).toBeInTheDocument();
    expect(container.innerHTML).not.toContain("katex-error");
    expect(container.innerHTML).not.toContain("colorbox");
    expect(container).not.toHaveTextContent("\\colorbox");
  });
});
