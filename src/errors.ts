/**
 * Base error class for all BMKG API errors.
 */
export class BMKGError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "BMKGError";
    Object.setPrototypeOf(this, BMKGError.prototype);
  }
}

/**
 * Error thrown when a network request fails.
 */
export class BMKGNetworkError extends BMKGError {
  constructor(message: string, public readonly cause?: Error) {
    super(message, undefined, "NETWORK_ERROR");
    this.name = "BMKGNetworkError";
    Object.setPrototypeOf(this, BMKGNetworkError.prototype);
  }
}

/**
 * Error thrown when a request times out.
 */
export class BMKGTimeoutError extends BMKGError {
  constructor(message: string = "Request timed out") {
    super(message, undefined, "TIMEOUT");
    this.name = "BMKGTimeoutError";
    Object.setPrototypeOf(this, BMKGTimeoutError.prototype);
  }
}

/**
 * Error thrown when response parsing fails.
 */
export class BMKGParseError extends BMKGError {
  constructor(
    message: string,
    public readonly rawResponse?: string
  ) {
    super(message, undefined, "PARSE_ERROR");
    this.name = "BMKGParseError";
    Object.setPrototypeOf(this, BMKGParseError.prototype);
  }
}

/**
 * Error thrown when input validation fails.
 */
export class BMKValidationError extends BMKGError {
  constructor(message: string) {
    super(message, undefined, "VALIDATION_ERROR");
    this.name = "BMKValidationError";
    Object.setPrototypeOf(this, BMKValidationError.prototype);
  }
}