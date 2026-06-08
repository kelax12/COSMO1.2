import { describe, it, expect } from 'vitest';
import { buildFaqSchema } from './faq-schema';

describe('buildFaqSchema', () => {
  const items = [
    { question: 'Q1', answer: 'A1' },
    { question: 'Q2', answer: 'A2' },
  ];

  it('produces a schema.org FAQPage envelope', () => {
    const schema = buildFaqSchema(items);
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('FAQPage');
  });

  it('maps each item to a Question with an acceptedAnswer', () => {
    const schema = buildFaqSchema(items);
    expect(schema.mainEntity).toHaveLength(2);
    expect(schema.mainEntity[0]).toEqual({
      '@type': 'Question',
      name: 'Q1',
      acceptedAnswer: { '@type': 'Answer', text: 'A1' },
    });
  });

  it('handles an empty list', () => {
    expect(buildFaqSchema([]).mainEntity).toEqual([]);
  });
});
