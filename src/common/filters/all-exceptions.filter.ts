import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<{ url: string }>();
    const response = context.getResponse<{
      status: (code: number) => { json: (body: unknown) => void };
    }>();

    console.error(exception);

    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const exceptionBody =
      exception instanceof HttpException
        ? this.getHttpExceptionResponse(exception)
        : { message: 'Internal server error' };
    const path = request.url.split('?')[0];
    const module = path.split('/').filter(Boolean)[0] ?? 'app';

    response.status(statusCode).json({
      ...exceptionBody,
      statusCode,
      module,
      timestamp: new Date().toISOString(),
    });
  }

  private getHttpExceptionResponse(exception: HttpException): object {
    const exceptionResponse = exception.getResponse();

    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      !Array.isArray(exceptionResponse)
    ) {
      return exceptionResponse;
    }

    return { message: exceptionResponse };
  }
}
