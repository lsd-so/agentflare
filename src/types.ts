import { BrowserContainer, ComputerContainer } from "./containers";

export type AppBindings = {
  BROWSER_CONTAINER: DurableObjectNamespace<BrowserContainer>;
  COMPUTER_CONTAINER: DurableObjectNamespace<ComputerContainer>;
  ASSETS: {
    fetch: (request: Request) => Promise<Response>
  };
};
