export interface GeneratedDoc {
  filename: string;
  timestamp: string;
  size?: string;
  url: string;
}

export interface PresetTemplate {
  id: string;
  titleFa: string;
  titleEn: string;
  category: 'physics' | 'calculus' | 'algebra' | 'statistics' | 'mixed';
  desc: string;
  content: string;
}

export interface MathFormulaToken {
  type: 'text' | 'inline-math' | 'display-math' | 'code';
  content: string;
  error?: string;
}

export interface GenerateResponse {
  success: boolean;
  filename?: string;
  filepath?: string;
  message?: string;
  error?: string;
}

export type ColumnAlignment = 'center' | 'left' | 'right';

export type LatexArrayEnvironment =
  | 'array'
  | 'pmatrix'
  | 'bmatrix'
  | 'matrix'
  | 'vmatrix'
  | 'cases'
  | 'tabular';

export interface LatexArrayWizardConfig {
  environment: LatexArrayEnvironment;
  rows: number;
  cols: number;
  alignments: ColumnAlignment[];
  hasVerticalBorders: boolean;
  hasHorizontalBorders: boolean;
  data: string[][];
}

export interface MarkdownTablePreset {
  id: string;
  titleFa: string;
  descFa: string;
  headers: string[];
  alignments: ColumnAlignment[];
  rows: string[][];
}
