import { useState } from 'react';
import { Button, Radio, Textarea, MessagePlugin, Tag } from 'tdesign-react';
import { CartIcon, CheckCircleIcon, CloseCircleIcon, TimeIcon } from 'tdesign-icons-react';
import { RefundOrderItem } from '../types';
import { authHeaders } from '../hooks/useAuth';

interface RefundConfirmCardProps {
  orders: RefundOrderItem[];
  onClose: () => void;
}

const statusColorMap: Record<string, string> = {
  'paid': 'var(--td-brand-color)',
  'shipped': 'var(--td-success-color)',
  'completed': 'var(--td-text-color-secondary)',
  'refunding': 'var(--td-warning-color)',
};

export function RefundConfirmCard({ orders, onClose }: RefundConfirmCardProps) {
  const [selectedOrder, setSelectedOrder] = useState<string>('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // 获取当前选中订单的详情
  const selectedOrderInfo = orders.find(o => o.order_no === selectedOrder);
  const needsReason = selectedOrderInfo ? !selectedOrderInfo.is_within_7days : false;

  const handleSubmit = async () => {
    if (!selectedOrder) {
      MessagePlugin.warning('请选择需要退款的订单');
      return;
    }
    if (needsReason && !reason.trim()) {
      MessagePlugin.warning('该订单超过7天，请填写退款原因');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/refunds', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          order_no: selectedOrder,
          reason: needsReason ? reason.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSubmitted(true);
        MessagePlugin.success('退款申请已提交，预计 3-5 个工作日处理');
        setTimeout(() => onClose(), 3000);
      } else {
        setError(data.error || '提交退款申请失败，请稍后重试');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      return new Date(isoStr).toLocaleDateString('zh-CN', {
        month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  // 无可退款订单
  if (orders.length === 0) {
    return (
      <div
        className="mx-0 my-2 p-4 rounded-xl border animate-fade-in"
        style={{
          backgroundColor: 'var(--td-bg-color-container)',
          borderColor: 'var(--td-component-border)',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'var(--td-warning-color-1)' }}
          >
            <CartIcon size="16" style={{ color: 'var(--td-warning-color)' }} />
          </div>
          <span className="font-medium text-sm" style={{ color: 'var(--td-text-color-primary)' }}>
            智能退款服务
          </span>
        </div>
        <p className="text-sm mb-3" style={{ color: 'var(--td-text-color-secondary)' }}>
          您最近15天内没有可退款的订单（待付款、已取消和退款中的订单不支持申请退款）。
        </p>
        <Button size="small" variant="text" onClick={onClose}>关闭</Button>
      </div>
    );
  }

  return (
    <div
      className="mx-0 my-2 p-4 rounded-xl border animate-fade-in"
      style={{
        backgroundColor: 'var(--td-bg-color-container)',
        borderColor: 'var(--td-component-border)',
      }}
    >
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: 'rgba(0, 82, 217, 0.08)' }}
        >
          <CartIcon size="16" style={{ color: 'var(--td-brand-color)' }} />
        </div>
        <div>
          <span className="font-medium text-sm" style={{ color: 'var(--td-text-color-primary)' }}>
            智能退款服务
          </span>
          <span className="text-xs ml-2" style={{ color: 'var(--td-text-color-placeholder)' }}>
            请选择需要退款的订单
          </span>
        </div>
      </div>

      {/* 退款政策说明 */}
      <div
        className="flex items-start gap-1.5 mb-3 px-3 py-2 rounded-lg text-xs"
        style={{
          backgroundColor: 'var(--td-brand-color-1)',
          color: 'var(--td-brand-color-7)',
        }}
      >
        <TimeIcon size="13" className="mt-0.5 flex-shrink-0" />
        <span>
          退款政策：<strong>15天内</strong>均可退款 · <strong>7天内</strong>无需填写原因（七天无理由退货）·
          超过7天需填写退款原因
        </span>
      </div>

      {/* 提交成功状态 */}
      {submitted ? (
        <div className="flex items-center gap-2 py-3">
          <CheckCircleIcon size="20" style={{ color: 'var(--td-success-color)' }} />
          <span className="text-sm" style={{ color: 'var(--td-success-color)' }}>
            退款申请已提交成功！我们将在 3-5 个工作日内处理。
          </span>
        </div>
      ) : (
        <>
          {/* 订单选择列表 */}
          <Radio.Group
            value={selectedOrder}
            onChange={(val: string) => {
              setSelectedOrder(val);
              setReason(''); // 切换订单时清空理由
              setError('');
            }}
            className="w-full mb-3"
          >
            <div className="flex flex-col gap-2">
              {orders.map((order) => (
                <label
                  key={order.order_no}
                  className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors"
                  style={{
                    backgroundColor: selectedOrder === order.order_no
                      ? 'rgba(0, 82, 217, 0.04)'
                      : 'var(--td-bg-color-component)',
                    border: selectedOrder === order.order_no
                      ? '1px solid var(--td-brand-color-light)'
                      : '1px solid var(--td-component-border)',
                  }}
                >
                  <Radio value={order.order_no} />
                  <div className="flex-1 min-w-0">
                    {/* 订单头部：编号 + 状态 + 日期 */}
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <code className="text-xs font-mono" style={{ color: 'var(--td-text-color-primary)' }}>
                        {order.order_no}
                      </code>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: `${statusColorMap[order.status] || 'var(--td-text-color-placeholder)'}15`,
                          color: statusColorMap[order.status] || 'var(--td-text-color-placeholder)',
                        }}
                      >
                        {order.status_text}
                      </span>
                      {/* 7天标记 */}
                      <Tag
                        size="small"
                        theme={order.is_within_7days ? 'success' : 'warning'}
                        variant="light"
                      >
                        {order.is_within_7days ? '✓ 7天内·免填理由' : '需填退款原因'}
                      </Tag>
                    </div>

                    {/* 下单时间 */}
                    <div className="text-xs mb-1.5" style={{ color: 'var(--td-text-color-placeholder)' }}>
                      下单时间：{formatDate(order.created_at)}
                    </div>

                    {/* 商品明细 - 书名+作者+数量+单价 */}
                    <div className="flex flex-col gap-0.5 mb-1">
                      {order.items.map(item => (
                        <div key={item.book_id} className="text-xs flex items-center gap-1"
                          style={{ color: 'var(--td-text-color-secondary)' }}>
                          <span className="font-medium">《{item.title}》</span>
                          {item.author && (
                            <span style={{ color: 'var(--td-text-color-placeholder)' }}>
                              {item.author}
                            </span>
                          )}
                          <span>×{item.quantity}</span>
                          <span style={{ color: 'var(--td-text-color-placeholder)' }}>
                            ¥{item.unit_price.toFixed(2)}/件
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* 总价 */}
                    <div className="text-sm font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
                      退款金额：<span style={{ color: 'var(--td-error-color)' }}>¥{order.total_amount.toFixed(2)}</span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </Radio.Group>

          {/* 退款原因输入区 - 仅7天后的订单显示，且为必填 */}
          {selectedOrderInfo && (
            needsReason ? (
              <div className="mb-3">
                <div className="flex items-center gap-1 mb-1.5 text-xs" style={{ color: 'var(--td-warning-color)' }}>
                  <TimeIcon size="12" />
                  <span>该订单已超过7天，需要填写退款原因才能提交</span>
                </div>
                <Textarea
                  placeholder="请输入退款原因，如：质量问题、买错了、不符合描述等（必填）"
                  value={reason}
                  onChange={(val) => setReason(String(val))}
                  maxlength={200}
                  autosize={{ minRows: 2, maxRows: 3 }}
                />
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5 mb-3 px-3 py-2 rounded-lg text-xs"
                style={{
                  backgroundColor: 'var(--td-success-color-1)',
                  color: 'var(--td-success-color-7)',
                }}
              >
                <CheckCircleIcon size="13" />
                <span>7天无理由退货，无需填写退款原因，可直接提交</span>
              </div>
            )
          )}

          {/* 错误提示 */}
          {error && (
            <div className="flex items-center gap-1.5 mb-3">
              <CloseCircleIcon size="14" style={{ color: 'var(--td-error-color)' }} />
              <span className="text-xs" style={{ color: 'var(--td-error-color)' }}>{error}</span>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2 justify-end">
            <Button size="small" variant="outline" onClick={onClose}>取消</Button>
            <Button
              size="small"
              theme="primary"
              loading={submitting}
              disabled={!selectedOrder || (needsReason && !reason.trim())}
              onClick={handleSubmit}
            >
              提交退款申请
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
