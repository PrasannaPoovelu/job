import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RegionSelector } from '../RegionSelector';

describe('RegionSelector', () => {
  it('renders the current region and its description', () => {
    render(<RegionSelector value="UK" onChange={() => {}} />);
    const select = screen.getByLabelText('Target Region') as HTMLSelectElement;
    expect(select.value).toBe('UK');
    expect(screen.getByText(/Professional summary/i)).toBeInTheDocument();
  });

  it('calls onChange when a new region is picked', () => {
    const onChange = vi.fn();
    render(<RegionSelector value="USA" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Target Region'), {
      target: { value: 'Europe' },
    });
    expect(onChange).toHaveBeenCalledWith('Europe');
  });

  it('lists all five regions', () => {
    render(<RegionSelector value="USA" onChange={() => {}} />);
    expect(screen.getAllByRole('option')).toHaveLength(5);
  });
});
