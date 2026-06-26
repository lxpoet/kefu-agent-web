import { Button, Tag, MessagePlugin } from 'tdesign-react';
import { AddIcon, CheckCircleFilledIcon, BookIcon } from 'tdesign-icons-react';
import { BookRecommendItem } from '../types';

interface BookRecommendCardProps {
  books: BookRecommendItem[];
  hasBook: (bookId: string) => boolean;
  onAddBook: (book: BookRecommendItem) => void;
}

export function BookRecommendCard({ books, hasBook, onAddBook }: BookRecommendCardProps) {
  if (books.length === 0) return null;

  const handleAdd = (book: BookRecommendItem) => {
    if (hasBook(book.book_id)) {
      MessagePlugin.info('《' + book.title + '》已在您的书单中');
      return;
    }
    onAddBook(book);
    MessagePlugin.success('《' + book.title + '》已添加到我的书单');
  };

  return (
    <div
      className="mx-0 my-2 p-4 rounded-xl border animate-fade-in w-full"
      style={{
        backgroundColor: 'var(--td-bg-color-container)',
        borderColor: 'var(--td-component-border)',
      }}
    >
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: 'rgba(0, 168, 112, 0.1)' }}
        >
          <BookIcon size="16" style={{ color: 'var(--td-success-color)' }} />
        </div>
        <span className="font-medium text-sm" style={{ color: 'var(--td-text-color-primary)' }}>
          为您找到以下书籍
        </span>
        <span className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>
          共 {books.length} 本
        </span>
      </div>

      {/* 书籍卡片横排 */}
      <div
        className="flex gap-3 overflow-x-auto pb-2"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {books.map(book => {
          const isInList = hasBook(book.book_id);
          return (
            <div
              key={book.book_id}
              className="flex-shrink-0 w-56 rounded-lg border p-3 flex flex-col gap-2 transition-all duration-200 hover:shadow-md"
              style={{
                backgroundColor: 'var(--td-bg-color-component)',
                borderColor: isInList ? 'var(--td-success-color)' : 'var(--td-component-border)',
                scrollSnapAlign: 'start',
              }}
            >
              {/* 封面占位 */}
              <div
                className="w-full h-24 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'var(--td-bg-color-page)' }}
              >
                <BookIcon size="28" style={{ color: 'var(--td-text-color-placeholder)' }} />
              </div>

              {/* 书名 */}
              <div
                className="text-sm font-semibold leading-tight line-clamp-2"
                style={{ color: 'var(--td-text-color-primary)' }}
                title={book.title}
              >
                {book.title}
              </div>

              {/* 作者 */}
              <div className="text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>
                {book.author || '未知作者'}
              </div>

              {/* 标签行 */}
              <div className="flex flex-wrap gap-1">
                {book.category && (
                  <Tag size="small" variant="light-outline" theme="primary">{book.category}</Tag>
                )}
                <Tag size="small" variant="light" theme={book.stock > 0 ? 'success' : 'danger'}>
                  {book.stock > 0 ? `库存 ${book.stock}` : '缺货'}
                </Tag>
              </div>

              {/* 价格 */}
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold" style={{ color: 'var(--td-error-color)' }}>
                  ¥{book.price}
                </span>
              </div>

              {/* 操作按钮 */}
              {isInList ? (
                <Button
                  size="small"
                  variant="outline"
                  theme="success"
                  block
                  icon={<CheckCircleFilledIcon />}
                  disabled
                >
                  已在书单中
                </Button>
              ) : (
                <Button
                  size="small"
                  variant="outline"
                  theme="primary"
                  block
                  icon={<AddIcon />}
                  onClick={() => handleAdd(book)}
                  disabled={book.stock <= 0}
                >
                  添加到我的书单
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
