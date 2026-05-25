import { FetcherProvider } from './Fetcher/FetcherProvider';
import { AuthProvider } from './Auth/AuthProvider';
import { SocketProvider } from './Socket/SocketProvider';
import { CompanyProvider } from './Companies/CompanyProvider';

export const AppProvider = ({ children }) => {
  return (
    <FetcherProvider>
      <AuthProvider>
        <SocketProvider>
          <CompanyProvider>{children}</CompanyProvider>
        </SocketProvider>
      </AuthProvider>
    </FetcherProvider>
  );
};
