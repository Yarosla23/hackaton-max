interface MaxWebApp {
  initData?: string;
  ready?: () => void;
}

interface Window {
  WebApp?: MaxWebApp;
}

