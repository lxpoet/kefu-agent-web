import { useState, useEffect, useCallback } from 'react';
import { Tabs, Tag, Table, Button, Dialog, Form, Input, Textarea, Select, MessagePlugin, Popconfirm, Loading, Empty } from 'tdesign-react';

const { TabPanel } = Tabs;
import { RefreshIcon, DeleteIcon, AddIcon, EditIcon, StarIcon, UserIcon } from 'tdesign-icons-react';

const { FormItem } = Form;

const intentLabelMap: Record<string, string> = {
  refund: '退款申请',
  order: '订单查询',
  tech_support: '技术支持',
  transfer_human: '转人工',
  general: '一般咨询',
};
const intentColorMap: Record<string, 'primary' | 'warning' | 'danger' | 'success' | 'default'> = {
  refund: 'danger',
  order: 'primary',
  tech_support: 'warning',
  transfer_human: 'danger',
  general: 'default',
};
const statusLabelMap: Record<string, string> = {
  open: '进行中',
  closed: '已关闭',
  transferred: '已转人工',
};
const statusColorMap: Record<string, 'primary' | 'warning' | 'danger' | 'success' | 'default'> = {
  open: 'primary',
  closed: 'success',
  transferred: 'warning',
};

interface DashboardStats {
  totalSessions: number;
  openSessions: number;
  transferredSessions: number;
  intentStats: Array<{ intent: string; count: number }>;
  recentSessions: any[];
  satisfactionStats: {
    avg: number;
    total: number;
    distribution: Record<number, number>;
    byIntent: Record<string, number>;
  };
}

interface Faq {
  id: string;
  category: string;
  question: string;
  answer: string;
  tags: string | null;
  usage_count: number;
}

// ============= 数据总览 =============
function DashboardTab({ stats, loading }: { stats: DashboardStats | null; loading: boolean }) {
  if (loading) return <div className="flex justify-center py-20"><Loading /></div>;
  if (!stats) return <Empty description="暂无数据" />;

  const { satisfactionStats, intentStats, totalSessions, openSessions, transferredSessions } = stats;
  const closedRate = totalSessions > 0 ? Math.round(((totalSessions - openSessions) / totalSessions) * 100) : 0;
  const transferRate = totalSessions > 0 ? Math.round((transferredSessions / totalSessions) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      {/* KPI 卡片 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: '总对话数', value: totalSessions, color: '#0052d9', bg: '#e8f0fe' },
          { label: '进行中', value: openSessions, color: '#e6a23c', bg: '#fdf6ec' },
          { label: '已转人工', value: transferredSessions, color: '#f56c6c', bg: '#fef0f0' },
          { label: '满意度评价', value: satisfactionStats.total, color: '#67c23a', bg: '#f0f9eb' },
        ].map(card => (
          <div key={card.label} className="rounded-xl p-4 shadow-sm border" style={{ background: card.bg, borderColor: 'var(--td-component-border)' }}>
            <div className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</div>
            <div className="text-sm mt-1" style={{ color: 'var(--td-text-color-secondary)' }}>{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* 满意度统计 */}
        <div className="rounded-xl p-5 border" style={{ borderColor: 'var(--td-component-border)', background: 'var(--td-bg-color-container)' }}>
          <h3 className="font-semibold text-base mb-4" style={{ color: 'var(--td-text-color-primary)' }}>
            满意度统计
          </h3>
          <div className="flex items-center gap-4 mb-4">
            <div className="text-4xl font-bold" style={{ color: '#faad14' }}>
              {satisfactionStats.avg > 0 ? satisfactionStats.avg.toFixed(1) : '--'}
            </div>
            <div>
              <div className="flex gap-0.5 mb-1">
                {[1, 2, 3, 4, 5].map(s => (
                  <StarIcon key={s} size="18" style={{ color: s <= Math.round(satisfactionStats.avg) ? '#faad14' : '#d9d9d9', fill: s <= Math.round(satisfactionStats.avg) ? '#faad14' : 'none' }} />
                ))}
              </div>
              <div className="text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>共 {satisfactionStats.total} 条评价</div>
            </div>
          </div>
          {/* 评分分布 */}
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map(star => {
              const count = satisfactionStats.distribution[star] || 0;
              const pct = satisfactionStats.total > 0 ? Math.round((count / satisfactionStats.total) * 100) : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span style={{ color: 'var(--td-text-color-secondary)', width: 30 }}>{star} ⭐</span>
                  <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--td-bg-color-component)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: '#faad14' }} />
                  </div>
                  <span style={{ color: 'var(--td-text-color-secondary)', width: 30, textAlign: 'right' }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 意图分布 */}
        <div className="rounded-xl p-5 border" style={{ borderColor: 'var(--td-component-border)', background: 'var(--td-bg-color-container)' }}>
          <h3 className="font-semibold text-base mb-4" style={{ color: 'var(--td-text-color-primary)' }}>
            用户意图分布
          </h3>
          {intentStats.length === 0 ? (
            <Empty description="暂无数据" size="small" />
          ) : (
            <div className="space-y-3">
              {intentStats.map(({ intent, count }) => {
                const pct = totalSessions > 0 ? Math.round((count / totalSessions) * 100) : 0;
                const colors: Record<string, string> = { refund: '#f56c6c', order: '#409eff', tech_support: '#e6a23c', transfer_human: '#f56c6c', general: '#909399' };
                return (
                  <div key={intent}>
                    <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--td-text-color-secondary)' }}>
                      <span>{intentLabelMap[intent] || intent}</span>
                      <span>{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: 'var(--td-bg-color-component)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: colors[intent] || '#409eff' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* 转人工率 */}
          <div className="mt-4 pt-4 border-t flex justify-between text-sm" style={{ borderColor: 'var(--td-component-border)' }}>
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--td-text-color-secondary)' }}>解决率</div>
              <div className="font-semibold" style={{ color: '#67c23a' }}>{closedRate}%</div>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: 'var(--td-text-color-secondary)' }}>转人工率</div>
              <div className="font-semibold" style={{ color: '#f56c6c' }}>{transferRate}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============= 对话记录 =============
function SessionsTab() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [intentFilter, setIntentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [detailVisible, setDetailVisible] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (intentFilter) params.set('intent', intentFilter);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/sessions?${params}`);
      const data = await res.json();
      setSessions(data.sessions || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }, [page, intentFilter, statusFilter]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const viewDetail = async (session: any) => {
    setSelectedSession(session);
    try {
      const res = await fetch(`/api/sessions/${session.id}`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {}
    setDetailVisible(true);
  };

  const columns = [
    { colKey: 'title', title: '对话标题', ellipsis: true, width: 200 },
    {
      colKey: 'intent', title: '意图', width: 100,
      cell: ({ row }: any) => <Tag theme={intentColorMap[row.intent] || 'default'} variant="light" size="small">{intentLabelMap[row.intent] || row.intent}</Tag>
    },
    {
      colKey: 'status', title: '状态', width: 90,
      cell: ({ row }: any) => <Tag theme={statusColorMap[row.status] || 'default'} variant="light" size="small">{statusLabelMap[row.status] || row.status}</Tag>
    },
    {
      colKey: 'satisfaction', title: '满意度', width: 90,
      cell: ({ row }: any) => row.satisfaction ? (
        <span style={{ color: '#faad14' }}>{'⭐'.repeat(row.satisfaction)}</span>
      ) : <span style={{ color: 'var(--td-text-color-placeholder)' }}>未评价</span>
    },
    {
      colKey: 'transferred_to_human', title: '转人工', width: 80,
      cell: ({ row }: any) => row.transferred_to_human ? <Tag theme="warning" variant="light" size="small">已转人工</Tag> : '--'
    },
    { colKey: 'messageCount', title: '消息数', width: 80 },
    {
      colKey: 'updated_at', title: '最后更新', width: 160,
      cell: ({ row }: any) => new Date(row.updated_at).toLocaleString('zh-CN')
    },
    {
      colKey: 'action', title: '操作', width: 80,
      cell: ({ row }: any) => (
        <Button variant="text" size="small" onClick={() => viewDetail(row)}>查看</Button>
      )
    },
  ];

  return (
    <div className="p-4">
      {/* 筛选栏 */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <Select
          value={intentFilter}
          onChange={(v) => setIntentFilter(String(v || ''))}
          placeholder="全部意图"
          clearable
          style={{ width: 150 }}
          options={Object.entries(intentLabelMap).map(([k, v]) => ({ value: k, label: v }))}
        />
        <Select
          value={statusFilter}
          onChange={(v) => setStatusFilter(String(v || ''))}
          placeholder="全部状态"
          clearable
          style={{ width: 130 }}
          options={Object.entries(statusLabelMap).map(([k, v]) => ({ value: k, label: v }))}
        />
        <Button icon={<RefreshIcon />} variant="outline" onClick={fetchSessions}>刷新</Button>
      </div>

      <Table
        data={sessions}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ total, current: page, pageSize: 20, onChange: ({ current }) => setPage(current || 1) }}
        empty={<Empty description="暂无对话记录" />}
        hover
        stripe
      />

      {/* 对话详情弹窗 */}
      <Dialog
        header={`对话详情 - ${selectedSession?.title}`}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        footer={<Button onClick={() => setDetailVisible(false)}>关闭</Button>}
        width={680}
      >
        <div className="max-h-96 overflow-y-auto space-y-3 py-2">
          {messages.length === 0 ? <Empty description="暂无消息" size="small" /> :
            messages.map((msg: any) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-xs lg:max-w-sm rounded-xl px-3 py-2 text-sm"
                  style={{
                    background: msg.role === 'user' ? 'var(--td-brand-color)' : 'var(--td-bg-color-component)',
                    color: msg.role === 'user' ? 'white' : 'var(--td-text-color-primary)',
                  }}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  <div className="text-xs mt-1 opacity-70">{new Date(msg.created_at).toLocaleTimeString('zh-CN')}</div>
                </div>
              </div>
            ))
          }
        </div>
        {selectedSession && (
          <div className="mt-4 pt-3 border-t grid grid-cols-2 gap-2 text-xs" style={{ borderColor: 'var(--td-component-border)', color: 'var(--td-text-color-secondary)' }}>
            <div>意图：<Tag theme={intentColorMap[selectedSession.intent]} variant="light" size="small">{intentLabelMap[selectedSession.intent] || selectedSession.intent}</Tag></div>
            <div>状态：<Tag theme={statusColorMap[selectedSession.status]} variant="light" size="small">{statusLabelMap[selectedSession.status] || selectedSession.status}</Tag></div>
            <div>转人工：{selectedSession.transferred_to_human ? '是' : '否'}</div>
            <div>满意度：{selectedSession.satisfaction ? '⭐'.repeat(selectedSession.satisfaction) : '未评价'}</div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

// ============= FAQ 管理 =============
function FaqTab() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingFaq, setEditingFaq] = useState<Faq | null>(null);
  const [form] = Form.useForm();

  const fetchFaqs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/faq');
      const data = await res.json();
      setFaqs(data.faqs || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFaqs(); }, [fetchFaqs]);

  const handleSave = async () => {
    const values = await form.validate();
    if (!values) return;
    try {
      if (editingFaq) {
        await fetch(`/api/faq/${editingFaq.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form.getFieldsValue(true)) });
        MessagePlugin.success('更新成功');
      } else {
        await fetch('/api/faq', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form.getFieldsValue(true)) });
        MessagePlugin.success('添加成功');
      }
      setDialogVisible(false);
      fetchFaqs();
    } catch {
      MessagePlugin.error('操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/faq/${id}`, { method: 'DELETE' });
      MessagePlugin.success('删除成功');
      fetchFaqs();
    } catch {
      MessagePlugin.error('删除失败');
    }
  };

  const openAdd = () => {
    setEditingFaq(null);
    form.reset();
    setDialogVisible(true);
  };

  const openEdit = (faq: Faq) => {
    setEditingFaq(faq);
    form.setFieldsValue({ category: faq.category, question: faq.question, answer: faq.answer, tags: faq.tags || '' });
    setDialogVisible(true);
  };

  const columns = [
    { colKey: 'category', title: '分类', width: 100, cell: ({ row }: any) => <Tag variant="light" size="small">{row.category}</Tag> },
    { colKey: 'question', title: '问题', ellipsis: true },
    { colKey: 'answer', title: '答案', ellipsis: true },
    { colKey: 'usage_count', title: '使用次数', width: 90 },
    {
      colKey: 'action', title: '操作', width: 120,
      cell: ({ row }: any) => (
        <div className="flex gap-1">
          <Button variant="text" size="small" icon={<EditIcon />} onClick={() => openEdit(row)}>编辑</Button>
          <Popconfirm content="确定删除此FAQ？" onConfirm={() => handleDelete(row.id)}>
            <Button variant="text" size="small" theme="danger" icon={<DeleteIcon />}>删除</Button>
          </Popconfirm>
        </div>
      )
    },
  ];

  return (
    <div className="p-4">
      <div className="flex justify-between mb-4">
        <div className="text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>共 {faqs.length} 条知识库记录</div>
        <Button theme="primary" icon={<AddIcon />} onClick={openAdd}>添加FAQ</Button>
      </div>

      <Table data={faqs} columns={columns} rowKey="id" loading={loading} hover stripe empty={<Empty description="暂无FAQ" />} />

      <Dialog
        header={editingFaq ? '编辑FAQ' : '添加FAQ'}
        visible={dialogVisible}
        onClose={() => setDialogVisible(false)}
        onConfirm={handleSave}
        confirmBtn="保存"
        cancelBtn="取消"
        width={560}
      >
        <Form form={form} labelAlign="top" colon>
          <FormItem label="分类" name="category" rules={[{ required: true, message: '请输入分类' }]}>
            <Select
              options={['退款政策', '配送政策', '账户问题', '售后服务', '支付问题', '发票问题', '技术支持', '其他'].map(v => ({ value: v, label: v }))}
              creatable
              placeholder="选择或输入分类"
            />
          </FormItem>
          <FormItem label="问题" name="question" rules={[{ required: true, message: '请输入问题' }]}>
            <Input placeholder="请输入问题" />
          </FormItem>
          <FormItem label="答案" name="answer" rules={[{ required: true, message: '请输入答案' }]}>
            <Textarea placeholder="请输入详细答案" autosize={{ minRows: 3, maxRows: 8 }} />
          </FormItem>
          <FormItem label="标签（逗号分隔）" name="tags">
            <Input placeholder="退款,退货,售后" />
          </FormItem>
        </Form>
      </Dialog>
    </div>
  );
}

// ============= 管理后台主页 =============
export function AdminPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch('/api/admin/dashboard');
      const data = await res.json();
      setStats(data);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--td-bg-color-page)' }}>
      <div className="px-6 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--td-text-color-primary)' }}>
              管理后台
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--td-text-color-secondary)' }}>
              智能客服 Agent — 对话记录、满意度统计与知识库管理
            </p>
          </div>
          <Button variant="outline" icon={<RefreshIcon />} onClick={fetchStats}>刷新统计</Button>
        </div>
      </div>

      <Tabs defaultValue="dashboard" style={{ padding: '0 16px' }}>
        <TabPanel value="dashboard" label="数据总览">
          <DashboardTab stats={stats} loading={statsLoading} />
        </TabPanel>
        <TabPanel value="sessions" label="对话记录">
          <SessionsTab />
        </TabPanel>
        <TabPanel value="faq" label="知识库管理">
          <FaqTab />
        </TabPanel>
      </Tabs>
    </div>
  );
}
