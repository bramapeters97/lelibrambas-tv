export class GatewayError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly headers?: HeadersInit,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

export class ConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}
