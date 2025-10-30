declare module 'mammoth/mammoth.browser' {
  interface ConvertToHtmlResult {
    value: string;
    messages: any[];
  }

  interface ConvertToHtmlOptions {
    arrayBuffer: ArrayBuffer;
  }

  function convertToHtml(options: ConvertToHtmlOptions): Promise<ConvertToHtmlResult>;

  export { convertToHtml };
}

declare module 'mammoth' {
  interface ConvertToHtmlResult {
    value: string;
    messages: any[];
  }

  interface ConvertToHtmlOptions {
    arrayBuffer: ArrayBuffer;
  }

  function convertToHtml(options: ConvertToHtmlOptions): Promise<ConvertToHtmlResult>;

  export { convertToHtml };
}