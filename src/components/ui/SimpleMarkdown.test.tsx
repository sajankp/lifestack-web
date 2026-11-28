import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SimpleMarkdown } from './SimpleMarkdown';

describe('SimpleMarkdown', () => {
  it('renders headings, bullets, numbered items, bold and inline code', () => {
    const { container } = render(
      <SimpleMarkdown
        source={'## This week\n\n- Trim **INFY** to `10%`\n- Hold gold\n\n1. First\n2. Second\n'}
      />,
    );
    expect(screen.getByText('This week')).toBeInTheDocument();
    expect(container.querySelectorAll('ul > li')).toHaveLength(2);
    expect(container.querySelectorAll('ol > li')).toHaveLength(2);
    expect(container.querySelector('strong')).toHaveTextContent('INFY');
    expect(container.querySelector('code')).toHaveTextContent('10%');
  });

  it('joins wrapped lines into one paragraph and splits on blank lines', () => {
    const { container } = render(<SimpleMarkdown source={'one\ntwo\n\nthree'} />);
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toHaveTextContent('one two');
  });

  it('never turns report text into markup', () => {
    const { container } = render(
      <SimpleMarkdown source={'<img src=x onerror=alert(1)> and <script>alert(2)</script>'} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container).toHaveTextContent('<img src=x onerror=alert(1)>');
  });

  it('renders nothing but an empty container for an empty note', () => {
    const { container } = render(<SimpleMarkdown source="" />);
    expect(container.querySelectorAll('p,ul,ol')).toHaveLength(0);
  });
});
