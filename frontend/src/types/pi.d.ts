export interface PiUser {
  uid: string;
  username: string;
}

export interface PiAuthResult {
  accessToken: string;
  user: PiUser;
}

export interface PiPaymentData {
  amount: number;
  memo: string;
  metadata: Record<string, any>;
}

export interface PiPaymentCallbacks {
  onReadyForServerApproval: (paymentId: string) => void;
  onReadyForServerCompletion: (paymentId: string, txid: string) => void;
  onCancel: (paymentId: string) => void;
  onError: (error: Error, payment?: any) => void;
}

export interface PiPaymentResult {
  identifier: string;
  user_uid: string;
  amount: number;
  memo: string;
  status: {
    developer_approved: boolean;
    transaction_verified: boolean;
    developer_completed: boolean;
    cancelled: boolean;
    user_cancelled: boolean;
  };
  to_address: string;
  created_at: string;
  transaction?: {
    txid: string;
    verified: boolean;
    _link: string;
  };
}

export interface PiNetworkInterface {
  init: (config: { version: string; sandbox?: boolean }) => void;
  authenticate: (
    scopes: string[],
    onIncompletePaymentFound?: (payment: any) => void
  ) => Promise<PiAuthResult>;
  createPayment: (
    paymentData: PiPaymentData,
    callbacks: PiPaymentCallbacks
  ) => Promise<any>;
  openShareDialog?: (title: string, message: string) => void;
  isMock?: boolean;
}

declare global {
  interface Window {
    Pi?: PiNetworkInterface;
  }
}
