export type AssistantName = 'Larry' | 'Arlynn';

export interface AssistantInfo {
  name: AssistantName;
  role: string;
  oneLineDescription: string;
}

export const assistants: AssistantInfo[] = [
  {
    name: 'Larry',
    role: 'Single sermon or lesson helper',
    oneLineDescription:
      'Larry helps you draft a single sermon or lesson, turning your Scripture passage and notes into a clear message.',
  },
  {
    name: 'Arlynn',
    role: 'Multi-week series planning helper',
    oneLineDescription:
      'Arlynn helps you plan a multi-week series, shaping each week into one clear path for your church or class.',
  },
];

export default assistants;
