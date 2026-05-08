import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultsView } from '../ResultsView';

const sample = {
  optimizedResume: 'RESUME CONTENT',
  coverLetter: 'COVER CONTENT',
  interviewPrep: 'INTERVIEW CONTENT',
  raw: 'raw',
};

describe('ResultsView', () => {
  it('shows the resume tab by default', () => {
    render(<ResultsView output={sample} />);
    expect(screen.getByText('RESUME CONTENT')).toBeInTheDocument();
  });

  it('switches to the cover letter tab on click', () => {
    render(<ResultsView output={sample} />);
    fireEvent.click(screen.getByRole('tab', { name: /Cover Letter/i }));
    expect(screen.getByText('COVER CONTENT')).toBeInTheDocument();
  });

  it('switches to the interview prep tab on click', () => {
    render(<ResultsView output={sample} />);
    fireEvent.click(screen.getByRole('tab', { name: /Interview Prep/i }));
    expect(screen.getByText('INTERVIEW CONTENT')).toBeInTheDocument();
  });

  it('shows a placeholder when a section is empty', () => {
    render(
      <ResultsView
        output={{ ...sample, coverLetter: '' }}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: /Cover Letter/i }));
    expect(screen.getByText(/No content for this section/i)).toBeInTheDocument();
  });
});
