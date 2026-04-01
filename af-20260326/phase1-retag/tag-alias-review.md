# Tag Alias Review

- generatedAt: 2026-03-26T19:33:09.212Z
- sourceSummaryPath: af-20260326/phase1-retag/summary-sheet.json
- totalGroups: 9

## alias-group-001: llm

- heuristics: pluralization-variation
- suggestedCanonicalKey: llm
- suggestedCanonicalLabel: Llm
- ai.status: alias
- ai.confidence: high
- ai.recommended: llm / Llm
- ai.rationaleJa: 提供されたヒューリスティクス（pluralization-variation）に基づき、「llm」と「llms」は単数形と複数形のバリエーションであるため、同じ概念のエイリアスと判断されます。そのため、「llm」が推奨される正規キーであり、「Llm」が推奨される正規ラベルです。
- ai.cautionJa: 既存のタグ「llm」のラベルが「LLM」であるため、推奨される「Llm」との大文字・小文字の違いについて、今後の正規化処理で整合性を検討する必要があります。

| key | label | source_type | article_count | seen_count | note |
| --- | --- | --- | --- | --- | --- |
| llm | LLM | current-tag | 4121 |  |  |
| llms | Llms | new-tag-candidate |  | 67 | Between the Layers Lies the Truth: Uncertainty Estimation in LLMs Using Intra-Layer Local Information Scores |

## alias-group-002: huggingface

- heuristics: separator-variation
- suggestedCanonicalKey: huggingface
- suggestedCanonicalLabel: Huggingface
- ai.status: alias
- ai.confidence: high
- ai.recommended: huggingface / Huggingface
- ai.rationaleJa: 複数の表記「hugging face」と「huggingface」が存在し、後者の「huggingface」がより多くの記事数で使用されているため、こちらを正規キーとして推奨します。
- ai.cautionJa: システム内で「hugging face」表記がまだ使用されている可能性があり、正規化が必要になる場合があります。

| key | label | source_type | article_count | seen_count | note |
| --- | --- | --- | --- | --- | --- |
| hugging face | Hugging Face | current-tag | 417 |  |  |
| huggingface | Hugging Face | current-tag | 758 |  |  |

## alias-group-003: transformer

- heuristics: pluralization-variation
- suggestedCanonicalKey: transformer
- suggestedCanonicalLabel: Transformer
- ai.status: alias
- ai.confidence: high
- ai.recommended: transformer / Transformer
- ai.rationaleJa: 「transformer」と「transformers」は、単数形と複数形の関係にあり、同一の概念を指している可能性が非常に高いため、エイリアスとして扱います。
- ai.cautionJa: 「transformer」が文脈によって異なる意味を持つ可能性がないか、必要に応じて詳細な内容を確認してください。例：電気機器のトランスフォーマーなど。

| key | label | source_type | article_count | seen_count | note |
| --- | --- | --- | --- | --- | --- |
| transformer | transformer | new-tag-candidate |  | 34 | Weber's Law in Transformer Magnitude Representations: Efficient Coding, Representational Geometry, and Psychophysical Laws in Language Models |
| transformers | Transformers | new-tag-candidate |  | 14 | BitSkip: An Empirical Analysis of Quantization and Early Exit Composition in Transformers |

## alias-group-004: vlm

- heuristics: pluralization-variation
- suggestedCanonicalKey: vlm
- suggestedCanonicalLabel: Vlm
- ai.status: alias
- ai.confidence: high
- ai.recommended: vlm / Vlm
- ai.rationaleJa: 「vlm」と「vlms」は同じ概念を指し、「vlms」は複数形です。「pluralization-variation」ヒューリスティックに基づき、「vlm」を正規キーとして推奨します。
- ai.cautionJa: 単純な複数形であるため、特記事項はありません。

| key | label | source_type | article_count | seen_count | note |
| --- | --- | --- | --- | --- | --- |
| vlm | vlm | new-tag-candidate |  | 22 | Understanding Pruning Regimes in Vision-Language Models Through Domain-Aware Layer Selection |
| vlms | Vlms | new-tag-candidate |  | 10 | Medical Image Spatial Grounding with Semantic Sampling |

## alias-group-005: mllm

- heuristics: pluralization-variation
- suggestedCanonicalKey: mllms
- suggestedCanonicalLabel: Mllms
- ai.status: alias
- ai.confidence: high
- ai.recommended: mllms / Mllms
- ai.rationaleJa: 単数形と複数形のバリエーションであるため、より一般的な複数形を正規として推奨します。
- ai.cautionJa: 特になし

| key | label | source_type | article_count | seen_count | note |
| --- | --- | --- | --- | --- | --- |
| mllm | Mllm | new-tag-candidate |  | 8 | ACT as Human: Multimodal Large Language Model Data Annotation with Critical Thinking |
| mllms | mllms | new-tag-candidate |  | 9 | Predictive Regularization Against Visual Representation Degradation in Multimodal Large Language Models |

## alias-group-006: dynamic

- heuristics: pluralization-variation
- suggestedCanonicalKey: dynamics
- suggestedCanonicalLabel: Dynamics
- ai.status: alias
- ai.confidence: high
- ai.recommended: dynamics / Dynamics
- ai.rationaleJa: 「dynamic」と「dynamics」は複数形の違いであるため、エイリアスとして扱います。
- ai.cautionJa: この自動判定は、単語の複数形ルールに基づいています。文脈によっては別の意味を持つ可能性があるため、最終確認を推奨します。

| key | label | source_type | article_count | seen_count | note |
| --- | --- | --- | --- | --- | --- |
| dynamic | dynamic | new-tag-candidate |  | 5 | DIP: Efficient Large Multimodal Model Training with Dynamic Interleaved Pipeline |
| dynamics | dynamics | new-tag-candidate |  | 8 | Generalizing Dynamics Modeling More Easily from Representation Perspective |

## alias-group-007: kernel

- heuristics: pluralization-variation
- suggestedCanonicalKey: kernel
- suggestedCanonicalLabel: Kernel
- ai.status: error
- ai.confidence: low
- ai.recommended: - / -
- ai.rationaleJa: Gemini 実行失敗: spawnSync powershell.exe ETIMEDOUT
- ai.cautionJa: CLI 実行エラーのため手動確認が必要です。

| key | label | source_type | article_count | seen_count | note |
| --- | --- | --- | --- | --- | --- |
| kernel | kernel | new-tag-candidate |  | 7 | A Kernel Space-based Multidimensional Sparse Model for Dynamic PET Image Denoising |
| kernels | Kernels | new-tag-candidate |  | 7 | Bases of Steerable Kernels for Equivariant CNNs: From 2D Rotations to the Lorentz Group |

## alias-group-008: pinn

- heuristics: pluralization-variation
- suggestedCanonicalKey: pinn
- suggestedCanonicalLabel: Pinn
- ai.status: alias
- ai.confidence: high
- ai.recommended: pinn / Pinn
- ai.rationaleJa: pinnとpinnsは単数形と複数形のバリエーションであり、同じ概念を指しているためエイリアスとして扱います。
- ai.cautionJa: 特になし。

| key | label | source_type | article_count | seen_count | note |
| --- | --- | --- | --- | --- | --- |
| pinn | pinn | new-tag-candidate |  | 5 | Verifiable Error Bounds for Physics-Informed Neural KKL Observers |
| pinns | pinns | new-tag-candidate |  | 5 | Randomness and signal propagation in physics-informed neural networks (PINNs): A neural PDE perspective |

## alias-group-009: pde

- heuristics: pluralization-variation
- suggestedCanonicalKey: pde
- suggestedCanonicalLabel: Pde
- ai.status: review
- ai.confidence: low
- ai.recommended: - / -
- ai.rationaleJa: 
- ai.cautionJa: 

| key | label | source_type | article_count | seen_count | note |
| --- | --- | --- | --- | --- | --- |
| pde | pde | new-tag-candidate |  | 4 | Randomness and signal propagation in physics-informed neural networks (PINNs): A neural PDE perspective |
| pdes | pdes | new-tag-candidate |  | 4 | FastLSQ: Solving PDEs in One Shot via Fourier Features with Exact Analytical Derivatives |
