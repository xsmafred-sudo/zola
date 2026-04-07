import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

export const renderAuthComponent = (component: React.ReactElement) => {
  return render(component);
};

export const typeInInput = async (label: string, value: string) => {
  const input = await screen.findByLabelText(label);
  fireEvent.change(input, value);
};

export const clickButton = async (text: string) => {
  const button = await screen.findByText(text);
  fireEvent.click(button);
};

export const waitForElement = async (text: string) => {
  await waitFor(() => screen.getByText(text));
};
