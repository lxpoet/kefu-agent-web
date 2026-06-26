import { useState } from 'react';
import { Button, Textarea, Dialog } from 'tdesign-react';
import { StarIcon } from 'tdesign-icons-react';

interface SatisfactionRatingProps {
  sessionId: string;
  visible: boolean;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => void;
}

const ratingLabels = ['', '非常不满意', '不满意', '一般', '满意', '非常满意'];
const ratingColors = ['', '#f56c6c', '#e6a23c', '#909399', '#67c23a', '#409eff'];

export function SatisfactionRating({ sessionId, visible, onClose, onSubmit }: SatisfactionRatingProps) {
  const [hoveredRating, setHoveredRating] = useState(0);
  const [selectedRating, setSelectedRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedRating) return;
    setSubmitting(true);
    try {
      await fetch('/api/satisfaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, rating: selectedRating, comment }),
      });
      onSubmit(selectedRating, comment);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const displayRating = hoveredRating || selectedRating;

  return (
    <Dialog
      header="对本次服务进行评价"
      visible={visible}
      onClose={onClose}
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>跳过</Button>
          <Button
            theme="primary"
            disabled={!selectedRating || submitting}
            loading={submitting}
            onClick={handleSubmit}
          >
            提交评价
          </Button>
        </div>
      }
    >
      <div className="py-4">
        <p className="text-center mb-4" style={{ color: 'var(--td-text-color-secondary)' }}>
          您对本次智能客服的服务满意度如何？
        </p>

        {/* 星级评分 */}
        <div className="flex justify-center gap-2 mb-3">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              className="transition-transform hover:scale-110 focus:outline-none"
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              onClick={() => setSelectedRating(star)}
            >
              <StarIcon
                size="32"
                style={{
                  color: star <= displayRating
                    ? (ratingColors[displayRating] || '#faad14')
                    : 'var(--td-component-border)',
                  fill: star <= displayRating ? 'currentColor' : 'none',
                  transition: 'color 0.2s',
                }}
              />
            </button>
          ))}
        </div>

        {/* 评分文字 */}
        <p
          className="text-center text-sm mb-4 h-5 transition-all"
          style={{ color: displayRating ? ratingColors[displayRating] : 'transparent' }}
        >
          {displayRating ? ratingLabels[displayRating] : '请选择'}
        </p>

        {/* 评论输入 */}
        <Textarea
          placeholder="请输入您的宝贵意见（选填）"
          value={comment}
          onChange={(val) => setComment(String(val))}
          autosize={{ minRows: 2, maxRows: 4 }}
        />
      </div>
    </Dialog>
  );
}
