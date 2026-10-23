import type {RequestParams} from '@jetbrains/ring-ui-built/components/http/http';

// ponytail: only the part of the host API that the widgets use; see the YouTrack apps docs for the rest.
export interface HostAPI {
  fetchYouTrack: (relativeURL: string, requestParams: RequestParams) => Promise<unknown>;
  enterConfigMode: () => void;
  exitConfigMode: () => void;
  readConfig: () => Promise<unknown>;
  storeConfig: (config: unknown) => Promise<void>;
}

type YTAppInterface = {
  entity?: {
    id: string;
    type: 'user' | 'article' | 'ticket' | 'project' | 'app';
  };
  widget?: {appId: string};
  register: (appApi?: {onConfigure?: () => void}) => Promise<HostAPI>;
};

declare global {
  const YTApp: YTAppInterface;
}
