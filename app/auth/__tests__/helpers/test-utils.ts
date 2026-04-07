import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

export const renderAuthComponent = (component: React.ReactElement) => {
  return render(component);
};
