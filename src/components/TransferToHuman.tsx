import { Button } from 'tdesign-react';
import { UserIcon, PhoneLockedIcon } from 'tdesign-icons-react';

interface TransferToHumanProps {
  sessionId: string;
  onTransfer: () => void;
  onDismiss: () => void;
}

export function TransferToHuman({ sessionId, onTransfer, onDismiss }: TransferToHumanProps) {
  const handleTransfer = async () => {
    try {
      await fetch('/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, reason: '用户请求转人工' }),
      });
      onTransfer();
    } catch (e) {
      onTransfer();
    }
  };

  return (
    <div
      className="mx-4 my-2 p-4 rounded-xl border"
      style={{
        backgroundColor: 'var(--td-warning-color-1)',
        borderColor: 'var(--td-warning-color-3)',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: 'var(--td-warning-color-3)' }}
        >
          <UserIcon size="20" style={{ color: 'white' }} />
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm mb-1" style={{ color: 'var(--td-text-color-primary)' }}>
            需要转接人工客服
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--td-text-color-secondary)' }}>
            您的问题比较复杂，建议由人工客服为您提供更专业的帮助。
            当前预计等待时间：<strong>3-5分钟</strong>
          </p>
          <div className="flex gap-2">
            <Button
              size="small"
              theme="warning"
              icon={<PhoneLockedIcon />}
              onClick={handleTransfer}
            >
              立即转人工
            </Button>
            <Button
              size="small"
              variant="outline"
              onClick={onDismiss}
            >
              继续智能服务
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
