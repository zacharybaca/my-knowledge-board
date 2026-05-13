import { FetcherProvider } from './Fetcher/FetcherProvider';
import { AuthProvider } from './Auth/AuthProvider';
import { CompanyProvider } from './Companies/CompanyProvider';

export const AppProvider = ({ children }) => {
  return (
    <FetcherProvider>
      <AuthProvider>
        <CompanyProvider>{children}</CompanyProvider>
      </AuthProvider>
    </FetcherProvider>
  );
};
