import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Select,
  InputNumber,
  Button,
  Space,
  Table,
  Tag,
  Spin,
  Alert,
  message,
  Input,
  theme,
  Typography,
  Modal,
  Descriptions,
} from 'antd';
import { SearchOutlined, ReloadOutlined, CaretUpOutlined, CaretDownOutlined, CopyOutlined } from '@ant-design/icons';
import { useCluster } from '../components/Layout';
import { listTopics, readMessages } from '../api/client';
import type { TopicInfo, MessageRecord } from '../types';

const { Text } = Typography;

type TimestampSort = 'asc' | 'desc' | null;

const MessageViewer: React.FC = () => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const { selectedCluster } = useCluster();
  const [topics, setTopics] = useState<TopicInfo[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | undefined>();
  const [partition, setPartition] = useState<number | undefined>();
  const [startOffset, setStartOffset] = useState<number | undefined>();
  const [limit, setLimit] = useState(20);
  const [valueFilter, setValueFilter] = useState('');
  const [timestampSort, setTimestampSort] = useState<TimestampSort>(null);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [detailMessage, setDetailMessage] = useState<MessageRecord | null>(null);

  useEffect(() => {
    if (!selectedCluster) return;
    listTopics(selectedCluster.id)
      .then(setTopics)
      .catch(() => message.error(t('messageViewer.loadTopicsFailed')));
  }, [selectedCluster, t]);

  const handleSearch = async () => {
    if (!selectedCluster || !selectedTopic) return;
    setLoading(true);
    setError('');
    setSearched(true);
    setTimestampSort(null);
    setDetailMessage(null);
    try {
      const data = await readMessages(selectedCluster.id, selectedTopic, {
        partition,
        startOffset: startOffset !== undefined ? startOffset : undefined,
        limit,
        valueFilter: valueFilter || undefined,
      });
      setMessages(data);
    } catch (err: unknown) {
      setMessages([]);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const sortedMessages = useMemo(() => {
    if (!timestampSort) return messages;
    return [...messages].sort((a, b) => {
      const diff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      return timestampSort === 'asc' ? diff : -diff;
    });
  }, [messages, timestampSort]);

  const copyToClipboard = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        message.success(t('messageViewer.copied'));
      } catch {
        message.error(t('messageViewer.copyFailed'));
      }
    },
    [t],
  );

  const formatMessageForCopy = useCallback((record: MessageRecord) => {
    return [
      `partition: ${record.partition}`,
      `offset: ${record.offset}`,
      `key: ${record.key}`,
      `timestamp: ${new Date(record.timestamp).toISOString()}`,
      'value:',
      record.value,
    ].join('\n');
  }, []);

  const sortBtnStyle = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 12,
    width: 12,
    minWidth: 12,
    minHeight: 12,
    padding: 0,
    margin: 0,
    lineHeight: 1,
    color: active ? token.colorPrimary : token.colorTextQuaternary,
  });

  const columns = [
    {
      title: t('common.partition'),
      dataIndex: 'partition',
      key: 'partition',
      width: 90,
    },
    {
      title: t('consumerGroupDetail.offset'),
      dataIndex: 'offset',
      key: 'offset',
      width: 120,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: t('messageViewer.key'),
      dataIndex: 'key',
      key: 'key',
      width: 200,
      ellipsis: true,
    },
    {
      title: t('messageViewer.value'),
      dataIndex: 'value',
      key: 'value',
      ellipsis: true,
      render: (value: string, record: MessageRecord) => (
        <Space
          size={4}
          align="start"
          style={{ cursor: 'pointer', width: '100%' }}
          title={t('messageViewer.clickValueHint')}
          onClick={() => setDetailMessage(record)}
        >
          {record.isJson && <Tag color="blue">JSON</Tag>}
          <Text
            ellipsis={{ tooltip: value }}
            style={{ flex: 1, minWidth: 0, color: token.colorPrimary }}
          >
            {value.length > 200 ? value.substring(0, 200) + '...' : value}
          </Text>
        </Space>
      ),
    },
    {
      title: (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            lineHeight: 1,
          }}
        >
          <span>{t('messageViewer.timestamp')}</span>
          <span
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0,
            }}
          >
            <Button
              type="text"
              size="small"
              icon={<CaretUpOutlined style={{ fontSize: 10 }} />}
              style={sortBtnStyle(timestampSort === 'asc')}
              title={t('messageViewer.sortAsc')}
              aria-label={t('messageViewer.sortAsc')}
              onClick={() => setTimestampSort('asc')}
            />
            <Button
              type="text"
              size="small"
              icon={<CaretDownOutlined style={{ fontSize: 10 }} />}
              style={sortBtnStyle(timestampSort === 'desc')}
              title={t('messageViewer.sortDesc')}
              aria-label={t('messageViewer.sortDesc')}
              onClick={() => setTimestampSort('desc')}
            />
          </span>
        </span>
      ),
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 200,
      render: (v: string) => new Date(v).toLocaleString(),
    },
  ];

  return (
    <div>
      <h2>{t('messageViewer.title')}</h2>

      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          style={{ width: 250 }}
          placeholder={t('messageViewer.selectTopic')}
          value={selectedTopic}
          onChange={setSelectedTopic}
          options={topics.map((topic) => ({ label: topic.name, value: topic.name }))}
          showSearch
          filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
        />
        <InputNumber
          placeholder={t('common.partition')}
          min={0}
          value={partition}
          onChange={(v) => setPartition(v ?? undefined)}
          style={{ width: 120 }}
        />
        <InputNumber
          placeholder={t('messageViewer.startOffset')}
          value={startOffset}
          onChange={(v) => setStartOffset(v ?? undefined)}
          style={{ width: 140 }}
        />
        <InputNumber
          placeholder={t('messageViewer.limit')}
          min={1}
          max={100}
          value={limit}
          onChange={(v) => setLimit(v || 20)}
          style={{ width: 100 }}
        />
        <Input
          placeholder={t('messageViewer.valueFilter')}
          value={valueFilter}
          onChange={(e) => setValueFilter(e.target.value)}
          style={{ width: 180 }}
          allowClear
        />
        <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} loading={loading} disabled={!selectedTopic}>
          {t('common.search')}
        </Button>
        <Button icon={<ReloadOutlined />} onClick={handleSearch} disabled={!selectedTopic} />
      </Space>

      {loading && <Spin size="large" style={{ display: 'block', margin: '40px auto' }} />}
      {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
      {!loading && searched && !error && messages.length === 0 && (
        <Alert
          type="info"
          message={t('messageViewer.noMessages')}
          description={t('messageViewer.noMessagesHint')}
          style={{ marginBottom: 16 }}
        />
      )}

      {!loading && (
        <Table
          columns={columns}
          dataSource={sortedMessages}
          rowKey={(r) => `${r.partition}-${r.offset}`}
          pagination={{ pageSize: 20 }}
          size="small"
        />
      )}

      <Modal
        title={t('messageViewer.detailTitle')}
        open={detailMessage !== null}
        onCancel={() => setDetailMessage(null)}
        width={760}
        footer={
          detailMessage
            ? [
                <Button key="copy-key" icon={<CopyOutlined />} onClick={() => copyToClipboard(detailMessage.key)}>
                  {t('messageViewer.copyKey')}
                </Button>,
                <Button key="copy-value" type="primary" icon={<CopyOutlined />} onClick={() => copyToClipboard(detailMessage.value)}>
                  {t('messageViewer.copyValue')}
                </Button>,
                <Button key="copy-all" icon={<CopyOutlined />} onClick={() => copyToClipboard(formatMessageForCopy(detailMessage))}>
                  {t('messageViewer.copyAll')}
                </Button>,
              ]
            : null
        }
      >
        {detailMessage && (
          <>
            <Descriptions size="small" bordered column={2}>
              <Descriptions.Item label={t('common.partition')}>{detailMessage.partition}</Descriptions.Item>
              <Descriptions.Item label={t('consumerGroupDetail.offset')}>{detailMessage.offset.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label={t('messageViewer.timestamp')} span={2}>
                {new Date(detailMessage.timestamp).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label={t('messageViewer.key')} span={2}>
                <Text copyable={{ text: detailMessage.key, tooltips: [t('messageViewer.copy'), t('messageViewer.copied')] }}>
                  {detailMessage.key || '—'}
                </Text>
              </Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 16 }}>
              <Space style={{ marginBottom: 8 }}>
                <Text strong>{t('messageViewer.value')}</Text>
                {detailMessage.isJson && <Tag color="blue">JSON</Tag>}
              </Space>
              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  maxHeight: 420,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  background: token.colorFillAlter,
                  borderRadius: token.borderRadius,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {detailMessage.value}
              </pre>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default MessageViewer;
