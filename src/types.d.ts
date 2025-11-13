import type { IUser } from './models/User';

declare global {
  namespace Express {
    // Merge with Passport's empty User interface
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends IUser {}
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: IUser;
    requestId?: string;
    auditInfo?: {
      action: string;
      resource: string;
      resourceId?: string;
      details?: any;
    };
  }
}

