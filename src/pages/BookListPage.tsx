import { useState, useMemo } from 'react';
import { Button, Tag, MessagePlugin, Empty } from 'tdesign-react';
import { DeleteIcon, BookIcon, ChevronLeftIcon, ShopIcon } from 'tdesign-icons-react';
import { useNavigate } from 'react-router-dom';
import { BookRecommendItem } from '../types';

interface BookListPageProps {
  items: BookRecommendItem[];
  onRemoveBook: (bookId: string) => void;
  onClearList: () => void;
}

export function BookListPage({ items, onRemoveBook, onClearList }: BookListPageProps) {
  const navigate = useNavigate();
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const toggleCheck = (bookId: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(bookId)) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
  };

  const toggleAll = () => {
    if (checkedIds.size === items.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(items.map(b => b.book_id)));
    }
  };

  const totalPrice = useMemo(() => {
    return items
      .filter(b => checkedIds.has(b.book_id))
      .reduce((sum, b) => sum + b.price, 0);
  }, [items, checkedIds]);

  const handlePurchase = () => {
    if (checkedIds.size === 0) {
      MessagePlugin.warning('请先勾选需要购买的书籍');
      return;
    }
    const selected = items.filter(b => checkedIds.has(b.book_id));
    const titles = selected.map(b => `《${b.title}》`).join('、');
    MessagePlugin.success(`已下单：${titles}，合计 ¥${totalPrice.toFixed(2)}`);
    // 移除已购买的书籍
    selected.forEach(b => onRemoveBook(b.book_id));
    setCheckedIds(new Set());
  };

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部返回栏 */}
        <div
          className="px-4 py-3 border-b flex items-center gap-3 flex-shrink-0"
          style={{ borderColor: 'var(--td-component-border)', backgroundColor: 'var(--td-bg-color-container)' }}
        >
          <Button variant="text" shape="circle" icon={<ChevronLeftIcon />} onClick={() => navigate(-1)} />
          <span className="text-base font-semibold" style={{ color: 'var(--td-text-color-primary)' }}>我的书单</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Empty description="书单还是空的，去和智能客服聊聊找找好书吧！" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 顶部返回栏 */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0"
        style={{ borderColor: 'var(--td-component-border)', backgroundColor: 'var(--td-bg-color-container)' }}
      >
        <div className="flex items-center gap-3">
          <Button variant="text" shape="circle" icon={<ChevronLeftIcon />} onClick={() => navigate(-1)} />
          <span className="text-base font-semibold" style={{ color: 'var(--td-text-color-primary)' }}>
            我的书单
          </span>
          <Tag theme="primary" variant="light" size="small">{items.length} 本</Tag>
        </div>
        <Button
          variant="text"
          theme="danger"
          size="small"
          icon={<DeleteIcon />}
          onClick={() => {
            onClearList();
            MessagePlugin.success('书单已清空');
          }}
        >
          清空书单
        </Button>
      </div>

      {/* 书单列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* 全选 */}
        {items.length > 1 && (
          <div
            className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer"
            style={{ backgroundColor: 'var(--td-bg-color-component)' }}
            onClick={toggleAll}
          >
            <div
              className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                checkedIds.size === items.length ? 'border-transparent' : ''
              }`}
              style={{
                backgroundColor: checkedIds.size === items.length
                  ? 'var(--td-brand-color)'
                  : 'transparent',
                borderColor: checkedIds.size === items.length
                  ? 'var(--td-brand-color)'
                  : 'var(--td-component-border)',
              }}
            >
              {checkedIds.size === items.length && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <span className="text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>
              全选 ({checkedIds.size}/{items.length})
            </span>
          </div>
        )}

        {items.map(book => {
          const isChecked = checkedIds.has(book.book_id);
          return (
            <div
              key={book.book_id}
              className="flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 cursor-pointer hover:shadow-sm"
              style={{
                borderColor: isChecked ? 'var(--td-brand-color)' : 'var(--td-component-border)',
                backgroundColor: isChecked ? 'var(--td-brand-color-light)' : 'var(--td-bg-color-container)',
              }}
              onClick={() => toggleCheck(book.book_id)}
            >
              {/* 勾选 */}
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  isChecked ? 'border-transparent' : ''
                }`}
                style={{
                  backgroundColor: isChecked ? 'var(--td-brand-color)' : 'transparent',
                  borderColor: isChecked ? 'var(--td-brand-color)' : 'var(--td-component-border)',
                }}
              >
                {isChecked && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>

              {/* 封面 */}
              <div
                className="w-14 h-20 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'var(--td-bg-color-page)' }}
              >
                <BookIcon size="22" style={{ color: 'var(--td-text-color-placeholder)' }} />
              </div>

              {/* 信息 */}
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div
                  className="text-sm font-semibold truncate"
                  style={{ color: 'var(--td-text-color-primary)' }}
                  title={book.title}
                >
                  {book.title}
                </div>
                <div className="text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>
                  {book.author || '未知'} · {book.publisher || '未知'}
                </div>
                <div className="flex flex-wrap gap-1">
                  {book.category && (
                    <Tag size="small" variant="light-outline" theme="primary">{book.category}</Tag>
                  )}
                </div>
              </div>

              {/* 价格与删除 */}
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <span className="text-base font-bold" style={{ color: 'var(--td-error-color)' }}>
                  ¥{book.price.toFixed(2)}
                </span>
                <Button
                  variant="text"
                  shape="circle"
                  size="small"
                  theme="danger"
                  icon={<DeleteIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveBook(book.book_id);
                    setCheckedIds(prev => {
                      const next = new Set(prev);
                      next.delete(book.book_id);
                      return next;
                    });
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部结算栏 */}
      <div
        className="px-4 py-3 border-t flex items-center justify-between flex-shrink-0"
        style={{
          borderColor: 'var(--td-component-border)',
          backgroundColor: 'var(--td-bg-color-container)',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>
            已选 {checkedIds.size} 本
          </span>
          {checkedIds.size > 0 && (
            <span
              className="text-lg font-bold"
              style={{ color: 'var(--td-error-color)' }}
            >
              ¥{totalPrice.toFixed(2)}
            </span>
          )}
        </div>
        <Button
          theme="primary"
          size="medium"
          icon={<ShopIcon />}
          disabled={checkedIds.size === 0}
          onClick={handlePurchase}
        >
          立即购买
          {checkedIds.size > 0 && ` (¥${totalPrice.toFixed(2)})`}
        </Button>
      </div>
    </div>
  );
}
